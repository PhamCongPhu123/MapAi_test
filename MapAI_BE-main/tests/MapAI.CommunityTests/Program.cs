using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text.Json.Nodes;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Npgsql;

// Black-box HTTP tests against the real API, JWT middleware and a disposable
// PostgreSQL database. Never migrate or seed the user's application database.
var connection = Environment.GetEnvironmentVariable("MAPAI_TEST_CONNECTION")
    ?? throw new InvalidOperationException("Set MAPAI_TEST_CONNECTION to a local PostgreSQL connection with CREATE DATABASE permission.");
var config = new NpgsqlConnectionStringBuilder(connection);
if (config.Host is not ("127.0.0.1" or "localhost" or "::1"))
    throw new InvalidOperationException("Integration tests only accept a loopback PostgreSQL server.");
config.Database = "postgres";
var database = "mapai_community_" + Guid.NewGuid().ToString("N");
await using var adminDb = new NpgsqlConnection(config.ConnectionString);
await adminDb.OpenAsync();
await using (var create = new NpgsqlCommand($"CREATE DATABASE \"{database}\" TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'und'", adminDb)) await create.ExecuteNonQueryAsync();
config.Database = database;
Process? server = null;
var passed = 0;
try
{
    var options = new DbContextOptionsBuilder<MapAIContext>().UseNpgsql(config.ConnectionString).Options;
    await using var db = new MapAIContext(options);
    await db.Database.MigrateAsync();
    var alice = User("alice", EUser.User);
    var bob = User("bob", EUser.User);
    var admin = User("admin", EUser.Admin);
    db.Users.AddRange(alice, bob, admin);
    db.AccountTokens.AddRange(new[] { alice, bob, admin }.Select(user => new AccountTokenEntity
    {
        UserId = user.Id, TokenHash = "integration-session-only", Type = ETokenType.RefreshToken,
        ExpiresAt = DateTimeOffset.UtcNow.AddDays(1)
    }));
    var legacy = new LocationEntity { Title = "Existing imported restaurant", Latitude = 10, Longitude = 105, Rating = 4.9, TotalReviews = 100 };
    db.Locations.Add(legacy);
    await db.SaveChangesAsync();
    const string signingKey = "local-integration-only-do-not-use-in-production-signing-key";
    var jwtConfig = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Jwt:Secret"] = signingKey }).Build();
    var jwt = new JwtRepository(jwtConfig);
    var listener = new TcpListener(IPAddress.Loopback, 0);
    listener.Start();
    var port = ((IPEndPoint)listener.LocalEndpoint).Port;
    listener.Stop();
    var apiAssembly = typeof(MapAI.API.Controllers.CommunityLocationController).Assembly.Location;
    var start = new ProcessStartInfo("dotnet", apiAssembly) { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = Path.GetDirectoryName(apiAssembly)! };
    start.Environment["ConnectionStrings__DefaultConnection"] = config.ConnectionString;
    start.Environment["Jwt__Secret"] = signingKey;
    start.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
    start.Environment["ASPNETCORE_URLS"] = $"http://127.0.0.1:{port}";
    server = Process.Start(start)!;
    var output = server.StandardOutput.ReadToEndAsync();
    var errors = server.StandardError.ReadToEndAsync();
    using var client = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}"), Timeout = TimeSpan.FromSeconds(15) };
    var ready = false;
    for (var attempt = 0; attempt < 60; attempt++)
    {
        if (server.HasExited) throw new Exception("Test API failed to start: " + await errors);
        try { ready = (await client.GetAsync("/swagger/v1/swagger.json")).IsSuccessStatusCode; } catch (HttpRequestException) { }
        if (ready) break;
        await Task.Delay(200);
    }
    Check(ready, "API startup");

    var categories = await client.GetFromJsonAsync<JsonArray>("/api/v1/map/categories");
    Check(categories!.Any(category => category!["id"]!.GetValue<string>() == "fuel"), "Map category API includes fuel");
    using var missingOrigin = await client.GetAsync("/api/v1/map/nearest?category=fuel");
    Check(missingOrigin.StatusCode == HttpStatusCode.BadRequest, "Map endpoint rejects omitted origin instead of defaulting to 0,0");
    using var excessiveRadius = await client.GetAsync("/api/v1/map/places?lat=16&lng=108&category=fuel&radius=50001");
    Check(excessiveRadius.StatusCode == HttpStatusCode.BadRequest, "Map endpoint validates radius before provider requests");
    using var commonCommand = await client.PostAsJsonAsync("/api/v1/ai/ask", new { userInput = "tôi muốn tìm cây xăng gần nhất" });
    var command = await commonCommand.Content.ReadFromJsonAsync<JsonObject>();
    Check(commonCommand.IsSuccessStatusCode && command!["action"]!["type"]!.GetValue<string>() == "NEAREST_SEARCH", "Real AI endpoint handles common nearest intent without Gemini/network");
    using var selectedCommand = await client.PostAsJsonAsync("/api/v1/ai/ask", new { userInput = "chỉ đường đến đó", selectedLocation = new { name = "Test destination", lat = 0, lng = 0 } });
    var selectedAction = await selectedCommand.Content.ReadFromJsonAsync<JsonObject>();
    Check(selectedCommand.IsSuccessStatusCode && selectedAction!["action"]!["type"]!.GetValue<string>() == "SET_DIRECTION", "Real endpoint preserves explicit selected origin/meridian coordinates");

    object Place(string title = "Cafe community", double lat = 16.06) => new
    {
        title, address = "12 Đường thử nghiệm, Đà Nẵng", category = "Cafe", description = "Địa điểm kiểm thử",
        latitude = lat, longitude = 108.22, thumbnail = "https://images.example.test/place.png", status = 0, submittedById = "bob", rating = 5
    };
    async Task<(HttpStatusCode Status, JsonNode? Body)> Send(HttpMethod method, string path, UserEntity? user = null, object? body = null, int expected = 200)
    {
        using var request = new HttpRequestMessage(method, "/api/v1/location" + path);
        if (user != null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt.GenerateAccessToken(user));
        if (body != null) request.Content = JsonContent.Create(body);
        using var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        if (expected >= 0) Check((int)response.StatusCode == expected, $"{method} {path}: expected {expected}, got {(int)response.StatusCode}: {text}");
        return (response.StatusCode, string.IsNullOrEmpty(text) ? null : JsonNode.Parse(text));
    }

    await Send(HttpMethod.Post, "/contributions", body: Place(), expected: 401);
    await Send(HttpMethod.Get, "/contributions/pending", alice, expected: 403);
    await Send(HttpMethod.Post, "", alice, Place(), expected: 403);
    await Send(HttpMethod.Post, "/contributions", alice, Place(lat: 91), expected: 400);
    await Send(HttpMethod.Post, "/contributions", alice, new { title = "A", address = " ", category = "Cafe" }, expected: 400);
    var submitted = (await Send(HttpMethod.Post, "/contributions", alice, Place(), 201)).Body!;
    var id = submitted["id"]!.GetValue<string>();
    Check(submitted["status"]!.GetValue<int>() == 1, "Client cannot bypass moderation by sending status=approved");
    Check(submitted["thumbnail"]!.GetValue<string>() == "https://images.example.test/place.png", "Submitted photo is preserved on the pending contribution");
    await Send(HttpMethod.Post, "/contributions", bob, Place(), 409);
    await Send(HttpMethod.Post, "/contributions", alice, Place("Quán Cộng Đồng"), 201);
    await Send(HttpMethod.Post, "/contributions", bob, Place("quán cộng đồng"), 409);
    await Send(HttpMethod.Get, $"/{id}", expected: 404);
    await Send(HttpMethod.Get, "/title/Cafe%20community", expected: 404);
    Check((await Send(HttpMethod.Get, "?title=Cafe%20community")).Body!.AsArray().Count == 0, "Pending places excluded from search");
    Check((await Send(HttpMethod.Get, "/contributions/mine", alice)).Body!["items"]!.AsArray().Count == 2, "Submitter sees own pending places");
    Check((await Send(HttpMethod.Get, "/contributions/mine", bob)).Body!["items"]!.AsArray().Count == 0, "Client cannot spoof submitter ID");
    var queue = (await Send(HttpMethod.Get, "/contributions/pending", admin)).Body!;
    Check(queue["totalCount"]!.GetValue<int>() == 2, "Admin sees moderation queue");
    Check(queue["items"]!.AsArray().Any(item => item!["id"]!.GetValue<string>() == id && item["thumbnail"]!.GetValue<string>() == "https://images.example.test/place.png"), "Admin receives the photo for review");
    await Send(HttpMethod.Put, $"/{id}/reviews/me", alice, new { rating = 5 }, 404);
    await Send(HttpMethod.Put, $"/contributions/{id}/moderation", alice, new { status = 0 }, 403);
    await Send(HttpMethod.Put, $"/contributions/{id}/moderation", admin, new { status = 0 }, 204);
    var approvedPhoto = (await Send(HttpMethod.Get, $"/{id}")).Body!;
    Check(approvedPhoto["thumbnail"]!.GetValue<string>() == "https://images.example.test/place.png" && approvedPhoto["images"]![0]!.GetValue<string>() == "https://images.example.test/place.png", "Photo becomes publicly discoverable with the approved place");
    Check((await Send(HttpMethod.Get, "?title=Cafe%20community")).Body!.AsArray().Count == 1, "Approved contribution discoverable");
    await Send(HttpMethod.Put, $"/contributions/{id}/moderation", admin, new { status = 2, note = "Late overwrite" }, 409);
    await Send(HttpMethod.Put, $"/{id}/reviews/me", body: new { rating = 5 }, expected: 401);
    await Send(HttpMethod.Put, $"/{id}/reviews/me", alice, new { rating = 6 }, 400);
    await Send(HttpMethod.Put, $"/{id}/reviews/me", alice, new { rating = 0 }, 400);
    await Send(HttpMethod.Put, $"/{id}/reviews/me", alice, new { rating = 4, comment = new string('x', 2001) }, 400);
    await Send(HttpMethod.Get, $"/{id}/reviews?page=0", expected: 400);
    await Send(HttpMethod.Get, $"/{id}/reviews?pageSize=51", expected: 400);
    await Send(HttpMethod.Put, $"/{id}/reviews/me", alice, new { rating = 5, comment = "  Ngon và sạch  ", userId = "bob" });
    await Send(HttpMethod.Delete, $"/{id}/reviews/me", bob, expected: 204);
    var reviews = (await Send(HttpMethod.Get, $"/{id}/reviews", alice)).Body!;
    Check(reviews["totalCount"]!.GetValue<int>() == 1 && reviews["myReview"]!["comment"]!.GetValue<string>() == "Ngon và sạch", "Reviews use authenticated ownership and trim comments");
    await Send(HttpMethod.Put, $"/{id}/reviews/me", alice, new { rating = 3, comment = "Cập nhật trải nghiệm" });
    await Send(HttpMethod.Put, $"/{id}/reviews/me", bob, new { rating = 5, comment = "Rất tốt" });
    reviews = (await Send(HttpMethod.Get, $"/{id}/reviews?pageSize=1", alice)).Body!;
    Check(reviews["totalCount"]!.GetValue<int>() == 2 && reviews["averageRating"]!.GetValue<double>() == 4, "Editing a review does not create duplicates; average is correct");
    Check(reviews["items"]!.AsArray().Count == 1 && reviews["myReview"] != null, "Review pagination still includes own editable review");
    var place = (await Send(HttpMethod.Get, $"/{id}")).Body!;
    Check(place["communityReviewCount"]!.GetValue<int>() == 2 && place["communityRating"]!.GetValue<double>() == 4, "Location response includes current community summary");
    await Send(HttpMethod.Delete, $"/{id}/reviews/me", alice, expected: 204);
    reviews = (await Send(HttpMethod.Get, $"/{id}/reviews", alice)).Body!;
    Check(reviews["totalCount"]!.GetValue<int>() == 1 && reviews["averageRating"]!.GetValue<double>() == 5 && reviews["myReview"] == null, "Deleting own review updates summary");
    var race = await Task.WhenAll(Send(HttpMethod.Put, $"/{legacy.Id}/reviews/me", alice, new { rating = 2 }, -1), Send(HttpMethod.Put, $"/{legacy.Id}/reviews/me", alice, new { rating = 4 }, -1));
    Check(race.All(r => r.Status is HttpStatusCode.OK or HttpStatusCode.Conflict), "Concurrent review saves never return a server error");
    place = (await Send(HttpMethod.Get, $"/{legacy.Id}")).Body!;
    Check(place["communityReviewCount"]!.GetValue<int>() == 1 && place["rating"]!.GetValue<double>() == 4.9 && place["totalReviews"]!.GetValue<int>() == 100, "Unique review constraint preserves imported ratings separately");
    var rejected = (await Send(HttpMethod.Post, "/contributions", alice, Place("Rejected cafe"), 201)).Body!["id"]!.GetValue<string>();
    await Send(HttpMethod.Put, $"/contributions/{rejected}/moderation", admin, new { status = 2 }, 400);
    await Send(HttpMethod.Put, $"/contributions/{rejected}/moderation", admin, new { status = 2, note = "Sai địa chỉ, vui lòng kiểm tra lại." }, 204);
    await Send(HttpMethod.Get, $"/{rejected}", expected: 404);
    var mine = (await Send(HttpMethod.Get, "/contributions/mine", alice)).Body!["items"]!.AsArray();
    Check(mine.Any(item => item!["id"]!.GetValue<string>() == rejected && item["moderationNote"]!.GetValue<string>().Contains("Sai địa chỉ")), "Submitter sees rejection reason");
    var concurrent = (await Send(HttpMethod.Post, "/contributions", alice, Place("Concurrent moderation"), 201)).Body!["id"]!.GetValue<string>();
    var decisions = await Task.WhenAll(
        Send(HttpMethod.Put, $"/contributions/{concurrent}/moderation", admin, new { status = 0 }, -1),
        Send(HttpMethod.Put, $"/contributions/{concurrent}/moderation", admin, new { status = 2, note = "Vị trí cần kiểm tra" }, -1));
    Check(decisions.Count(r => r.Status == HttpStatusCode.NoContent) == 1 && decisions.Count(r => r.Status == HttpStatusCode.Conflict) == 1, "Concurrent moderation cannot overwrite a completed decision");
    Console.WriteLine($"PASS: {passed} API/database assertions against real PostgreSQL and JWT authentication.");
}
finally
{
    if (server is { HasExited: false }) { server.Kill(entireProcessTree: true); await server.WaitForExitAsync(); }
    NpgsqlConnection.ClearAllPools();
    await using var drop = new NpgsqlCommand($"DROP DATABASE \"{database}\" WITH (FORCE)", adminDb);
    await drop.ExecuteNonQueryAsync();
}

void Check(bool condition, string message)
{
    if (!condition) throw new Exception("FAIL: " + message);
    passed++;
}

static UserEntity User(string id, EUser role) => new()
{
    Id = id, FullName = id, Email = id + "@example.invalid", PhoneNumber = "", PasswordHash = "not-used-by-jwt-tests",
    DateOfBirth = new DateTimeOffset(2000, 1, 1, 0, 0, 0, TimeSpan.Zero), Role = role, IsActive = true
};
