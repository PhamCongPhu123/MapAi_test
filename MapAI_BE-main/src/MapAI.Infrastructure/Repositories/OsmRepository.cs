using System.Globalization;
using System.Text.Json;
using System.Web;
using MapAI.Domain.Models.Osm;
using MapAI.Domain.Models.Foursquare;
using MapAI.Infrastructure.Interfaces;
using Microsoft.Extensions.Logging;

namespace MapAI.Infrastructure.Repositories
{
    public class OsmRepository : IOsmRepository
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<OsmRepository> _logger;
        private const string NominatimBaseUrl = "https://nominatim.openstreetmap.org/search";
        private const string RoutingBaseUrl = "https://routing.openstreetmap.de";
        private const string OverpassBaseUrl = "https://overpass-api.de/api/interpreter";

        public OsmRepository(HttpClient httpClient, ILogger<OsmRepository> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            
            _httpClient.DefaultRequestHeaders.UserAgent.Clear();
            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MapAI-Assistant/1.1");
        }
        // ✅ FIXED VERSION - Overpass stable + safe query

        public async Task<List<MapPlaceResult>> SearchCategoryNearbyAsync(double lat, double lng, string category, int radius, CancellationToken cancellationToken = default)
        {
            var definition = MapPlaceCategories.Find(category) ?? throw new ArgumentException("Loại địa điểm không được hỗ trợ.");
            if (!MapDistance.Valid(lat, lng) || radius is < 100 or > 20000) throw new ArgumentException("Tọa độ hoặc bán kính không hợp lệ.");
            var center = $"{radius},{lat.ToString(CultureInfo.InvariantCulture)},{lng.ToString(CultureInfo.InvariantCulture)}";
            var filters = string.Join("", definition.Filters.Select(filter => $"nwr{filter}(around:{center});"));
            // Retrieve every matching POI in the bounded radius before sorting by distance.
            // A server-side `out ... 20` limit would select arbitrary rows, not the closest 20.
            var query = $"[out:json][timeout:25];({filters});out body center;";
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(30));
            using var body = new FormUrlEncodedContent(new[] { new KeyValuePair<string, string>("data", query) });
            using var response = await _httpClient.PostAsync(OverpassBaseUrl, body, timeout.Token);
            response.EnsureSuccessStatusCode();
            await using var stream = await response.Content.ReadAsStreamAsync(timeout.Token);
            var data = await JsonSerializer.DeserializeAsync<OverpassResponse>(stream, cancellationToken: timeout.Token);
            if (data?.Elements == null || !string.IsNullOrWhiteSpace(data.Remark)) throw new HttpRequestException("Overpass không trả về danh sách địa điểm đầy đủ.");
            return data.Elements.Where(e => (e.Lat.HasValue && e.Lon.HasValue) || e.Center != null).Select(e =>
            {
                var tags = e.Tags ?? new Dictionary<string, string>();
                return new MapPlaceResult
                {
                    Id = $"osm:{e.Type}:{e.Id}", Source = "openstreetmap", Category = definition.Id,
                    Name = tags.GetValueOrDefault("name") ?? tags.GetValueOrDefault("brand") ?? $"{definition.Name} (chưa có tên)",
                    Address = tags.GetValueOrDefault("addr:full") ?? string.Join(" ", new[] { tags.GetValueOrDefault("addr:housenumber"), tags.GetValueOrDefault("addr:street") }.Where(s => !string.IsNullOrWhiteSpace(s))),
                    Lat = e.Lat ?? e.Center!.Lat, Lng = e.Lon ?? e.Center!.Lon
                };
            }).Where(p => MapDistance.Valid(p.Lat, p.Lng)).ToList();
        }

        public async Task<List<FoursquareNearbyResult>> SearchNearbyOverpassAsync(double lat, double lng, string query = "", int radius = 1000)
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                string latStr = lat.ToString(CultureInfo.InvariantCulture);
                string lngStr = lng.ToString(CultureInfo.InvariantCulture);
                var safeQuery = query?.Replace("\"", "").Trim();

                string poiSearch;

                if (MapPlaceCategories.FindForBrowse(safeQuery) is { } category)
                {
                    poiSearch = string.Join("", category.Filters.Select(filter => $"nwr{filter}(around:{radius},{latStr},{lngStr});"));
                }
                else if (string.IsNullOrEmpty(safeQuery))
                {
                    poiSearch =
                        $"nwr[amenity](around:{radius},{latStr},{lngStr});" +
                        $"nwr[shop](around:{radius},{latStr},{lngStr});" +
                        $"nwr[tourism](around:{radius},{latStr},{lngStr});" +
                        $"nwr[leisure](around:{radius},{latStr},{lngStr});";
                }
                else
                {
                    poiSearch =
                        $"nwr[\"name\"~\"{safeQuery}\",i](around:{radius},{latStr},{lngStr});" +
                        $"nwr[\"amenity\"~\"{safeQuery}\",i](around:{radius},{latStr},{lngStr});" +
                        $"nwr[\"shop\"~\"{safeQuery}\",i](around:{radius},{latStr},{lngStr});" +
                        $"nwr[\"tourism\"~\"{safeQuery}\",i](around:{radius},{latStr},{lngStr});";
                }

                string overpassQuery = $"[out:json][timeout:25];({poiSearch});out center 20;";

                var content = new FormUrlEncodedContent(new[]
                {
            new KeyValuePair<string, string>("data", overpassQuery)
        });

                var response = await _httpClient.PostAsync(OverpassBaseUrl, content);
                stopwatch.Stop();

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("[Nearby] Overpass error {Status}: {Body}", (int)response.StatusCode, errorBody);
                    response.EnsureSuccessStatusCode();
                }

                var json = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<OverpassResponse>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (data?.Elements == null || !string.IsNullOrWhiteSpace(data.Remark)) throw new HttpRequestException("Overpass không trả về danh sách địa điểm đầy đủ.");

                return data?.Elements?
                    .Where(e => e.Lat != null || e.Center != null)
                    .Select(e => new FoursquareNearbyResult
                    {
                        FsqId = $"osm:{e.Type}:{e.Id}",
                        Source = "openstreetmap",
                        Name = e.Tags?.GetValueOrDefault("name") ?? "OSM Place",
                        Lat = e.Lat ?? e.Center?.Lat ?? 0,
                        Lng = e.Lon ?? e.Center?.Lon ?? 0,
                        Type = "osm_place"
                    }).ToList() ?? new List<FoursquareNearbyResult>();
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex, "[Nearby] Overpass Exception");
                throw new HttpRequestException("Nguồn OpenStreetMap đang không khả dụng.", ex);
            }
        }


        // ✅ FIXED CITY WIDE
        public async Task<List<FoursquareNearbyResult>> SearchCityWideOverpassAsync(string query = "")
        {
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            try
            {
                string bbox = DaNangBounds.Overpass;
                var safeQuery = query?.Replace("\"", "").Trim();

                string poiSearch;

                if (MapPlaceCategories.FindForBrowse(safeQuery) is { } category)
                {
                    poiSearch = string.Join("", category.Filters.Select(filter => $"nwr{filter}({bbox});"));
                }
                else if (string.IsNullOrEmpty(safeQuery))
                {
                    poiSearch =
                        $"nwr[amenity]({bbox});" +
                        $"nwr[shop]({bbox});" +
                        $"nwr[tourism]({bbox});" +
                        $"nwr[leisure]({bbox});";
                }
                else
                {
                    poiSearch =
                        $"nwr[\"name\"~\"{safeQuery}\",i]({bbox});" +
                        $"nwr[\"amenity\"~\"{safeQuery}\",i]({bbox});" +
                        $"nwr[\"shop\"~\"{safeQuery}\",i]({bbox});" +
                        $"nwr[\"tourism\"~\"{safeQuery}\",i]({bbox});";
                }

                string overpassQuery = $"[out:json][timeout:30];({poiSearch});out center 50;";

                var content = new FormUrlEncodedContent(new[]
                {
            new KeyValuePair<string, string>("data", overpassQuery)
        });

                var response = await _httpClient.PostAsync(OverpassBaseUrl, content);
                stopwatch.Stop();

                if (!response.IsSuccessStatusCode)
                {
                    var errorBody = await response.Content.ReadAsStringAsync();
                    _logger.LogError("[CityWide] Overpass error {Status}: {Body}", (int)response.StatusCode, errorBody);
                    response.EnsureSuccessStatusCode();
                }

                var json = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<OverpassResponse>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (data?.Elements == null || !string.IsNullOrWhiteSpace(data.Remark)) throw new HttpRequestException("Overpass không trả về danh sách địa điểm đầy đủ.");

                return data?.Elements?
                    .Where(e => e.Lat != null || e.Center != null)
                    .Select(e => new FoursquareNearbyResult
                    {
                        FsqId = $"osm:{e.Type}:{e.Id}",
                        Source = "openstreetmap",
                        Name = e.Tags?.GetValueOrDefault("name") ?? "OSM Place",
                        Lat = e.Lat ?? e.Center?.Lat ?? 0,
                        Lng = e.Lon ?? e.Center?.Lon ?? 0,
                        Type = "osm_city_place"
                    }).ToList() ?? new List<FoursquareNearbyResult>();
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(ex, "[CityWide] Overpass Exception");
                throw new HttpRequestException("Nguồn OpenStreetMap đang không khả dụng.", ex);
            }
        }
        public async Task<List<NominatimResult>?> SearchNominatimAsync(string query)
        {
            try
            {
                // Bounding box Đà Nẵng (xấp xỉ): 107.81,16.22 (Tây Bắc) và 108.49,15.88 (Đông Nam)
                string viewbox = "107.81,16.22,108.49,15.88";
                var url = $"{NominatimBaseUrl}?format=json&q={HttpUtility.UrlEncode(query)}&limit=5&addressdetails=1&viewbox={viewbox}&bounded=1&countrycodes=vn";

                var response = await _httpClient.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return JsonSerializer.Deserialize<List<NominatimResult>>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }
                
                _logger.LogWarning("Nominatim API error: {Status}", response.StatusCode);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching with Nominatim for query: {Query}", query);
                return null;
            }
        }

        public async Task<object?> GetRouteAsync(double startLat, double startLng, double endLat, double endLng, string mode = "driving")
        {
            try
            {
                string serverPrefix = mode switch
                {
                    "bicycle" => "routed-bike",
                    "foot" => "routed-foot",
                    _ => "routed-car"
                };
                string profile = mode switch
                {
                    "bicycle" => "bicycle",
                    "foot" => "foot",
                    _ => "driving"
                };

                // OSRM: coordinates as lng,lat;lng,lat
                string url = $"{RoutingBaseUrl}/{serverPrefix}/route/v1/{profile}/{startLng.ToString(CultureInfo.InvariantCulture)},{startLat.ToString(CultureInfo.InvariantCulture)};{endLng.ToString(CultureInfo.InvariantCulture)},{endLat.ToString(CultureInfo.InvariantCulture)}?overview=full&geometries=geojson&steps=true";

                var response = await _httpClient.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(content);
                    if (doc.RootElement.TryGetProperty("code", out var code) && code.GetString() == "Ok")
                    {
                        // Trả về route đầu tiên
                        return JsonSerializer.Deserialize<object>(doc.RootElement.GetProperty("routes")[0].GetRawText());
                    }
                }

                _logger.LogWarning("OSRM Routing API error: {Status}", response.StatusCode);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching OSM route from {Start} to {End}", $"{startLat},{startLng}", $"{endLat},{endLng}");
                return null;
            }
        }
    }
}
