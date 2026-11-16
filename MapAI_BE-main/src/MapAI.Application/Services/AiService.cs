using System.Text.Json;
using System.Globalization;
using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Ai;
using MapAI.Domain.Models.Osm;
using MapAI.Domain.Exceptions;
using MapAI.Domain.Ports;
using MapAI.Application.Prompts;
using Microsoft.Extensions.Logging;

namespace MapAI.Application.Services
{
    public class AiService : IAiService
    {
        private readonly IAiRepository _aiRepository;
        private readonly IMapService _mapService;
        private readonly ILogger<AiService> _logger;
        private readonly IUnifiedPlaceService? _places;

        public AiService(IAiRepository aiRepository, IMapService mapService, ILogger<AiService> logger, IUnifiedPlaceService? places = null)
        {
            _aiRepository = aiRepository;
            _mapService = mapService;
            _logger = logger; _places = places;
        }

        public async Task<AiFinalResponse> AskMapAIAsync(AiRequest request)
        {
            var result = await AskCoreAsync(request);
            result.Language = request.Language;
            if (request.Language == "en-US") result.Suggestions = result.Suggestions.Select(value => value
                .Replace("Chỉ đường tới ", "Directions to ").Replace("Chỉ đường đến ", "Directions to ")
                .Replace("Tìm ", "Find ").Replace("Xem bản đồ 3D", "Show 3D map").Replace("Xem bản đồ", "Show map")
                .Replace("Xem thông tin du lịch", "Travel information").Replace("Xem địa điểm dọc đường", "Places along the route")
                .Replace("Chọn phương tiện đi lại", "Choose travel mode").Replace("Những địa điểm đẹp ở Đà Nẵng", "Places to visit in Da Nang")
                .Replace("Đến Đà Nẵng nên ăn gì?", "What should I eat in Da Nang?").Replace("Thông tin về ", "Tell me about ")).ToList();
            return result;
        }
        private async Task<AiFinalResponse> AskCoreAsync(AiRequest request)
        {
            var en = request.Language == "en-US";
            try
            {
                // TẦNG 1: ROUTER - Phân loại ý định
                var route = MapCommandRouter.TryParse(request.UserInput);
                if (route == null && _places != null) {
                    var named = System.Text.RegularExpressions.Regex.Match(request.UserInput.Trim(), @"^(?:please\s+)?(?<verb>find|search for|look for|directions to|navigate to|take me to|route to|get directions to)\s+(?<query>.+)$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (named.Success) return await SearchPlacesAsync(named.Groups["query"].Value, !new[] { "find", "search for", "look for" }.Contains(named.Groups["verb"].Value.ToLowerInvariant()), en);
                }
                if (route == null && _places != null)
                {
                    var text = MapAI.Domain.Models.Places.UnifiedPlaceRules.Normalize(request.UserInput);
                    var utility = MapPlaceCategories.All.SelectMany(c => c.Aliases.Append(c.Id).Append(MapAI.Domain.Models.Places.UnifiedPlaceRules.Normalize(c.Name))).Any(a => (" " + text + " ").Contains(" " + a + " "));
                    var explainer = System.Text.RegularExpressions.Regex.IsMatch(text, @"\b(gioi thieu|lich su|vi sao|tai sao|ke ve|tell me about|history of|why|what is)\b");
                    if (utility && !explainer)
                        return await SearchPlacesAsync(System.Text.RegularExpressions.Regex.Replace(text, @"^(toi muon |hay |vui long )*(tim giup toi |tim cho toi |tim |cho toi |chi duong den |chi duong toi |dan duong den |dan duong toi |duong den )", ""), text.Contains("chi duong") || text.Contains("dan duong"), en);
                }
                if (route == null)
                {
                    var routerJson = await _aiRepository.CallGeminiAsync(
                        AiPrompt.ROUTER_SYSTEM_PROMPT,
                        AiPrompt.ROUTER_SCHEMA,
                        request.UserInput,
                        request.ChatHistory
                    );

                    route = JsonSerializer.Deserialize<RouterResponse>(routerJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                }

                if (route == null)
                {
                    return ErrorResponse(en);
                }

                _logger.LogInformation("AI Route Decision: {Category}, {ActionType}", route.Category, route.ActionType);

                // XỬ LÝ THEO PHÂN LOẠI
                if (route.Category == "error")
                {
                    return new AiFinalResponse
                    {
                        Message = Choose(en, "Bạn đang hỏi câu không liên quan. Vui lòng hỏi câu khác.", "Please ask about places, travel or the map in Da Nang."),
                        Suggestions = new List<string> { "Tìm Cầu Rồng", "Chỉ đường tới Bà Nà Hills", "Xem bản đồ 3D" }
                    };
                }

                if (route.Category == "place_detail")
                {
                    var detailJson = await _aiRepository.CallGeminiAsync(
                        AiPrompt.PLACE_DETAIL_SYSTEM_PROMPT + (en ? "\nRespond only in English (en-US), in at most three short sentences (80 words). Keep place names unchanged. Never claim a map action or distance not provided by a tool." : "\nChỉ trả lời bằng tiếng Việt (vi-VN), tối đa ba câu ngắn (80 từ). Giữ nguyên tên riêng. Không tự khẳng định khoảng cách hoặc thao tác bản đồ chưa được công cụ xác nhận."),
                        AiPrompt.PLACE_DETAIL_SCHEMA,
                        request.UserInput,
                        request.ChatHistory
                    );
                    var detail = JsonSerializer.Deserialize<PlaceDetailResponse>(detailJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    return new AiFinalResponse
                    {
                        Message = detail?.Message ?? Choose(en, "Không thể lấy thông tin chi tiết.", "Details are unavailable. Please try again."),
                        Suggestions = detail?.Suggestions ?? new List<string>()
                    };
                }

                if (route.Category == "action_map")
                {
                    return await HandleActionMapAsync(route, request);
                }

                return ErrorResponse(en);
            }
            catch (JsonException)
            {
                throw new AiProviderException(502, "AI_INVALID_RESPONSE", "Dịch vụ AI trả về dữ liệu chưa hợp lệ. Vui lòng thử lại.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("AI request failed ({FailureType}).", ex.GetType().Name);
                throw;
            }
        }

        private async Task<AiFinalResponse> HandleActionMapAsync(RouterResponse route, AiRequest request)
        {
            var type = route.ActionType;
            var en = request.Language == "en-US";
            if (_places != null && type is "Location" or "Direction" or "CityWide")
                return await SearchPlacesAsync(route.TargetLocation ?? route.SearchQuery ?? request.UserInput, type == "Direction", en);

            var cameraActions = new Dictionary<string, string>
            {
                ["ZoomIn"] = "ZOOM_IN", ["ZoomOut"] = "ZOOM_OUT", ["Locate"] = "LOCATE_USER",
                ["ResetNorth"] = "RESET_NORTH", ["ClearResults"] = "CLEAR_RESULTS", ["ClearRoute"] = "CLEAR_ROUTE"
            };
            if (type != null && cameraActions.TryGetValue(type, out var cameraAction))
                return new() { Message = Choose(en, "Đang thực hiện thao tác trên bản đồ.", "Applying your map command."), Action = new() { Type = cameraAction } };

            if (type == "DirectionSelected")
            {
                var selected = request.SelectedLocation;
                if (selected == null || !MapDistance.Valid(selected.Lat, selected.Lng))
                    return new() { Message = Choose(en, "Bạn hãy tìm hoặc chọn một địa điểm trước khi yêu cầu chỉ đường đến đó.", "Find or select a place before asking for directions there.") };
                return new() { Message = Choose(en, $"Đang thiết lập chỉ đường đến {selected.Name}.", $"Preparing directions to {selected.Name}."), Action = new() { Type = "SET_DIRECTION", Destination = selected } };
            }

            if (type is "Nearest" or "NearestDirection" or "Around" || (type == "Nearby" && MapPlaceCategories.Find(route.SearchQuery) != null))
            {
                var category = MapPlaceCategories.Find(route.SearchQuery);
                if (category == null) return new() { Message = Choose(en, "Bạn muốn tìm cây xăng, ATM, nhà thuốc, bệnh viện, quán ăn, cà phê, bãi đỗ xe hay trạm sạc?", "Would you like a gas station, ATM, pharmacy, hospital, restaurant, cafe, parking or charging station?") };
                var radius = route.RadiusMeters ?? 5000;
                if (radius is < 100 or > 20000) return new() { Message = Choose(en, "Bạn hãy chọn bán kính từ 100 m đến 20 km để tìm địa điểm.", "Choose a search radius between 100 meters and 20 kilometers.") };
                var mode = route.TravelMode ?? "driving";
                if (mode is not ("driving" or "bicycle" or "foot")) return new() { Message = Choose(en, "Bạn muốn đi ô tô, xe đạp hay đi bộ?", "Would you like to drive, cycle or walk?") };
                if (type == "Around" && string.IsNullOrWhiteSpace(route.ReferenceLocation))
                    return new() { Message = Choose(en, "Bạn muốn tìm quanh địa điểm nào? Hãy cho biết tên trung tâm tìm kiếm.", "Which place should I search around?") };
                AiLocation? center = null;
                if (!string.IsNullOrWhiteSpace(route.ReferenceLocation))
                {
                    var locations = await _mapService.SearchLocationsAsync(route.ReferenceLocation);
                    var reference = locations?.FirstOrDefault();
                    if (reference == null || !double.TryParse(reference.Lat, CultureInfo.InvariantCulture, out var lat)
                        || !double.TryParse(reference.Lon, CultureInfo.InvariantCulture, out var lng) || !MapDistance.Valid(lat, lng))
                        return new() { Message = Choose(en, "Chưa xác định được vị trí trung tâm bạn yêu cầu. Hãy thử tên địa điểm cụ thể hơn.", "I could not locate that reference point. Try a more specific place name.") };
                    center = new() { Name = reference.DisplayName, Lat = lat, Lng = lng };
                }
                if (type == "NearestDirection" && center != null)
                    return new() { Message = Choose(en, "Để chỉ đường đến nơi gần nhất quanh một địa điểm khác, bạn hãy tìm quanh địa điểm đó trước, rồi chọn kết quả để chỉ đường.", "Search around that place first, then choose a result for directions.") };
                return new()
                {
                    Message = center == null ? Choose(en, $"Đang tìm {category.Name.ToLowerInvariant()} trong bán kính {radius / 1000.0:0.#} km từ vị trí của bạn.", $"Searching for {route.SearchQuery} within {radius / 1000.0:0.#} kilometers of your location.") : Choose(en, $"Đang tìm {category.Name.ToLowerInvariant()} quanh {center.Name}.", $"Searching for {route.SearchQuery} around {center.Name}."),
                    Action = new() { Type = type == "NearestDirection" ? "ROUTE_TO_NEAREST" : type == "Nearest" ? "NEAREST_SEARCH" : "SEARCH_POIS", Value = new { category = category.Id, radius, mode, center } },
                    Suggestions = en ? ["Directions there", "Zoom in", "Clear search results"] : ["Chỉ đường đến đó", "Phóng to bản đồ", "Xóa kết quả tìm kiếm"]
                };
            }

            // Chuyển 2D/3D
            if (type == "2D" || type == "3D")
            {
                return new AiFinalResponse
                {
                    Message = Choose(en, $"Dạ, em đang chuyển bản đồ sang chế độ {type} cho mình đây ạ!", $"Switching the map to {type}."),
                    Action = new AiAction { Type = "SWITCH_VIEW", Value = type },
                    Suggestions = new List<string> { "Những địa điểm đẹp ở Đà Nẵng", "Đến Đà Nẵng nên ăn gì?" }
                };
            }

            // Tìm kiếm lân cận hoặc toàn thành phố
            if (type == "Nearby" || type == "CityWide")
            {
                string query = route.SearchQuery ?? request.UserInput;
                return new AiFinalResponse
                {
                    Message = type == "Nearby"
                        ? Choose(en, $"Dạ, MapAI đang tìm kiếm các **{query}** ở gần bạn đây ạ!", $"Searching for {query} near you.")
                        : Choose(en, $"Đang tìm kiếm các **{query}** tại Đà Nẵng.", $"Searching for {query} in Da Nang."),
                    Action = new AiAction
                    {
                        Type = type == "Nearby" ? "NEARBY_SEARCH" : "CITY_SEARCH",
                        Value = query
                    },
                    Suggestions = new List<string> { $"Tìm {query} khác", "Xem thông tin du lịch" }
                };
            }

            // Tìm vị trí (Location)
            if (type == "Location")
            {
                string query = route.TargetLocation ?? request.UserInput;
                var results = await _mapService.SearchLocationsAsync(query);

                if (results == null || !results.Any())
                {
                    return new AiFinalResponse
                    {
                        Message = Choose(en, "Em không tìm thấy địa điểm này trên bản đồ. Bạn thử tên khác nhé!", "I could not find that place. Try another name."),
                        Suggestions = new List<string> { "Tìm Chợ Cồn", "Tìm Cầu Sông Hàn" }
                    };
                }

                // AI chọn kết quả đúng nhất
                var context = $"Người dùng tìm: \"{query}\". \nDanh sách kết quả: {JsonSerializer.Serialize(results.Select((r, i) => new { index = i, name = r.DisplayName }))}";
                var pickerJson = await _aiRepository.CallGeminiAsync(
                    AiPrompt.LOCATION_PICKER_SYSTEM_PROMPT,
                    AiPrompt.LOCATION_PICKER_SCHEMA,
                    context
                );
                var picker = JsonSerializer.Deserialize<LocationPickerResponse>(pickerJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                var bestMatch = (picker != null && picker.SelectedIndex >= 0 && picker.SelectedIndex < results.Count) ? results[picker.SelectedIndex] : results[0];
                var shortName = !string.IsNullOrEmpty(bestMatch.Name) ? bestMatch.Name : bestMatch.DisplayName.Split(',')[0];

                return new AiFinalResponse
                {
                    Message = Choose(en, $"Đây là vị trí của **{bestMatch.DisplayName}** mà bạn đang tìm ạ!", $"Here is {bestMatch.DisplayName}."),
                    Location = new AiLocation
                    {
                        Name = bestMatch.DisplayName,
                        Lat = double.Parse(bestMatch.Lat, CultureInfo.InvariantCulture),
                        Lng = double.Parse(bestMatch.Lon, CultureInfo.InvariantCulture),
                        Address = bestMatch.DisplayName
                    },
                    Action = new AiAction { Type = "FLY_TO", Value = new { lat = double.Parse(bestMatch.Lat, CultureInfo.InvariantCulture), lng = double.Parse(bestMatch.Lon, CultureInfo.InvariantCulture) } },
                    Suggestions = new List<string> { $"Chỉ đường tới {shortName}", $"Thông tin về {shortName}" }
                };
            }

            // Chỉ đường (Direction)
            if (type == "Direction")
            {
                string query = route.TargetLocation ?? request.UserInput;
                var results = await _mapService.SearchLocationsAsync(query);

                if (results != null && results.Any())
                {
                    var context = $"Người dùng muốn đi đến: \"{query}\". \nDanh sách kết quả: {JsonSerializer.Serialize(results.Select((r, i) => new { index = i, name = r.DisplayName }))}";
                    var pickerJson = await _aiRepository.CallGeminiAsync(
                        AiPrompt.LOCATION_PICKER_SYSTEM_PROMPT,
                        AiPrompt.LOCATION_PICKER_SCHEMA,
                        context
                    );
                    var picker = JsonSerializer.Deserialize<LocationPickerResponse>(pickerJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    var bestMatch = (picker != null && picker.SelectedIndex >= 0 && picker.SelectedIndex < results.Count) ? results[picker.SelectedIndex] : results[0];

                    return new AiFinalResponse
                    {
                        Message = Choose(en, $"Đã xác định vị trí **{bestMatch.DisplayName}**. Đang thiết lập chỉ đường; bạn có thể xem lộ trình sau khi tuyến được tính.", $"Found {bestMatch.DisplayName}. Preparing directions; review the route once it is calculated."),
                        Action = new AiAction
                        {
                            Type = "SET_DIRECTION",
                            Destination = new { name = bestMatch.DisplayName, lat = double.Parse(bestMatch.Lat, CultureInfo.InvariantCulture), lng = double.Parse(bestMatch.Lon, CultureInfo.InvariantCulture) }
                        },
                        Suggestions = new List<string> { "Chọn phương tiện đi lại", "Xem địa điểm dọc đường" }
                    };
                }

                return new AiFinalResponse
                {
                    Message = Choose(en, $"MapAI không tìm thấy địa điểm **{query}** để chỉ đường. Bạn thử lại nhé!", $"I could not find {query} for directions. Try another name."),
                    Suggestions = new List<string> { "Chỉ đường tới Cầu Rồng", "Chỉ đường tới Chợ Hàn" }
                };
            }

            return ErrorResponse(en);
        }

        private async Task<AiFinalResponse> SearchPlacesAsync(string query, bool directions, bool en = false)
        {
            var result = await _places!.SearchAsync(query);
            var first = result.Places.FirstOrDefault();
            return new() {
                Message = first == null ? Choose(en, "Chưa tìm thấy địa điểm phù hợp tại Đà Nẵng. Bạn thử tên cụ thể hơn nhé.", "No matching place was found in Da Nang. Try a more specific name.")
                    : first.SourceType == "openstreetmap" ? Choose(en, "Mình tìm thấy địa điểm từ bản đồ mở OpenStreetMap.", "I found these places in OpenStreetMap.")
                    : Choose(en, "Mình tìm thấy các địa điểm từ dữ liệu MapAI và OpenStreetMap.", "I found these places in MapAI and OpenStreetMap."),
                Places = result.Places, Warnings = en ? result.Warnings.Select(w => w.Contains("OpenStreetMap tạm") ? "OpenStreetMap is unavailable; showing MapAI results." : "MapAI is unavailable; showing OpenStreetMap results.").ToList() : result.Warnings,
                Action = directions && first != null ? new() { Type = "LOCAL_DIRECTIONS", Value = first } : null,
                Suggestions = en ? ["Directions there", "Clear search results"] : ["Chỉ đường đến đó", "Xóa kết quả tìm kiếm"]
            };
        }

        private static string Choose(bool en, string vi, string english) => en ? english : vi;

        private AiFinalResponse ErrorResponse(bool en = false)
        {
            return new AiFinalResponse
            {
                Message = Choose(en, "Xin lỗi, MapAI gặp chút trục trặc khi xử lý yêu cầu.", "MapAI could not process that request. Please try again."),
                Suggestions = en ? ["Try again"] : ["Thử lại"]
            };
        }
    }
}
