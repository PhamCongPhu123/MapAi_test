using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using MapAI.API.Controllers;
using MapAI.Application.Services;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Ai;
using MapAI.Domain.Models.Foursquare;
using MapAI.Domain.Models.Osm;
using MapAI.Infrastructure.Interfaces;
using MapAI.Infrastructure.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

var passed = 0;
void Check(bool condition, string message) { if (!condition) throw new Exception("FAIL: " + message); passed++; }
async Task Throws<T>(Func<Task> action, string message) where T : Exception
{
    try { await action(); } catch (T) { passed++; return; }
    throw new Exception("FAIL: " + message);
}
MapPlaceQuery Query(int limit = 10) => new() { Lat = 16.06, Lng = 108.22, Category = "fuel", Radius = 5000, Limit = limit };
var osm = new FakeOsm();
var locations = new FakeLocations();
var service = new MapService(osm, locations, NullLogger<MapService>.Instance);
locations.Items.AddRange(new[]
{
    new LocationEntity { Id = "local", Title = "Local station", Category = "Cây xăng", Latitude = 16.0601, Longitude = 108.22 },
    new LocationEntity { Id = "pending", Title = "Not approved", Category = "Cây xăng", Latitude = 16.06, Longitude = 108.22, Status = LocationStatus.Pending },
    new LocationEntity { Id = "cafe", Title = "Not a station", Category = "Cafe", Latitude = 16.06, Longitude = 108.22 }
});
osm.Items.AddRange(new[]
{
    new MapPlaceResult { Id = "far", Name = "Far station", Category = "fuel", Source = "openstreetmap", Lat = 16.09, Lng = 108.22 },
    new MapPlaceResult { Id = "near", Name = "Near station", Category = "fuel", Source = "openstreetmap", Lat = 16.06005, Lng = 108.22 },
    new MapPlaceResult { Id = "duplicate", Name = "Local station", Category = "fuel", Source = "openstreetmap", Lat = 16.06011, Lng = 108.22 },
    new MapPlaceResult { Id = "outside", Name = "Outside radius", Category = "fuel", Lat = 17, Lng = 108.22 },
    new MapPlaceResult { Id = "invalid", Name = "Invalid coordinates", Category = "fuel", Lat = double.NaN, Lng = 108.22 }
});
var found = await service.FindPlacesAsync(Query());
Check(found.Places.Count == 3, "Merge approved places, deduplicate and filter invalid/outside points");
Check(found.Places[0].Id == "near", "Nearest is calculated from coordinates, not provider ordering");
Check(found.Places.Any(p => p.LocationId == "local") && found.Places.All(p => p.Name != "Not approved" && p.Name != "Not a station"), "Local reviews retain identity, pending/category mismatches are excluded");
Check((await service.FindPlacesAsync(Query(1))).Places.Count == 1, "Limit applies after global distance sorting");
Check(found.DistanceBasis == "straight_line", "Distance basis is explicit");
Check(Math.Abs(MapDistance.Meters(0, 0, 0, 1) - 111195) < 2, "Haversine distance in meters");
Check(MapPlaceCategories.Find("cây xăng")?.Id == "fuel" && MapPlaceCategories.Find("gas station")?.Id == "fuel", "Vietnamese and English fuel aliases");
Check(MapPlaceCategories.Find("trạm sạc")?.Id == "charging_station", "EV charging is separate from fuel");
await Throws<ArgumentException>(() => service.FindPlacesAsync(new() { Category = "fuel" }), "Missing origin rejected");
await Throws<ArgumentException>(() => service.FindPlacesAsync(new() { Lat = 91, Lng = 108, Category = "fuel" }), "Invalid coordinate rejected");
await Throws<ArgumentException>(() => service.FindPlacesAsync(new() { Lat = 16, Lng = 108, Category = "fuel", Radius = 20001 }), "Excessive radius rejected");
await Throws<ArgumentException>(() => service.FindPlacesAsync(new() { Lat = 16, Lng = 108, Category = "fuel\"];out;" }), "QL text cannot become a category");
osm.Fail = true;
found = await service.FindPlacesAsync(Query());
Check(found.Places.Count == 1 && found.Warnings.Count == 1, "Provider failure returns local results with a partial-data warning");
locations.Fail = true;
await Throws<HttpRequestException>(() => service.FindPlacesAsync(Query()), "Both sources unavailable is an error, not a false empty result");
var controller = new MapController(service, null!, osm, NullLogger<MapController>.Instance);
var unavailable = (ObjectResult)await controller.FindNearest(Query(), CancellationToken.None);
Check(unavailable.StatusCode == 503, "MapController exposes source outage as 503");
locations.Fail = false; osm.Fail = false;
var route = await service.GetNearestDirectionAsync(new() { Lat = 16.06, Lng = 108.22, Category = "fuel", Mode = "foot" });
Check(route.Destination?.Id == "near" && route.Route != null && osm.LastMode == "foot", "Directions use the selected nearest destination and requested mode");
osm.RouteAvailable = false;
route = await service.GetNearestDirectionAsync(new() { Lat = 16.06, Lng = 108.22, Category = "fuel" });
Check(route.Route == null && route.Search.Warnings.Count == 1, "Unavailable route is disclosed without losing the POI");
await Throws<ArgumentException>(() => service.GetNearestDirectionAsync(new() { Lat = 16, Lng = 108, Category = "fuel", Mode = "plane" }), "Unsupported transport rejected");

