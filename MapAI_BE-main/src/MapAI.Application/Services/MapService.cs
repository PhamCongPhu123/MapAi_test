using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Osm;
using MapAI.Domain.Models.Foursquare;
using MapAI.Domain.Entities;
using MapAI.Infrastructure.Interfaces;
using MapAI.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace MapAI.Application.Services
{
    public class MapService : IMapService
    {
        private readonly IOsmRepository _osmRepository;
        private readonly ILocationRepository _locations;
        private readonly ILogger<MapService> _logger;
        private readonly IFoursquareService _foursquareService;

        public MapService(IOsmRepository osmRepository, ILocationRepository locations, ILogger<MapService> logger, IFoursquareService foursquareService)
        {
            _osmRepository = osmRepository;
            _locations = locations;
            _logger = logger;
            _foursquareService = foursquareService;
        }

        public Task<List<FoursquareNearbyResult>> SearchNearbyPlacesAsync(double lat, double lng, string query, int radius)
        {
            if (!MapDistance.Valid(lat, lng) || radius is < 100 or > 20000)
                throw new ArgumentException("Tọa độ hoặc bán kính không hợp lệ.");
            return SearchBrowsePlacesAsync(lat, lng, query, radius, cityWide: false);
        }

        public Task<List<FoursquareNearbyResult>> SearchCityWidePlacesAsync(string query) =>
            SearchBrowsePlacesAsync((DaNangBounds.South + DaNangBounds.North) / 2,
                (DaNangBounds.West + DaNangBounds.East) / 2, query, 15000, cityWide: true);

        private async Task<List<FoursquareNearbyResult>> SearchBrowsePlacesAsync(double lat, double lng, string query, int radius, bool cityWide)
        {
            if (query.Length > 100) throw new ArgumentException("Từ khóa tìm kiếm quá dài.");
            var results = new List<FoursquareNearbyResult>();
            var localAvailable = false;
            var externalAvailable = false;
            try
            {
                var epsilon = cityWide ? Math.Max(DaNangBounds.North - DaNangBounds.South, DaNangBounds.East - DaNangBounds.West) / 2
                    : Math.Min(360, radius / (110000 * Math.Max(0.0001, Math.Cos(lat * Math.PI / 180))));
                if (!cityWide && (lng - epsilon < -180 || lng + epsilon > 180)) epsilon = 360;
                var local = await _locations.GetByCoordinatesAsync(lat, lng, epsilon);
                results.AddRange(local.Where(p => p.Status == LocationStatus.Approved && !p.IsDeleted && MatchesBrowseQuery(p, query))
                    .Select(p => new FoursquareNearbyResult
                    {
                        FsqId = $"mapai:{p.Id}", LocationId = p.Id, Source = "mapai", Type = "mapai_place",
                        Name = p.Title, DisplayName = p.Address ?? "", Lat = p.Latitude, Lng = p.Longitude,
                        Categories = [new() { Name = MapPlaceCategories.FindForBrowse(p.Category)?.Id ?? p.Category ?? "" }]
                    }));
                localAvailable = true;
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                _logger.LogWarning(error, "MapAI category search source unavailable");
            }

            var external = new List<FoursquareNearbyResult>();
            try
            {
                external = cityWide ? await _osmRepository.SearchCityWideOverpassAsync(query)
                    : await _osmRepository.SearchNearbyOverpassAsync(lat, lng, query, radius);
                externalAvailable = true;
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                _logger.LogWarning(error, "OpenStreetMap category search source unavailable");
            }
            if (external.Count == 0)
            {
                try
                {
                    external = await _foursquareService.GetNearbyPlacesAsync(new()
                    {
                        Lat = cityWide ? 16.0544 : lat, Lng = cityWide ? 108.2022 : lng, Query = query, Radius = radius
                    });
                    externalAvailable = true;
                }
                catch (Exception error) when (error is not OperationCanceledException)
                {
                    _logger.LogWarning(error, "Foursquare category search source unavailable");
                }
            }
            if (!localAvailable && !externalAvailable)
                throw new HttpRequestException("Các nguồn địa điểm đang không khả dụng. Vui lòng thử lại sau.");

            // Prefer the stored place when OSM/Foursquare also contains the same POI, so
            // its details and reviews open by MapAI ID rather than by an ambiguous name.
            var unique = new List<FoursquareNearbyResult>();
            foreach (var place in results.Concat(external).Where(p => MapDistance.Valid(p.Lat, p.Lng)))
            {
                if (cityWide ? !DaNangBounds.Contains(place.Lat, place.Lng) : MapDistance.Meters(lat, lng, place.Lat, place.Lng) > radius) continue;
                if (unique.Any(p => (!string.IsNullOrEmpty(place.FsqId) && p.FsqId == place.FsqId)
                    || (MapPlaceCategories.Normalize(p.Name) == MapPlaceCategories.Normalize(place.Name)
                        && MapDistance.Meters(p.Lat, p.Lng, place.Lat, place.Lng) <= 30))) continue;
                unique.Add(place);
            }
            return unique;
        }

        private static bool MatchesBrowseQuery(LocationEntity place, string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return true;
            var category = MapPlaceCategories.FindForBrowse(query);
            if (category != null)
            {
                var stored = MapPlaceCategories.FindForBrowse(place.Category)?.Id;
                return stored == category.Id || (category.Id == "bank_atm" && stored == "atm");
            }
            var text = MapPlaceCategories.Normalize(query);
            return MapPlaceCategories.Normalize(place.Category ?? "").Contains(text)
                || MapPlaceCategories.Normalize(place.Title).Contains(text)
                || MapPlaceCategories.Normalize(place.Tags ?? "").Contains(text);
        }

        public async Task<List<NominatimResult>?> SearchLocationsAsync(string query)
        {
            // Có thể thêm logic xử lý query tại đây (ví dụ: chuẩn hóa chuỗi)
            return await _osmRepository.SearchNominatimAsync(query);
        }

        public async Task<object?> GetDirectionAsync(OsmRouteRequest request)
        {
            // Gọi repository để lấy lộ trình
            return await _osmRepository.GetRouteAsync(
                request.StartLat, 
                request.StartLng, 
                request.EndLat, 
                request.EndLng, 
                request.Mode);
        }

        public async Task<MapPlaceSearchResult> FindPlacesAsync(MapPlaceQuery request, CancellationToken cancellationToken = default)
        {
            var category = MapPlaceCategories.Find(request.Category) ?? throw new ArgumentException("Loại địa điểm không được hỗ trợ. Hãy xem /map/categories.");
            if (!request.Lat.HasValue || !request.Lng.HasValue || !MapDistance.Valid(request.Lat.Value, request.Lng.Value)
                || request.Radius is < 100 or > 20000 || request.Limit is < 1 or > 50) throw new ArgumentException("Tọa độ, bán kính hoặc giới hạn kết quả không hợp lệ.");
            var lat = request.Lat.Value;
            var lng = request.Lng.Value;
            var response = new MapPlaceSearchResult { Category = category.Id, CategoryName = category.Name, Radius = request.Radius };
            var candidates = new List<MapPlaceResult>();
            var availableSources = 0;
            try
            {
                // Broad bounding box, followed by exact Haversine filtering below.
                var epsilon = Math.Min(360, request.Radius / (110000 * Math.Max(0.0001, Math.Cos(lat * Math.PI / 180))));
                if (lng - epsilon < -180 || lng + epsilon > 180) epsilon = 360;
                var places = await _locations.GetByCoordinatesAsync(lat, lng, epsilon);
                candidates.AddRange(places.Where(p => p.Status == LocationStatus.Approved && !p.IsDeleted && MapPlaceCategories.Find(p.Category)?.Id == category.Id)
                    .Select(p => new MapPlaceResult { Id = $"mapai:{p.Id}", LocationId = p.Id, Name = p.Title, Address = p.Address, Lat = p.Latitude, Lng = p.Longitude, Category = category.Id, Source = "mapai" }));
                availableSources++;
            }
            catch (Exception error) when (error is not OperationCanceledException)
            {
                _logger.LogWarning(error, "MapAI place source unavailable");
                response.Warnings.Add("Không tải được dữ liệu địa điểm MapAI; kết quả có thể chưa đầy đủ.");
            }
            cancellationToken.ThrowIfCancellationRequested();
            try
            {
                candidates.AddRange(await _osmRepository.SearchCategoryNearbyAsync(lat, lng, category.Id, request.Radius, cancellationToken));
                availableSources++;
            }
            catch (Exception error) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(error, "OpenStreetMap place source unavailable");
                response.Warnings.Add("Không tải được OpenStreetMap; kết quả chỉ dựa trên dữ liệu MapAI hiện có.");
            }
            cancellationToken.ThrowIfCancellationRequested();
            if (availableSources == 0) throw new HttpRequestException("Các nguồn địa điểm đang không khả dụng. Vui lòng thử lại sau.");
            var unique = new List<MapPlaceResult>();
            foreach (var place in candidates.Where(p => MapDistance.Valid(p.Lat, p.Lng)))
            {
                var distance = MapDistance.Meters(lat, lng, place.Lat, place.Lng);
                if (distance > request.Radius) continue;
                place.DistanceMeters = Math.Round(distance, 1);
                if (unique.Any(p => p.Id == place.Id || (MapPlaceCategories.Normalize(p.Name) == MapPlaceCategories.Normalize(place.Name) && MapDistance.Meters(p.Lat, p.Lng, place.Lat, place.Lng) <= 30))) continue;
                unique.Add(place);
            }
            response.Places = unique.OrderBy(p => MapDistance.Meters(lat, lng, p.Lat, p.Lng)).ThenBy(p => p.Id, StringComparer.Ordinal).Take(request.Limit).ToList();
            return response;
        }

        public async Task<NearestDirectionResult> GetNearestDirectionAsync(NearestDirectionRequest request, CancellationToken cancellationToken = default)
        {
            if (request.Mode is not ("driving" or "bicycle" or "foot")) throw new ArgumentException("Phương tiện phải là driving, bicycle hoặc foot.");
            request.Limit = 1;
            var search = await FindPlacesAsync(request, cancellationToken);
            var result = new NearestDirectionResult { Search = search, Destination = search.Places.FirstOrDefault(), Mode = request.Mode };
            if (result.Destination != null)
            {
                cancellationToken.ThrowIfCancellationRequested();
                result.Route = await GetDirectionAsync(new OsmRouteRequest { StartLat = request.Lat!.Value, StartLng = request.Lng!.Value, EndLat = result.Destination.Lat, EndLng = result.Destination.Lng, Mode = request.Mode });
                if (result.Route == null) search.Warnings.Add("Đã tìm được địa điểm nhưng chưa lấy được tuyến đường.");
            }
            return result;
        }
    }
}
