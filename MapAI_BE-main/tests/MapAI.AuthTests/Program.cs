using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using MapAI.API.Controllers;
using MapAI.Application.Interfaces;
using MapAI.Common.Helpers;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Npgsql;

// Real HTTP controllers, password hashing, JWT middleware and PostgreSQL.
// Only outgoing email is replaced; no real mail or application data is touched.
var connection = Environment.GetEnvironmentVariable("MAPAI_TEST_CONNECTION")
    ?? throw new InvalidOperationException("Set MAPAI_TEST_CONNECTION to a local PostgreSQL connection with CREATE DATABASE permission.");
var config = new NpgsqlConnectionStringBuilder(connection);
if (config.Host is not ("127.0.0.1" or "localhost" or "::1"))
    throw new InvalidOperationException("Auth tests only accept a loopback PostgreSQL server.");
config.Database = "postgres";
await using var adminDb = new NpgsqlConnection(config.ConnectionString);
await adminDb.OpenAsync();
var database = "mapai_auth_" + Guid.NewGuid().ToString("N");
await using (var create = new NpgsqlCommand($"CREATE DATABASE \"{database}\" TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'und'", adminDb))
    await create.ExecuteNonQueryAsync();
config.Database = database;
var environment = new Dictionary<string, string>
{
    ["ConnectionStrings__DefaultConnection"] = config.ConnectionString,
    ["Jwt__Secret"] = "auth-integration-only-local-signing-key-do-not-deploy",
    ["FrontendUrl"] = "http://localhost:5173/",
    ["ASPNETCORE_TEST_CONTENTROOT_MAPAI_API"] = Path.GetFullPath("../../../../../src/MapAI.API", AppContext.BaseDirectory)
};
var previousEnvironment = environment.ToDictionary(e => e.Key, e => Environment.GetEnvironmentVariable(e.Key));
foreach (var entry in environment) Environment.SetEnvironmentVariable(entry.Key, entry.Value);
var passed = 0;
var mail = new CapturingEmail();
await using var factory = new AuthFactory(mail);
try
{
    var options = new DbContextOptionsBuilder<MapAIContext>().UseNpgsql(config.ConnectionString).Options;
    await using var db = new MapAIContext(options);
    await db.Database.MigrateAsync();
    using var client = factory.CreateClient();
    const string email = "student@example.invalid";
    const string password = "test-only-password";
    object Registration(string address = email) => new
    {
        email = address, password, fullName = "Sinh viên", phoneNumber = "",
        dateOfBirth = "2000-01-01", role = 0 // Attempted public admin registration.
    };
    async Task<JsonObject> Post(string path, object body, int expected, string? code = null)
    {
        using var response = await client.PostAsJsonAsync("/api/v1/auth/" + path, body);
        var json = (await response.Content.ReadFromJsonAsync<JsonObject>())!;
        Check((int)response.StatusCode == expected, $"POST {path}: expected {expected}, got {(int)response.StatusCode}");
        if (code != null) Check(json["code"]?.GetValue<string>() == code, $"POST {path}: error code {code}");
        return json;
    }
    async Task<JsonObject> Verify(string link, int expected)
    {
        var uri = new Uri(link);
        using var response = await client.GetAsync("/api/v1/auth/verify-email" + uri.Query);
        Check((int)response.StatusCode == expected, $"Email link verification: expected {expected}, got {(int)response.StatusCode}");
        return (await response.Content.ReadFromJsonAsync<JsonObject>())!;
    }
    async Task AgeVerification(string userId)
    {
        await db.AccountTokens.Where(t => t.UserId == userId && t.Type == ETokenType.EmailVerification)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.CreatedAt, DateTimeOffset.UtcNow.AddMinutes(-10))
                .SetProperty(t => t.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-5)));
    }

    var registered = await Post("register", Registration("Student@Example.invalid"), 200);
    Check(registered["requiresEmailVerification"]?.GetValue<bool>() == true, "Registration clearly requires self-service email verification");
    var user = await db.Users.AsNoTracking().SingleAsync();
    Check(user.Role == EUser.User && !user.IsActive, "Public registration cannot grant admin privileges and awaits email verification");
    Check(user.Email == email && user.PasswordHash != password && HashHelper.Verify(password, user.PasswordHash), "Email normalized and password hashed");
    Check(mail.Messages.Count == 1, "Registration sends verification email");
    var originalLink = mail.LastLink;
    Check(originalLink.StartsWith("http://localhost:5173/verify-email?"), "Email link uses FrontendUrl without duplicate slash");
    var rawToken = QueryHelpers.ParseQuery(new Uri(originalLink).Query)["token"].ToString();
    Check(rawToken.EndsWith("==") && new Uri(originalLink).Query.Contains("%3D"), "Base64 token is URL-encoded and round-trips");

    await Post("login", new { email, password }, 403, "EMAIL_NOT_VERIFIED");
    var wrongPassword = await Post("login", new { email, password = "wrong" }, 401, "INVALID_CREDENTIALS");
    var wrongEmail = await Post("login", new { email = "missing@example.invalid", password }, 401, "INVALID_CREDENTIALS");
    Check(wrongPassword["message"]?.GetValue<string>() == "Email hoặc mật khẩu không chính xác."
        && wrongEmail["message"]?.GetValue<string>() == "Email hoặc mật khẩu không chính xác.", "Wrong password and unknown email return the same clear warning");
    await Post("login", new { email }, 400);
    await Post("register", Registration("STUDENT@example.invalid"), 409, "EMAIL_EXISTS");
    await Post("resend-verification", new { email }, 429, "VERIFICATION_COOLDOWN");
    Check(mail.Messages.Count == 1, "Resend cooldown prevents immediate email spam");
    await Post("resend-verification", new { email = "not-an-email" }, 400);
    await AgeVerification(user.Id);
    await Verify(originalLink, 400);
    Check(!await db.Users.AsNoTracking().Where(u => u.Id == user.Id).Select(u => u.IsActive).SingleAsync(), "An unused expired link cannot activate an account");
    await Post("resend-verification", new { email = "STUDENT@example.invalid" }, 200);
    Check(mail.Messages.Count == 2, "Expired verification can be resent without admin assistance");
    var currentLink = mail.LastLink;
    await Verify(originalLink, 400);
    await Task.WhenAll(Verify(currentLink, 200), Verify(currentLink, 200));
    await Verify(currentLink, 200);
    Check(await db.AccountTokens.AnyAsync(t => t.UserId == user.Id && t.Type == ETokenType.EmailVerification && t.IsDeleted), "Successful verification retains a consumed proof for repeated links");
    await AgeVerification(user.Id);
    await Verify(currentLink, 200);
    await Verify($"http://localhost:5173/verify-email?userId={user.Id}&token=incorrect", 400);

    var login = await Post("login", new { email = "  STUDENT@example.invalid  ", password }, 200);
    var access = login["accessToken"]!.GetValue<string>();
    var refresh = login["refreshToken"]!.GetValue<string>();
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", access);
    using (var me = await client.GetAsync("/api/v1/auth/me"))
    {
        var profile = (await me.Content.ReadFromJsonAsync<JsonObject>())!;
        Check(me.IsSuccessStatusCode && profile["role"]?.GetValue<string>() == "User", "Verified user logs in and JWT authenticates /auth/me without admin approval");
    }
    using (var queue = await client.GetAsync("/api/v1/location/contributions/pending"))
        Check(queue.StatusCode == HttpStatusCode.Forbidden, "Public registration cannot access admin-only moderation");
    var renewed = await Post("refresh", new { userId = user.Id, refreshToken = refresh }, 200);
    refresh = renewed["refreshToken"]!.GetValue<string>();
    Check(refresh != login["refreshToken"]!.GetValue<string>(), "Refresh token rotates");
    await Post("logout", new { }, 200);
    using (var me = await client.GetAsync("/api/v1/auth/me"))
        Check(me.StatusCode == HttpStatusCode.Unauthorized, "Logout revokes authenticated session");
    await Post("refresh", new { userId = user.Id, refreshToken = refresh }, 401);
    client.DefaultRequestHeaders.Authorization = null;
    await Post("login", new { email, password }, 200);

    using (var scope = factory.Services.CreateScope())
        await scope.ServiceProvider.GetRequiredService<IAuthService>().ToggleUserStatusAsync(user.Id);
    await Post("login", new { email, password }, 403, "ACCOUNT_DISABLED");
    var sent = mail.Messages.Count;
    await Post("resend-verification", new { email }, 200);
    Check(mail.Messages.Count == sent, "Resend cannot self-activate a disabled account");
    await Verify(currentLink, 400);
    Check(!await db.AccountTokens.AnyAsync(t => t.UserId == user.Id && t.Type == ETokenType.RefreshToken), "Disabling account revokes refresh sessions");

    // A legacy pending account whose unencoded '+' became a query-string space.
    var legacy = new UserEntity { Id = Guid.NewGuid().ToString(), Email = "Legacy@Example.invalid", FullName = "Legacy", PhoneNumber = "", PasswordHash = HashHelper.Hash(password), DateOfBirth = DateTimeOffset.UtcNow, Role = EUser.User };
    db.Users.Add(legacy);
    db.AccountTokens.Add(new AccountTokenEntity { UserId = legacy.Id, Type = ETokenType.EmailVerification, TokenHash = HashHelper.Hash("legacy+token/=="), ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(5) });
    await db.SaveChangesAsync();
    await Verify($"http://localhost:5173/verify-email?userId={legacy.Id}&token=legacy+token/==", 200);
    await Post("login", new { email = "legacy@example.invalid", password }, 200);
    await db.Users.Where(u => u.Id == legacy.Id).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false));
    await Verify($"http://localhost:5173/verify-email?userId={legacy.Id}&token=legacy+token/==", 400);
    Check(!await db.Users.AsNoTracking().Where(u => u.Id == legacy.Id).Select(u => u.IsActive).SingleAsync(), "A consumed proof never reactivates a disabled account, even if its token was retained");
    await Post("login", new { email = "legacy@example.invalid", password }, 403, "ACCOUNT_DISABLED");

    mail.FailNext = true;
    await Post("register", Registration("retry@example.invalid"), 503, "VERIFICATION_EMAIL_UNAVAILABLE");
    var retryUser = await db.Users.AsNoTracking().SingleAsync(u => u.Email == "retry@example.invalid");
    await Post("login", new { email = retryUser.Email, password }, 403, "EMAIL_NOT_VERIFIED");
    await AgeVerification(retryUser.Id);
    await Post("resend-verification", new { email = retryUser.Email }, 200);
    await Verify(mail.LastLink, 200);
    await Post("login", new { email = retryUser.Email, password }, 200);
    sent = mail.Messages.Count;
    await Post("resend-verification", new { email = retryUser.Email }, 200);
    await Post("resend-verification", new { email = "unknown@example.invalid" }, 200);
    Check(mail.Messages.Count == sent, "Active and unknown emails return generic success without sending mail");
    // Password recovery uses the same real database and captures only outgoing email.
    var recoveryLogin = await Post("login", new { email = retryUser.Email, password }, 200);
    var oldAccess = recoveryLogin["accessToken"]!.GetValue<string>();
    var oldRefresh = recoveryLogin["refreshToken"]!.GetValue<string>();
    var recoveryResponse = await Post("forgot-password", new { email = retryUser.Email }, 200);
    var recoveryLink = new Uri(mail.LastLink);
    Check(recoveryLink.AbsolutePath == "/reset-password", "Recovery email points to the reset-password page");
    var recoveryQuery = QueryHelpers.ParseQuery(recoveryLink.Query);
    var recoveryToken = recoveryQuery["token"].ToString();
    var resetRecord = await db.AccountTokens.AsNoTracking().SingleAsync(t => t.UserId == retryUser.Id && t.Type == ETokenType.PasswordReset);
    Check(HashHelper.Verify(recoveryToken, resetRecord.TokenHash) && resetRecord.TokenHash != recoveryToken, "Only a hash of the recovery token is stored");
    Check(resetRecord.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(59) && resetRecord.ExpiresAt <= DateTimeOffset.UtcNow.AddMinutes(60), "Recovery link has a 60 minute lifetime");
    var sentBeforeUnknown = mail.Messages.Count;
    var unknownRecovery = await Post("forgot-password", new { email = "unknown@example.invalid" }, 200);
    Check(unknownRecovery["message"]!.GetValue<string>() == recoveryResponse["message"]!.GetValue<string>() && mail.Messages.Count == sentBeforeUnknown, "Recovery does not reveal whether an email is registered");
    await Post("reset-password", new { userId = retryUser.Id, token = "incorrect", newPassword = "replacement-password" }, 400);
    await Post("reset-password", new { userId = retryUser.Id, token = recoveryToken, newPassword = "123" }, 400);
    using var firstReset = await client.PostAsJsonAsync("/api/v1/auth/reset-password", new { userId = retryUser.Id, token = recoveryToken, newPassword = "first-new-password" });
    using var secondReset = await client.PostAsJsonAsync("/api/v1/auth/reset-password", new { userId = retryUser.Id, token = recoveryToken, newPassword = "second-new-password" });
    Check(firstReset.StatusCode == HttpStatusCode.OK && secondReset.StatusCode == HttpStatusCode.BadRequest, "A recovery link can be consumed only once");
    Check(!await db.AccountTokens.AnyAsync(t => t.UserId == retryUser.Id && (t.Type == ETokenType.PasswordReset || t.Type == ETokenType.RefreshToken)), "Reset consumes its token and revokes refresh sessions together");
    await Post("login", new { email = retryUser.Email, password }, 401);
    await Post("refresh", new { userId = retryUser.Id, refreshToken = oldRefresh }, 401);
    await Post("login", new { email = retryUser.Email, password = "first-new-password" }, 200);
    client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", oldAccess);
    using (var me = await client.GetAsync("/api/v1/auth/me"))
        Check(me.StatusCode == HttpStatusCode.Unauthorized, "Old access token remains invalid after a new login");
    client.DefaultRequestHeaders.Authorization = null;

    await Post("forgot-password", new { email = retryUser.Email }, 200);
    var expiredToken = QueryHelpers.ParseQuery(new Uri(mail.LastLink).Query)["token"].ToString();
    await db.AccountTokens.Where(t => t.UserId == retryUser.Id && t.Type == ETokenType.PasswordReset)
        .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, DateTimeOffset.UtcNow.AddMinutes(-1)));
    await Post("reset-password", new { userId = retryUser.Id, token = expiredToken, newPassword = "expired-must-not-win" }, 400);
    mail.FailNext = true;
    await Post("forgot-password", new { email = retryUser.Email }, 503);
    await Post("forgot-password", new { email = retryUser.Email }, 200);
    var concurrentToken = QueryHelpers.ParseQuery(new Uri(mail.LastLink).Query)["token"].ToString();
    var resetTasks = new[]
    {
        client.PostAsJsonAsync("/api/v1/auth/reset-password", new { userId = retryUser.Id, token = concurrentToken, newPassword = "concurrent-first-password" }),
        client.PostAsJsonAsync("/api/v1/auth/reset-password", new { userId = retryUser.Id, token = concurrentToken, newPassword = "concurrent-second-password" })
    };
    var resetResults = await Task.WhenAll(resetTasks);
    try
    {
        Check(resetResults.Count(r => r.StatusCode == HttpStatusCode.OK) == 1 && resetResults.Count(r => r.StatusCode == HttpStatusCode.BadRequest) == 1, "Concurrent reset requests produce exactly one successful password change");
        var winningPassword = resetResults[0].StatusCode == HttpStatusCode.OK ? "concurrent-first-password" : "concurrent-second-password";
        await Post("login", new { email = retryUser.Email, password = winningPassword }, 200);
    }
    finally { foreach (var response in resetResults) response.Dispose(); }
    using (var limited = await client.PostAsJsonAsync("/api/v1/auth/forgot-password", new { email = retryUser.Email }))
        Check(limited.StatusCode == HttpStatusCode.TooManyRequests, "Recovery limits email requests after five attempts per minute");
    Console.WriteLine($"PASS: {passed} authentication assertions against real HTTP/JWT/PostgreSQL (captured email, no external SMTP).");
}
finally
{
    await factory.DisposeAsync();
    foreach (var entry in previousEnvironment) Environment.SetEnvironmentVariable(entry.Key, entry.Value);
    NpgsqlConnection.ClearAllPools();
    await using var drop = new NpgsqlCommand($"DROP DATABASE \"{database}\" WITH (FORCE)", adminDb);
    await drop.ExecuteNonQueryAsync();
}

void Check(bool condition, string message)
{
    if (!condition) throw new Exception("FAIL: " + message);
    Interlocked.Increment(ref passed);
}

sealed class AuthFactory(CapturingEmail email) : WebApplicationFactory<AuthController>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureLogging(logging => logging.SetMinimumLevel(LogLevel.Critical));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<IEmailRepository>();
            services.AddSingleton<IEmailRepository>(email);
        });
    }
}

sealed class CapturingEmail : IEmailRepository
{
    public List<string> Messages { get; } = [];
    public bool FailNext { get; set; }
    public string LastLink => WebUtility.HtmlDecode(Regex.Match(Messages.Last(), "href=\"([^\"]+)\"").Groups[1].Value);
    public Task SendEmailAsync(string toEmail, string subject, string body)
    {
        if (FailNext)
        {
            FailNext = false;
            throw new IOException("Simulated SMTP failure");
        }
        Messages.Add(body);
        return Task.CompletedTask;
    }
}
