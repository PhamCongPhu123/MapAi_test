using Microsoft.EntityFrameworkCore.Infrastructure;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Places;
using MapAI.Domain.Ports;
using MapAI.Infrastructure.Persistence;
using MapAI.Infrastructure.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Npgsql;

var connection = new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MAPAI_TEST_CONNECTION") ?? throw new Exception("Set MAPAI_TEST_CONNECTION to local PostgreSQL."));
if (connection.Host is not ("localhost" or "127.0.0.1" or "::1")) throw new Exception("Tests only accept local disposable databases.");
connection.Database = "postgres";
await using var admin = new NpgsqlConnection(connection.ConnectionString); await admin.OpenAsync();
var database = "mapai_unified_" + Guid.NewGuid().ToString("N");
await using (var command = new NpgsqlCommand($"CREATE DATABASE \"{database}\" TEMPLATE template0 ENCODING 'UTF8' LOCALE_PROVIDER icu ICU_LOCALE 'und'", admin)) await command.ExecuteNonQueryAsync();
connection.Database = database;
var options = new DbContextOptionsBuilder<MapAIContext>().UseNpgsql(connection.ConnectionString).Options;
var passed = 0;
const string key = "test-unified-only-signing-key-must-never-use-in-production";
var setting = "ASPNETCORE_TEST_CONTENTROOT_MAPAI_API";
var previous = Environment.GetEnvironmentVariable(setting);
Environment.SetEnvironmentVariable(setting, Path.GetFullPath("../../../../../src/MapAI.API", AppContext.BaseDirectory));
try
{
    using (var cached = new OsmSearchCache())
    {
        var handler = new OsmHttpFixture();
        var adapter = new UnifiedOsmSource(new HttpClient(handler), cached);
        var online = await adapter.SearchAsync("Bến xe buýt Việt Hàn", default);
        Check(online.Count == 1 && online[0].CanonicalId == "osm:node:100", "Photon fallback maps original OSM identity when Overpass fails");
        online[0].Name = "Caller mutated copy";
        Check((await adapter.SearchAsync("Bến xe buýt Việt Hàn", default))[0].Name == "Bến xe buýt Việt Hàn", "Public cache returns independent snapshots");
        Check((await adapter.ResolveAsync("node", "100", default))?.CanonicalId == "osm:node:100" && handler.Lookups == 0, "An explicit interaction reuses a trusted upstream search identity");
        Check(await adapter.ResolveAsync("node", "999", default) == null, "Lookup rejects a provider response with mismatched OSM ID");
    }
    await using var db = new MapAIContext(options);
    // Simulate a pre-feature database, then verify the migration actually backfills accented names.
    var migrator = db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>();
    await migrator.MigrateAsync("20261115040252_AddAccountSync");
    await db.Database.ExecuteSqlRawAsync("""INSERT INTO "Locations" ("Id", "Title", "Latitude", "Longitude", "Status", "IsUserContribution", "IsDeleted", "CreatedAt") VALUES ('backfill', 'Bến xe buýt Việt Hàn', 15.977, 108.252, 0, false, false, NOW())""");
    await db.Database.MigrateAsync();
    Check((await db.Locations.SingleAsync(l => l.Id == "backfill")).NormalizedName == "ben xe buyt viet han", "Migration backfills Vietnamese search keys");
    db.Locations.RemoveRange(db.Locations); await db.SaveChangesAsync();
    var alice = new UserEntity { Id = Guid.NewGuid().ToString(), PhoneNumber = "", FullName = "Alice", Email = "alice@mapai.test", PasswordHash = "test-hash", IsActive = true, Role = EUser.User };
    var bob = new UserEntity { Id = Guid.NewGuid().ToString(), PhoneNumber = "", FullName = "Bob", Email = "bob@mapai.test", PasswordHash = "test-hash", IsActive = true, Role = EUser.User };
    db.Users.AddRange(alice, bob);
    db.AccountTokens.AddRange(new[] { alice, bob }.Select(u => new AccountTokenEntity { UserId = u.Id, TokenHash = "test-only", Type = ETokenType.RefreshToken, ExpiresAt = DateTimeOffset.UtcNow.AddDays(1) }));
    var curated = new LocationEntity { Title = "Trường Đại học MapAI", Latitude = 16.061, Longitude = 108.221, Category = "university", Description = "Mô tả biên tập", Thumbnail = "https://example.test/photo.jpg" };
    db.Locations.Add(curated); await db.SaveChangesAsync();
    var source = new OsmFixture();
    await using var factory = new ApiFactory(connection.ConnectionString, key, source);
    using var api = factory.CreateClient();
    var jwt = new JwtRepository(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Jwt:Secret"] = key }).Build());
    string Token(UserEntity user) => jwt.GenerateAccessToken(user);
    async Task<JsonNode> Search(string q) {
        using var response = await api.GetAsync("/api/v1/map/unified-search?q=" + Uri.EscapeDataString(q));
        Check(response.IsSuccessStatusCode, "Unified search HTTP succeeds"); return JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
    }
    var result = await Search("dai hoc");
    var merged = result["places"]!.AsArray();
    Check(merged.Count == 2, "Cross-source same name within 50m becomes one card");
    var rich = merged.Single(p => p!["mapaiId"]?.GetValue<string>() == curated.Id)!;
    Check(rich["description"]!.GetValue<string>() == "Mô tả biên tập" && rich["lat"]!.GetValue<double>() == 16.0611, "Dedup preserves MapAI richness and OSM coordinates");
    Check(rich["sourceType"]!.GetValue<string>() == "mapai_curated", "Linked coordinates do not change curated source identity");
    Check(await db.OsmPlaceReferences.CountAsync() == 0 && await db.Locations.CountAsync() == 1, "Search does not lazy import");
    using var chat = await api.PostAsJsonAsync("/api/v1/ai/ask", new { userInput = "Chỉ đường đến bến xe buýt Việt Hàn" });
    var answer = JsonNode.Parse(await chat.Content.ReadAsStringAsync())!;
    Check(chat.IsSuccessStatusCode && answer["places"]!.AsArray().Count > 0 && answer["action"]!["type"]!.GetValue<string>() == "LOCAL_DIRECTIONS", "Chat utilities use the same federated search without Gemini");
    Check(await db.OsmPlaceReferences.CountAsync() == 0, "Chat and directions do not import OSM");
    using var detail = await api.GetAsync("/api/v1/location/osm:node:100");
    Check(detail.StatusCode == HttpStatusCode.NotFound && await db.OsmPlaceReferences.CountAsync() == 0, "Browsing an unknown canonical OSM ID cannot create a DB row");
    source.Fail = true;
    var partial = await Search("dai hoc");
    Check(partial["warnings"]!.AsArray().Count == 1 && partial["sourceStatus"]!["osm"]!.GetValue<string>() == "unavailable", "Provider failure returns partial MapAI results honestly");
    source.Fail = false;
    var place = new { key = "osm:node:100", canonicalId = "osm:node:100", osmType = "node", osmId = "100", sourceType = "openstreetmap", name = "Untrusted client label", lat = 0.0, lng = 0.0 };
    async Task<(HttpStatusCode Status, JsonNode? Json)> Sync(UserEntity user, object operation) {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/sync/operations") { Content = JsonContent.Create(operation) };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token(user));
        using var response = await api.SendAsync(request); return (response.StatusCode, JsonNode.Parse(await response.Content.ReadAsStringAsync()));
    }
    var id = Guid.NewGuid(); var operation = new { id, kind = "favorite", payload = new { place, deleted = false } };
    var favorite = await Sync(alice, operation);
    Check(favorite.Status == HttpStatusCode.OK, "Favorite creates the reference in its account transaction");
    var mapaiId = favorite.Json!["mapaiLocationId"]!.GetValue<string>();
    var stored = await db.Locations.AsNoTracking().SingleAsync(l => l.Id == mapaiId);
    using (var getFavorite = new HttpRequestMessage(HttpMethod.Get, "/api/v1/sync/favorites")) {
        getFavorite.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Token(alice));
        using var favoriteResponse = await api.SendAsync(getFavorite);
        var rows = JsonNode.Parse(await favoriteResponse.Content.ReadAsStringAsync())!.AsArray();
        Check(rows[0]!["place"]!["lat"]!.GetValue<double>() == 15.9777, "Cloud favorites carry verified coordinates on other devices");
    }
    Check(stored.Title == "Bến xe buýt Việt Hàn" && stored.Latitude == 15.9777 && stored.IsOsmReference, "Only verified provider fields become public");
    var replay = await Sync(alice, operation);
    Check(replay.Status == HttpStatusCode.OK && replay.Json!["mapaiLocationId"]!.GetValue<string>() == mapaiId, "Lost response replay returns the same mapping");
    await Sync(bob, new { id = Guid.NewGuid(), kind = "favorite", payload = new { place, deleted = false } });
    Check(await db.OsmPlaceReferences.CountAsync() == 1 && await db.AccountFavorites.CountAsync() == 2, "Two accounts share one OSM reference but keep private favorites");
    var review = new { id = Guid.NewGuid(), kind = "review", locationId = "osm:node:100", place, payload = new { rating = 5, comment = "Từ offline" } };
    var saved = await Sync(alice, review); await Sync(alice, review);
    Check(saved.Status == HttpStatusCode.OK && await db.LocationReviews.CountAsync(r => r.LocationId == mapaiId) == 1, "Canonical OSM review resolves once and replays idempotently");
    var curatedOsm = new { key = "osm:way:200", canonicalId = "osm:way:200", osmType = "way", osmId = "200", name = "Trường Đại học MapAI", lat = 16.0611, lng = 108.221 };
    var linked = await Sync(alice, new { id = Guid.NewGuid(), kind = "favorite", payload = new { place = curatedOsm, deleted = false } });
    Check(linked.Json!["mapaiLocationId"]!.GetValue<string>() == curated.Id && await db.Locations.CountAsync() == 2, "Lazy import links a matching curated place instead of duplicating it");
    var unknown = new { key = "osm:node:999", osmType = "node", osmId = "999", name = "Forged", lat = 16.0, lng = 108.2 };
    Check((await Sync(alice, new { id = Guid.NewGuid(), kind = "favorite", payload = new { place = unknown, deleted = false } })).Status == HttpStatusCode.NotFound, "Unknown OSM identities cannot publish forged client coordinates");
    Check((await Sync(alice, new { id = Guid.NewGuid(), kind = "favorite", payload = new { place = unknown, deleted = true } })).Status == HttpStatusCode.OK && await db.OsmPlaceReferences.CountAsync() == 2, "Deleting an uncatalogued favorite does not create a reference");
    var reviewOnlyPlace = new { key = "osm:node:300", canonicalId = "osm:node:300", osmType = "node", osmId = "300", name = "ATM kiểm thử", lat = 16.06, lng = 108.225 };
    var reviewOnly = await Sync(bob, new { id = Guid.NewGuid(), kind = "review", locationId = reviewOnlyPlace.key, place = reviewOnlyPlace, payload = new { rating = 4, comment = "First interaction is a review" } });
    Check(reviewOnly.Status == HttpStatusCode.OK && await db.OsmPlaceReferences.AnyAsync(r => r.CanonicalId == reviewOnlyPlace.key), "Review can be the first lazy-import interaction");
    var racePlace = new { key = "osm:node:400", canonicalId = "osm:node:400", osmType = "node", osmId = "400", name = "Bến xe Đồng thời", lat = 16.08, lng = 108.21 };
    var races = await Task.WhenAll(new[] { alice, bob }.Select(u => Sync(u, new { id = Guid.NewGuid(), kind = "favorite", payload = new { place = racePlace, deleted = false } })));
    Check(races.All(r => r.Status == HttpStatusCode.OK) && await db.OsmPlaceReferences.CountAsync(r => r.CanonicalId == racePlace.key) == 1, "Concurrent accounts create only one global OSM reference");
    await db.Locations.Where(l => l.Id == mapaiId).ExecuteUpdateAsync(update => update.SetProperty(l => l.IsDeleted, true));
    Check((await Sync(bob, new { id = Guid.NewGuid(), kind = "favorite", payload = new { place, deleted = false } })).Status == HttpStatusCode.NotFound, "Hidden references cannot be recreated through OSM");
    var reads = source.ResolveCalls;
    using var c = await api.GetAsync("/api/v1/sync/catalog");
    Check((await c.Content.ReadAsStringAsync()).Contains("osm:node:300") && source.ResolveCalls == reads, "Public catalog preserves canonical OSM IDs without provider lookups");
    Console.WriteLine($"Passed {passed} unified-place assertions.");
}
finally
{
    Environment.SetEnvironmentVariable(setting, previous);
    NpgsqlConnection.ClearAllPools();
    await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{database}\" WITH (FORCE)", admin); await drop.ExecuteNonQueryAsync();
}
void Check(bool value, string message) { if (!value) throw new Exception(message); passed++; Console.WriteLine("PASS " + message); }

