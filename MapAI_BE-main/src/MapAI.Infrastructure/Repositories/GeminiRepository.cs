using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MapAI.Domain.Ports;
using MapAI.Domain.Models.Ai;
using MapAI.Domain.Exceptions;
using System.Text;
using System.Text.Json;

namespace MapAI.Infrastructure.Repositories;

public class GeminiRepository : IAiRepository
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly ILogger<GeminiRepository> _logger;
    private readonly string _modelId;
    private readonly TimeSpan _timeout;

    public GeminiRepository(HttpClient httpClient, IConfiguration config, ILogger<GeminiRepository> logger)
    {
        _httpClient = httpClient;
        _apiKey = config["GeminiConfig:ApiKey"]?.Trim() ?? string.Empty;
        var model = config["GeminiConfig:Model"]?.Trim();
        _modelId = string.IsNullOrEmpty(model) ? "gemini-2.5-flash" : model.StartsWith("models/") ? model[7..] : model;
        _timeout = TimeSpan.FromSeconds(int.TryParse(config["GeminiConfig:TimeoutSeconds"], out var seconds) ? Math.Clamp(seconds, 1, 60) : 30);
        _logger = logger;
    }

    public async Task<string> CallGeminiAsync(string systemPrompt, object responseSchema, string userMessage,
        List<ChatMessage>? chatHistory = null, double temperature = 0.3)
    {
        if (string.IsNullOrWhiteSpace(_apiKey) || _apiKey.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
            throw new AiProviderException(503, "AI_NOT_CONFIGURED", "Trợ lý AI chưa được cấu hình khóa truy cập Gemini. Các lệnh bản đồ cơ bản vẫn dùng được.");

        var turns = new List<(string Role, List<object> Parts)>();
        foreach (var message in chatHistory ?? [])
        {
            if (string.IsNullOrWhiteSpace(message.Text)) continue;
            var role = message.Role is "ai" or "assistant" or "model" ? "model" : "user";
            // The frontend greeting is not a reply to a user turn.
            if (turns.Count == 0 && role == "model") continue;
            AddTurn(role, message.Text);
        }
        AddTurn("user", userMessage);
        void AddTurn(string role, string text)
        {
            if (turns.Count > 0 && turns[^1].Role == role) turns[^1].Parts.Add(new { text });
            else turns.Add((role, [new { text }]));
        }
        var payload = new
        {
            contents = turns.Select(turn => new { role = turn.Role, parts = turn.Parts }),
            systemInstruction = new { parts = new[] { new { text = systemPrompt } } },
            generationConfig = new { temperature, responseMimeType = "application/json", responseSchema }
        };
        // Send the key in a header so request URLs/transport errors cannot leak it.
        var uri = new Uri($"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(_modelId)}:generateContent");
        using var deadline = new CancellationTokenSource(_timeout);
        for (var attempt = 0; attempt < 2; attempt++)
        {
            try
            {
                if (attempt > 0) await Task.Delay(TimeSpan.FromSeconds(1), deadline.Token);
                using var request = new HttpRequestMessage(HttpMethod.Post, uri)
                {
                    Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
                };
                request.Headers.Add("x-goog-api-key", _apiKey);
                using var response = await _httpClient.SendAsync(request, deadline.Token);
                var body = await response.Content.ReadAsStringAsync(deadline.Token);
                if (response.IsSuccessStatusCode) return ExtractText(body);
                var error = ProviderFailure((int)response.StatusCode, body);
                _logger.LogWarning("Gemini rejected request: HTTP {Status}, {Code}.", (int)response.StatusCode, error.Code);
                // Retrying an invalid key/model or exhausted quota cannot repair it.
                if ((int)response.StatusCode >= 500 && attempt == 0) continue;
                throw error;
            }
            catch (OperationCanceledException)
            {
                throw new AiProviderException(504, "AI_TIMEOUT", "Dịch vụ AI phản hồi quá thời gian chờ. Vui lòng thử lại.");
            }
            catch (HttpRequestException)
            {
                _logger.LogWarning("Gemini connection failed.");
                if (attempt == 0 && !deadline.IsCancellationRequested) continue;
                throw new AiProviderException(503, "AI_CONNECTION_FAILED", "Backend không kết nối được tới Gemini. Vui lòng kiểm tra kết nối tới dịch vụ AI rồi thử lại.");
            }
        }
        throw new AiProviderException(503, "AI_UNAVAILABLE", "Dịch vụ AI hiện chưa sẵn sàng. Vui lòng thử lại sau.");
    }

    private static AiProviderException ProviderFailure(int status, string body)
    {
        // Inspect known provider reasons internally; return only fixed safe text.
        if (body.Contains("API_KEY_INVALID", StringComparison.OrdinalIgnoreCase)
            || body.Contains("API_KEY_EXPIRED", StringComparison.OrdinalIgnoreCase)
            || body.Contains("API key not valid", StringComparison.OrdinalIgnoreCase))
            return new(503, "AI_KEY_INVALID", "Khóa truy cập Gemini không hợp lệ hoặc đã hết hạn. Cần cập nhật API key ở backend; bật GPS không khắc phục được lỗi này.");
        return status switch
        {
            401 or 403 => new(503, "AI_ACCESS_DENIED", "Gemini từ chối quyền truy cập. Cần kiểm tra API key và quyền sử dụng dịch vụ ở backend."),
            404 => new(503, "AI_MODEL_UNAVAILABLE", "Model Gemini đang cấu hình không khả dụng. Cần chọn model được hỗ trợ trong cấu hình backend."),
            429 => new(429, "AI_RATE_LIMITED", "Gemini đã chạm giới hạn lượt dùng hoặc hạn mức. Vui lòng thử lại sau hoặc kiểm tra quota của dự án."),
            >= 500 => new(503, "AI_UNAVAILABLE", "Dịch vụ Gemini đang gặp lỗi tạm thời. Vui lòng thử lại sau."),
            _ => new(502, "AI_REQUEST_REJECTED", "Gemini chưa chấp nhận yêu cầu xử lý này. Vui lòng thử lại sau.")
        };
    }

    private static string ExtractText(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.TryGetProperty("promptFeedback", out var feedback) && feedback.TryGetProperty("blockReason", out _))
                throw new AiProviderException(422, "AI_RESPONSE_BLOCKED", "Dịch vụ AI không thể trả lời nội dung này. Bạn có thể diễn đạt lại yêu cầu.");
            if (root.TryGetProperty("candidates", out var candidates) && candidates.ValueKind == JsonValueKind.Array && candidates.GetArrayLength() > 0)
            {
                var candidate = candidates[0];
                if (candidate.TryGetProperty("finishReason", out var finish) && finish.GetString() is "SAFETY" or "RECITATION" or "PROHIBITED_CONTENT")
                    throw new AiProviderException(422, "AI_RESPONSE_BLOCKED", "Dịch vụ AI không thể trả lời nội dung này. Bạn có thể diễn đạt lại yêu cầu.");
                if (candidate.TryGetProperty("content", out var content) && content.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array)
                {
                    var text = string.Concat(parts.EnumerateArray().Where(part => !part.TryGetProperty("thought", out var thought) || thought.ValueKind != JsonValueKind.True)
                        .Where(part => part.TryGetProperty("text", out var value) && value.ValueKind == JsonValueKind.String).Select(part => part.GetProperty("text").GetString()));
                    if (!string.IsNullOrWhiteSpace(text)) return text;
                }
            }
        }
        catch (JsonException) { }
        throw new AiProviderException(502, "AI_INVALID_RESPONSE", "Dịch vụ AI trả về dữ liệu chưa hợp lệ. Vui lòng thử lại.");
    }
}
