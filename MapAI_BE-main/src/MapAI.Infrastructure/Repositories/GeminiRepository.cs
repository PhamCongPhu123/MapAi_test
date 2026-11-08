using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MapAI.Infrastructure.Interfaces;
using MapAI.Domain.Models.Ai;
using System.Text;
using System.Text.Json;

namespace MapAI.Infrastructure.Repositories
{
    public class GeminiRepository : IAiRepository
    {
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private readonly ILogger<GeminiRepository> _logger;
        private readonly string _modelId;

        public GeminiRepository(HttpClient httpClient, IConfiguration config, ILogger<GeminiRepository> logger)
        {
            _httpClient = httpClient;
            _httpClient.Timeout = TimeSpan.FromSeconds(120);
            _apiKey = config["GeminiConfig:ApiKey"]?.Trim() ?? throw new ArgumentNullException("GeminiConfig:ApiKey missing");
            _modelId = config["GeminiConfig:Model"]?.Trim() ?? "gemini-2.5-flash"; 
            _logger = logger;
        }

        public async Task<string> CallGeminiAsync(
            string systemPrompt, 
            object responseSchema, 
            string userMessage, 
            List<ChatMessage>? chatHistory = null, 
            double temperature = 0.3)
        {
            var contents = new List<object>();

            // Thêm lịch sử nếu có
            if (chatHistory != null)
            {
                foreach (var msg in chatHistory)
                {
                    contents.Add(new
                    {
                        role = msg.Role == "ai" ? "model" : "user",
                        parts = new[] { new { text = msg.Text } }
                    });
                }
            }

            // Thêm tin nhắn hiện tại
            contents.Add(new
            {
                role = "user",
                parts = new[] { new { text = userMessage } }
            });

            var payload = new
            {
                contents = contents,
                system_instruction = new
                {
                    parts = new[] { new { text = systemPrompt } }
                },
                generationConfig = new
                {
                    temperature = temperature,
                    response_mime_type = "application/json",
                    response_schema = responseSchema
                }
            };

            var requestUri = new Uri($"https://generativelanguage.googleapis.com/v1beta/models/{_modelId}:generateContent?key={_apiKey}");
            
            return await CallGeminiApiWithRetryAsync(payload, requestUri);
        }

        private async Task<string> CallGeminiApiWithRetryAsync(object payload, Uri requestUri)
        {
            var jsonOptions = new JsonSerializerOptions 
            { 
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            };
            var jsonBody = JsonSerializer.Serialize(payload, jsonOptions);
            int maxRetries = 2;
            int delayMs = 2000;

            for (int i = 0; i <= maxRetries; i++)
            {
                try
                {
                    if (i > 0)
                    {
                        await Task.Delay(delayMs);
                        delayMs *= 2;
                    }
                    using var content = new StringContent(jsonBody, Encoding.UTF8, "application/json");
                    using var response = await _httpClient.PostAsync(requestUri, content);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseString = await response.Content.ReadAsStringAsync();
                        return ExtractTextFromResponse(responseString);
                    }

                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Gemini API Error. Status: {Status}, Body: {Body}", (int)response.StatusCode, errorBody);

                    if ((int)response.StatusCode == 429 || (int)response.StatusCode >= 500) continue;

                    throw new Exception($"Gemini API error: {response.StatusCode} - {errorBody}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error calling Gemini API");
                    if (i == maxRetries) throw;
                }
            }
            throw new Exception("Failed to get response from Gemini API after retries.");
        }

        private string ExtractTextFromResponse(string jsonResponse)
        {
            using var doc = JsonDocument.Parse(jsonResponse);
            if (doc.RootElement.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
            {
                return candidates[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString() ?? string.Empty;
            }
            throw new Exception("Invalid response format from Gemini API");
        }
    }
}