sealed class ApiFactory(string connection, string signingKey, OsmFixture source) : WebApplicationFactory<MapAI.API.Controllers.MapController>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) {
        builder.UseEnvironment("Development"); builder.UseSetting("ConnectionStrings:DefaultConnection", connection); builder.UseSetting("Jwt:Secret", signingKey);
        builder.ConfigureLogging(l => l.ClearProviders());
        builder.ConfigureServices(services => { services.RemoveAll<IUnifiedOsmSource>(); services.AddSingleton<IUnifiedOsmSource>(source); });
    }
}
sealed class OsmFixture : IUnifiedOsmSource
{
    public bool Fail; public int ResolveCalls;
    private List<UnifiedPlace> Data() => [
        new() { CanonicalId = "osm:node:100", SourceType = "openstreetmap", OsmType = "node", OsmId = "100", Name = "Bến xe buýt Việt Hàn", NormalizedName = "ben xe buyt viet han", Lat = 15.9777, Lng = 108.252, CategoryMapping = "bus", Aliases = ["osm:node:100"] },
        new() { CanonicalId = "osm:node:300", SourceType = "openstreetmap", OsmType = "node", OsmId = "300", Name = "ATM kiểm thử", Lat = 16.06, Lng = 108.225, CategoryMapping = "atm" },
        new() { CanonicalId = "osm:node:400", SourceType = "openstreetmap", OsmType = "node", OsmId = "400", Name = "Bến xe Đồng thời", Lat = 16.08, Lng = 108.21, CategoryMapping = "bus" },
        new() { CanonicalId = "osm:way:200", SourceType = "openstreetmap", OsmType = "way", OsmId = "200", Name = "Trường Đại học MapAI", NormalizedName = "truong dai hoc mapai", Lat = 16.0611, Lng = 108.221, CategoryMapping = "university", Aliases = ["osm:way:200"] }
    ];
    public Task<List<UnifiedPlace>> SearchAsync(string query, CancellationToken token) => Fail ? throw new HttpRequestException("test unavailable") : Task.FromResult(Data().Take(1).Concat(Data().Where(p => p.OsmId == "200")).ToList());
    public Task<UnifiedPlace?> ResolveAsync(string type, string id, CancellationToken token) { ResolveCalls++; return Task.FromResult(Data().SingleOrDefault(p => p.OsmType == type && p.OsmId == id)); }
}

sealed class OsmHttpFixture : HttpMessageHandler
{
    public int Lookups;
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken token)
    {
        if (request.RequestUri!.Host.Contains("overpass")) return Task.FromResult(new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        string body;
        if (request.RequestUri.Host.Contains("photon")) body = """{"features":[{"geometry":{"type":"Point","coordinates":[108.252,15.9777]},"properties":{"osm_type":"N","osm_id":100,"osm_key":"highway","osm_value":"bus_stop","name":"Bến xe buýt Việt Hàn"}}]}""";
        else { Lookups++; body = """[{"osm_type":"node","osm_id":998,"lat":"15.97","lon":"108.25","name":"Mismatched"}]"""; }
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) });
    }
}
