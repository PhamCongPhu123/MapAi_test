using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MapAI.API.Controllers;
using MapAI.Domain.Models.Ai;
using MapAI.Infrastructure.Interfaces;
using MapAI.Infrastructure.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

// Real HTTP -> controller -> AiService -> GeminiRepository. Only Google HTTP is
// replaced. No API key, remote request, PostgreSQL connection or billing needed.
var passed = 0;
const string key = "fixture-gemini-secret-never-display";
var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
{
    ["GeminiConfig:ApiKey"] = key, ["GeminiConfig:Model"] = "gemini-test-model", ["GeminiConfig:TimeoutSeconds"] = "5"
}).Build();
var handler = new GeminiHandler();
var logger = new SafeLogger();
var setting = "ASPNETCORE_TEST_CONTENTROOT_MAPAI_API";
var previous = Environment.GetEnvironmentVariable(setting);
Environment.SetEnvironmentVariable(setting, Path.GetFullPath("../../../../../src/MapAI.API", AppContext.BaseDirectory));
try
{
    await using var factory = new AiFactory(handler, config, logger);
    using var api = factory.CreateClient();
    async Task<JsonObject> Ask(string text, int status, string? code = null)
    {
        using var response = await api.PostAsJsonAsync("/api/v1/ai/ask", new { userInput = text, chatHistory = Array.Empty<object>() });
        var raw = await response.Content.ReadAsStringAsync();
        Check((int)response.StatusCode == status, $"AI HTTP status: expected {status}, got {(int)response.StatusCode}");
        Check(!raw.Contains(key) && !raw.Contains("raw-provider-fixture"), "API response does not expose keys or provider payloads");
        var json = JsonNode.Parse(raw)!.AsObject();
        if (code != null) Check(json["code"]?.GetValue<string>() == code, "AI error code " + code);
        return json;
    }
    handler.Reset((_, _) => Task.FromResult(Google(400, """{"error":{"message":"API key not valid. raw-provider-fixture","details":[{"reason":"API_KEY_INVALID"}]}}""")));
    var invalid = await Ask("Giới thiệu về Cầu Rồng", 503, "AI_KEY_INVALID");
    Check(invalid["message"]!.GetValue<string>().Contains("không hợp lệ"), "Actual invalid-key error explains configuration, not GPS");
    Check(handler.Requests.Count == 1, "Invalid API key is not retried");
    Check(handler.Requests[0].HeaderKey == key && handler.Requests[0].Url.Query == "", "Google key is in header, never in request URL");

    foreach (var (upstream, expected, code) in new[] { (403, 503, "AI_ACCESS_DENIED"), (404, 503, "AI_MODEL_UNAVAILABLE"), (429, 429, "AI_RATE_LIMITED") })
    {
        handler.Reset((_, _) => Task.FromResult(Google(upstream, "raw-provider-fixture")));
        await Ask("Thông tin về Cầu Rồng", expected, code);
        Check(handler.Requests.Count == 1, "Permanent error/quota is not retried");
    }

    handler.Reset((request, _) => Task.FromResult(handler.Requests.Count == 1 ? Google(503, "raw-provider-fixture") : Text("""{"category":"error"}""")));
    await Ask("Câu hỏi thử phục hồi dịch vụ", 200);
    Check(handler.Requests.Count == 2, "Transient server error retries once and can recover");

    handler.Reset((_, _) => Task.FromException<HttpResponseMessage>(new HttpRequestException("raw-provider-fixture " + key)));
    await Ask("Câu hỏi thử lỗi mạng", 503, "AI_CONNECTION_FAILED");
    Check(handler.Requests.Count == 2, "Transport retry is bounded");

    config["GeminiConfig:TimeoutSeconds"] = "1";
    handler.Reset(async (_, token) => { await Task.Delay(Timeout.Infinite, token); return Text("{}"); });
    await Ask("Câu hỏi thử quá thời gian", 504, "AI_TIMEOUT");
    Check(handler.Requests.Count == 1, "Request deadline cancels a stalled provider");
    config["GeminiConfig:TimeoutSeconds"] = "5";

    config["GeminiConfig:ApiKey"] = "";
    handler.Reset((_, _) => throw new Exception("Must not call Google without a key"));
    await Ask("Giới thiệu Cầu Rồng", 503, "AI_NOT_CONFIGURED");
    var local = await Ask("tôi muốn tìm cây xăng gần nhất", 200);
    Check(local["action"]?["type"]?.GetValue<string>() == "NEAREST_SEARCH" && handler.Requests.Count == 0, "Common nearest command still works with no Gemini key");
    Check((await Ask("phóng to bản đồ", 200))["action"]?["type"]?.GetValue<string>() == "ZOOM_IN", "Camera commands remain independent of Gemini");
    config["GeminiConfig:ApiKey"] = key;

    handler.Reset((_, _) => Task.FromResult(Google(200, """{"promptFeedback":{"blockReason":"SAFETY"}}""")));
    await Ask("Câu hỏi thử phản hồi bị chặn", 422, "AI_RESPONSE_BLOCKED");
    handler.Reset((_, _) => Task.FromResult(Text("not structured JSON")));
    await Ask("Câu hỏi thử dữ liệu lỗi", 502, "AI_INVALID_RESPONSE");
    handler.Reset((_, _) => Task.FromResult(Google(200, "not JSON")));
    await Ask("Câu hỏi thử phản hồi lỗi", 502, "AI_INVALID_RESPONSE");

    handler.Reset((_, _) => Task.FromResult(handler.Requests.Count == 1
        ? Text("""{"category":"place_detail"}""")
        : Text("""{"message":"Cầu Rồng là một cây cầu tại Đà Nẵng.","suggestions":["Xem bản đồ"]}""")));
    var answer = await Ask("Giới thiệu về Cầu Rồng", 200);
    Check(answer["message"]?.GetValue<string>() == "Cầu Rồng là một cây cầu tại Đà Nẵng." && handler.Requests.Count == 2, "Valid router/detail responses reach the chat UI contract");

    handler.Reset((_, _) => Task.FromResult(Google(200, """{"candidates":[{"content":{"parts":[{"thought":true,"text":"internal thought"},{"text":"{\"ok\":"},{"text":"true}"}]}}]}""")));
    using var client = new HttpClient(handler, disposeHandler: false);
    var repository = new GeminiRepository(client, config, NullLogger<GeminiRepository>.Instance);
    var extracted = await repository.CallGeminiAsync("system", new { type = "object" }, "current user message",
        [new() { Role = "model", Text = "initial greeting" }, new() { Role = "user", Text = "first question" }, new() { Role = "user", Text = "second question" }]);
    Check(extracted == "{\"ok\":true}", "Multi-part text is joined and reasoning parts are excluded");
    using var payload = JsonDocument.Parse(handler.Requests[0].Body);
    var contents = payload.RootElement.GetProperty("contents");
    Check(contents.GetArrayLength() == 1 && contents[0].GetProperty("role").GetString() == "user", "Leading bot greeting is not sent as a model-first conversation");
    Check(contents[0].GetProperty("parts").GetArrayLength() == 3, "Adjacent user turns/current message are retained in order");
    Check(payload.RootElement.TryGetProperty("systemInstruction", out _) && payload.RootElement.GetProperty("generationConfig").TryGetProperty("responseSchema", out _), "Request uses documented structured-output fields");
    Check(logger.Messages.All(message => !message.Contains(key) && !message.Contains("raw-provider-fixture")), "Provider logs contain codes/statuses, not secrets or raw payloads");
    await Ask(" ", 400);
    Check(handler.Requests.Count == 1, "Invalid input is rejected before calling Google");
    Console.WriteLine($"PASS: {passed} AI chat HTTP/provider assertions (captured Google HTTP; no real API key/network).");
}
finally { Environment.SetEnvironmentVariable(setting, previous); }