var ai = new FakeAi();
var assistant = new AiService(ai, service, NullLogger<AiService>.Instance);
foreach (var (text, expected) in new[]
{
    ("tôi muốn tìm cây xăng gần nhất", "NEAREST_SEARCH"), ("nhà thuốc gần nhất", "NEAREST_SEARCH"),
    ("tìm ATM gần tôi", "SEARCH_POIS"), ("chỉ đường đến cây xăng gần nhất đi bộ", "ROUTE_TO_NEAREST"),
    ("phóng to bản đồ", "ZOOM_IN"), ("thu nhỏ", "ZOOM_OUT"), ("về vị trí của tôi", "LOCATE_USER"),
    ("quay về hướng Bắc", "RESET_NORTH"), ("xóa kết quả tìm kiếm", "CLEAR_RESULTS"), ("xóa tuyến đường", "CLEAR_ROUTE")
}) Check((await assistant.AskMapAIAsync(new() { UserInput = text })).Action?.Type == expected, "Natural command: " + text);
Check(ai.Calls == 0, "Unambiguous commands do not require a Gemini key or model request");
var response = await assistant.AskMapAIAsync(new() { UserInput = "tìm cây xăng gần nhất trong bán kính 2 km" });
Check(JsonSerializer.SerializeToElement(response.Action!.Value).GetProperty("radius").GetInt32() == 2000, "Kilometers converted to meters");
Check((await assistant.AskMapAIAsync(new() { UserInput = "cây xăng gần nhất trong bán kính 25 km" })).Action == null, "Excessive requested radius is not silently changed");
Check(MapCommandRouter.TryParse("tìm cây xăng gần nhất quanh Cầu Rồng") == null, "Named-center queries are not mistaken for current-location queries");
Check((await assistant.AskMapAIAsync(new() { UserInput = "chỉ đường đến đó" })).Action == null, "No guessed destination for unresolved follow-up");
Check((await assistant.AskMapAIAsync(new() { UserInput = "chỉ đường đến đó", SelectedLocation = new() { Name = "Explicit origin", Lat = 0, Lng = 0 } })).Action?.Type == "SET_DIRECTION", "Zero coordinates remain valid when explicitly selected");
ai.Json = """{"category":"action_map","action_type":"Around","search_query":"cafe","radius_meters":2000,"reference_location":"Cầu Rồng"}""";
response = await assistant.AskMapAIAsync(new() { UserInput = "Có cafe nào quanh Cầu Rồng trong phạm vi 2 km?" });
Check(response.Action?.Type == "SEARCH_POIS" && JsonSerializer.SerializeToElement(response.Action.Value).GetProperty("center").GetProperty("Lat").GetDouble() == 16.061, "Model named-center action is grounded in geocoder coordinates");
ai.Json = """{"category":"action_map","action_type":"RunJavaScript","search_query":"fuel"}""";
Check((await assistant.AskMapAIAsync(new() { UserInput = "complex unsupported action" })).Action == null, "Unknown model actions are not executable");
ai.Json = """{"category":"action_map","action_type":"Around","search_query":"fuel"}""";
Check((await assistant.AskMapAIAsync(new() { UserInput = "complex missing named center" })).Action == null, "Missing named center is clarified instead of silently using GPS");

