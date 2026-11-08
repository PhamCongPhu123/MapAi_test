using System.Text.Json;
using System.Globalization;
using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Ai;
using MapAI.Domain.Models.Osm;
using MapAI.Infrastructure.Interfaces;
using MapAI.Infrastructure.TemplatePrompts;
using Microsoft.Extensions.Logging;

namespace MapAI.Application.Services
{
    public class AiService : IAiService
    {
        private readonly IAiRepository _aiRepository;
        private readonly IMapService _mapService;
        private readonly ILogger<AiService> _logger;

        public AiService(IAiRepository aiRepository, IMapService mapService, ILogger<AiService> logger)
        {
            _aiRepository = aiRepository;
            _mapService = mapService;
            _logger = logger;
        }

        public async Task<AiFinalResponse> AskMapAIAsync(AiRequest request)
        {
            try
            {
                // TẦNG 1: ROUTER - Phân loại ý định
                var routerJson = await _aiRepository.CallGeminiAsync(
                    AiPrompt.ROUTER_SYSTEM_PROMPT,
                    AiPrompt.ROUTER_SCHEMA,
                    request.UserInput,
                    request.ChatHistory
                );

                var route = JsonSerializer.Deserialize<RouterResponse>(routerJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (route == null)
                {
                    return ErrorResponse();
                }

                _logger.LogInformation("AI Route Decision: {Category}, {ActionType}", route.Category, route.ActionType);

                // XỬ LÝ THEO PHÂN LOẠI
                if (route.Category == "error")
                {
                    return new AiFinalResponse
                    {
                        Message = "Bạn đang hỏi câu không liên quan. Vui lòng hỏi câu khác.",
                        Suggestions = new List<string> { "Tìm Cầu Rồng", "Chỉ đường tới Bà Nà Hills", "Xem bản đồ 3D" }
                    };
                }

                if (route.Category == "place_detail")
                {
                    var detailJson = await _aiRepository.CallGeminiAsync(
                        AiPrompt.PLACE_DETAIL_SYSTEM_PROMPT,
                        AiPrompt.PLACE_DETAIL_SCHEMA,
                        request.UserInput,
                        request.ChatHistory
                    );
                    var detail = JsonSerializer.Deserialize<PlaceDetailResponse>(detailJson, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    
                    return new AiFinalResponse
                    {
                        Message = detail?.Message ?? "Không thể lấy thông tin chi tiết.",
                        Suggestions = detail?.Suggestions ?? new List<string>()
                    };
                }

                if (route.Category == "action_map")
                {
                    return await HandleActionMapAsync(route, request);
                }

                return ErrorResponse();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in AskMapAIAsync");
                throw;
            }
        }

        private async Task<AiFinalResponse> HandleActionMapAsync(RouterResponse route, AiRequest request)
        {
            var type = route.ActionType;

            // Chuyển 2D/3D
            if (type == "2D" || type == "3D")
            {
                return new AiFinalResponse
                {
                    Message = $"Dạ, em đang chuyển bản đồ sang chế độ {type} cho mình đây ạ!",
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
                        ? $"Dạ, MapAI đang tìm kiếm các **{query}** ở gần bạn đây ạ!" 
                        : $"Dạ, đây là danh sách các **{query}** tại Đà Nẵng mà MapAI tìm được cho bạn ạ!",
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
                        Message = "Em không tìm thấy địa điểm này trên bản đồ. Bạn thử tên khác nhé!",
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
                    Message = $"Đây là vị trí của **{bestMatch.DisplayName}** mà bạn đang tìm ạ!",
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
                        Message = $"MapAI đã chuẩn bị tuyến đường tới **{bestMatch.DisplayName}** cho mình rồi ạ. Bạn nhấn 'Bắt đầu' để đi nhé!",
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
                    Message = $"MapAI không tìm thấy địa điểm **{query}** để chỉ đường. Bạn thử lại nhé!",
                    Suggestions = new List<string> { "Chỉ đường tới Cầu Rồng", "Chỉ đường tới Chợ Hàn" }
                };
            }

            return ErrorResponse();
        }

        private AiFinalResponse ErrorResponse()
        {
            return new AiFinalResponse
            {
                Message = "Xin lỗi, MapAI gặp chút trục trặc khi xử lý yêu cầu.",
                Suggestions = new List<string> { "Thử lại" }
            };
        }
    }
}