void Check(bool condition, string message) { if (!condition) throw new Exception("FAIL: " + message); passed++; }
static HttpResponseMessage Google(int status, string body) => new((HttpStatusCode)status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
static HttpResponseMessage Text(string text) => Google(200, JsonSerializer.Serialize(new { candidates = new[] { new { content = new { parts = new[] { new { text } } } } } }));

sealed class AiFactory(GeminiHandler handler, IConfiguration config, SafeLogger logger) : WebApplicationFactory<AiController>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:DefaultConnection", "Host=127.0.0.1;Port=1;Username=unused;Database=unused");
        builder.ConfigureLogging(logging => logging.ClearProviders());
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IAiRepository>();
            services.AddScoped<IAiRepository>(_ => new GeminiRepository(new HttpClient(handler, disposeHandler: false), config, logger));
        });
    }
}
sealed class GeminiHandler : HttpMessageHandler
{
    public List<(Uri Url, string? HeaderKey, string Body)> Requests { get; } = [];
    private Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> _reply = (_, _) => throw new InvalidOperationException("Set fixture first");
    public void Reset(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> reply) { Requests.Clear(); _reply = reply; }
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add((request.RequestUri!, request.Headers.TryGetValues("x-goog-api-key", out var values) ? values.Single() : null, await request.Content!.ReadAsStringAsync(cancellationToken)));
        return await _reply(request, cancellationToken);
    }
}
sealed class SafeLogger : ILogger<GeminiRepository>
{
    public List<string> Messages { get; } = [];
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel level) => true;
    public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
}