var handler = new OverpassHandler();
using var http = new HttpClient(handler);
var repository = new OsmRepository(http, NullLogger<OsmRepository>.Instance);
var culture = CultureInfo.CurrentCulture;
CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("vi-VN");
try { await repository.SearchCategoryNearbyAsync(16.06, 108.22, "cây xăng", 5000); }
finally { CultureInfo.CurrentCulture = culture; }
Check(handler.Query.Contains("[\"amenity\"=\"fuel\"]") && handler.Query.Contains("around:5000,16.06,108.22"), "Fuel tag and invariant decimal coordinates in Overpass request");
Check(handler.Query.Contains("out body center;") && !handler.Query.Contains("out center 20"), "Node coordinates/tags and way centers are included without an arbitrary pre-ranking cap");
handler.Json = """{"remark":"runtime error: Query timed out","elements":[]}""";
await Throws<HttpRequestException>(() => repository.SearchCategoryNearbyAsync(16, 108, "fuel", 5000), "Partial Overpass response is not accepted as a complete empty search");
Console.WriteLine($"PASS: {passed} map-tool assertions (provider/model fixtures; no live Gemini call).");

sealed class FakeOsm : IOsmRepository
{
    public List<MapPlaceResult> Items { get; } = [];
    public bool Fail { get; set; }
    public bool RouteAvailable { get; set; } = true;
    public string? LastMode { get; set; }
    public Task<List<MapPlaceResult>> SearchCategoryNearbyAsync(double lat, double lng, string category, int radius, CancellationToken cancellationToken = default) => Fail ? throw new HttpRequestException("fixture outage") : Task.FromResult(Items.ToList());
    public Task<List<NominatimResult>?> SearchNominatimAsync(string query) => Task.FromResult<List<NominatimResult>?>([new() { Name = "Cầu Rồng", DisplayName = "Cầu Rồng, Đà Nẵng", Lat = "16.061", Lon = "108.227" }]);
    public Task<object?> GetRouteAsync(double startLat, double startLng, double endLat, double endLng, string mode = "driving") { LastMode = mode; return Task.FromResult<object?>(RouteAvailable ? new { distance = 100, duration = 30 } : null); }
    public Task<List<FoursquareNearbyResult>> SearchNearbyOverpassAsync(double lat, double lng, string query = "", int radius = 1000) => throw new NotSupportedException();
    public Task<List<FoursquareNearbyResult>> SearchCityWideOverpassAsync(string query = "") => throw new NotSupportedException();
}

sealed class FakeLocations : ILocationRepository
{
    public List<LocationEntity> Items { get; } = [];
    public bool Fail { get; set; }
    public Task<IEnumerable<LocationEntity>> GetByCoordinatesAsync(double lat, double lng, double epsilon = 0.00001) => Fail ? throw new HttpRequestException("fixture database outage") : Task.FromResult<IEnumerable<LocationEntity>>(Items);
    public Task<LocationEntity?> GetByIdAsync(string id) => throw new NotSupportedException();
    public Task<IEnumerable<LocationEntity>> GetAllAsync() => throw new NotSupportedException();
    public Task<IEnumerable<LocationEntity>> SearchByTitleAsync(string title) => throw new NotSupportedException();
    public Task<IEnumerable<LocationEntity>> GetPagedAsync(int pageNumber, int pageSize) => throw new NotSupportedException();
    public Task<int> GetCountAsync() => throw new NotSupportedException();
    public Task<LocationEntity> AddAsync(LocationEntity location) => throw new NotSupportedException();
    public Task UpdateAsync(LocationEntity location) => throw new NotSupportedException();
    public Task DeleteAsync(string id) => throw new NotSupportedException();
    public Task<bool> ExistsAsync(string id) => throw new NotSupportedException();
}

sealed class FakeAi : IAiRepository
{
    public int Calls { get; private set; }
    public string Json { get; set; } = """{"category":"error"}""";
    public Task<string> CallGeminiAsync(string systemPrompt, object responseSchema, string userMessage, List<ChatMessage>? chatHistory = null, double temperature = 0.3) { Calls++; return Task.FromResult(Json); }
}

sealed class OverpassHandler : HttpMessageHandler
{
    public string Query { get; private set; } = "";
    public string Json { get; set; } = """{"elements":[{"type":"node","id":1,"lat":16.06,"lon":108.22,"tags":{"amenity":"fuel","name":"Petrol station"}}]}""";
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Query = WebUtility.UrlDecode(await request.Content!.ReadAsStringAsync(cancellationToken));
        return new(HttpStatusCode.OK) { Content = new StringContent(Json, Encoding.UTF8, "application/json") };
    }
}
