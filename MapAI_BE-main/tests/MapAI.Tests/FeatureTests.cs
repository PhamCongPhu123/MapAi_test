using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using MapAI.Common.Helpers;
using MapAI.Domain.Enums;
using Microsoft.AspNetCore.WebUtilities;
using Xunit;

namespace MapAI.Tests;

public class FeatureTests
{
    private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=");

    private static async Task<string> Login(HttpClient client, string password = "old-password")
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email = "user@example.test", password });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("accessToken").GetString()!;
    }

    private static MultipartFormDataContent Image(byte[] bytes, string name = "place.png", string mime = "image/png")
    {
        var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(mime);
        form.Add(content, "file", name);
        return form;
    }

    private static async Task<(string UserId, string Token)> RequestReset(MapAiFactory app, HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = "user@example.test" });
        response.EnsureSuccessStatusCode();
        var link = WebUtility.HtmlDecode(Regex.Match(app.EmailBody!, "href=\"([^\"]+)\"").Groups[1].Value);
        var uri = new Uri(link);
        Assert.Equal("/reset-password", uri.AbsolutePath);
        Assert.DoesNotContain("//reset-password", link);
        var query = QueryHelpers.ParseQuery(uri.Query);
        return (query["userId"].ToString(), query["token"].ToString());
    }

    [Fact]
    public async Task OrdinaryUserCanUploadButCannotBypassAdminCreation()
    {
        using var app = new MapAiFactory();
        using var client = app.CreateClient();
        using var anonymousImage = Image(Png);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/v1/location/upload-thumbnail", anonymousImage)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/location/contributions", new { })).StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await Login(client));
        using var image = Image(Png);
        var upload = await client.PostAsync("/api/v1/location/upload-thumbnail", image);
        Assert.True(upload.IsSuccessStatusCode, string.Join(";", upload.Headers.WwwAuthenticate));
        var url = (await upload.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("url").GetString();
        Assert.Equal(Png, app.UploadedBytes);
        Assert.StartsWith("https://images.example.test/location/location_", url);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/v1/location", new { title = "Test" })).StatusCode);
    }

    [Theory]
    [InlineData("empty")]
    [InlineData("oversized")]
    [InlineData("fake-image")]
    [InlineData("wrong-mime")]
    [InlineData("wrong-extension")]
    public async Task UploadRejectsInvalidFilesBeforeStorage(string scenario)
    {
        using var app = new MapAiFactory();
        using var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await Login(client));
        var data = scenario switch { "empty" => Array.Empty<byte>(), "oversized" => new byte[5 * 1024 * 1024 + 1], "fake-image" => "not an image"u8.ToArray(), _ => Png };
        using var image = Image(data, scenario == "wrong-extension" ? "file.svg" : "file.png", scenario == "wrong-mime" ? "text/html" : "image/png");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/v1/location/upload-thumbnail", image)).StatusCode);
        Assert.Null(app.UploadedBytes);
    }

    [Fact]
    public async Task StorageFailureIsActionableAndDoesNotCreateALocation()
    {
        using var app = new MapAiFactory { FailUpload = true };
        using var client = app.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await Login(client));
        using var image = Image(Png);
        var result = await client.PostAsync("/api/v1/location/upload-thumbnail", image);
        Assert.Equal(HttpStatusCode.InternalServerError, result.StatusCode);
        Assert.DoesNotContain("Simulated", await result.Content.ReadAsStringAsync());
        Assert.Empty(app.Locations);
    }

    [Fact]
    public async Task RecoveryResetsPasswordOnceAndRevokesOldCredentials()
    {
        using var app = new MapAiFactory();
        using var client = app.CreateClient();
        var oldAccessToken = await Login(client);
        var (userId, token) = await RequestReset(app, client);
        Assert.Equal(64, token.Length);
        Assert.True(HashHelper.Verify(token, app.Tokens.Single(t => t.Type == ETokenType.PasswordReset).TokenHash));
        var payload = new { userId, token, newPassword = "new-password" };
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/v1/auth/reset-password", payload)).StatusCode);
        Assert.Empty(app.Tokens);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/reset-password", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/v1/auth/login", new { email = app.Account.Email, password = "old-password" })).StatusCode);
        var newAccessToken = await Login(client, "new-password");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", oldAccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/v1/auth/me")).StatusCode);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", newAccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/v1/auth/me")).StatusCode);
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("invalid-token")]
    [InlineData("weak-password")]
    public async Task InvalidResetDoesNotChangePassword(string scenario)
    {
        using var app = new MapAiFactory();
        using var client = app.CreateClient();
        var (userId, token) = await RequestReset(app, client);
        if (scenario == "expired") app.Tokens.Single().ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(-1);
        var result = await client.PostAsJsonAsync("/api/v1/auth/reset-password", new { userId, token = scenario == "invalid-token" ? "wrong" : token, newPassword = scenario == "weak-password" ? "123" : "new-password" });
        Assert.Equal(HttpStatusCode.BadRequest, result.StatusCode);
        Assert.True(HashHelper.Verify("old-password", app.Account.PasswordHash));
    }

    [Fact]
    public async Task ResendingInvalidatesThePreviousLinkAndUnknownEmailsHaveTheSameResponse()
    {
        using var app = new MapAiFactory();
        using var client = app.CreateClient();
        var (userId, firstToken) = await RequestReset(app, client);
        var known = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = app.Account.Email });
        var unknown = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = "unknown@example.test" });
        Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        Assert.Single(app.Tokens);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/reset-password", new { userId, token = firstToken, newPassword = "new-password" })).StatusCode);
    }

    [Fact]
    public async Task RecoveryValidatesEmailAndReportsMailFailure()
    {
        using var app = new MapAiFactory { FailEmail = true };
        using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = "invalid" })).StatusCode);
        var result = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = app.Account.Email });
        Assert.Equal(HttpStatusCode.ServiceUnavailable, result.StatusCode);
        Assert.DoesNotContain("Simulated", await result.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task RecoveryLimitsRepeatedRequests()
    {
        using var app = new MapAiFactory();
        using var client = app.CreateClient();
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = "unknown@example.test" })).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = "unknown@example.test" })).StatusCode);
    }
}
