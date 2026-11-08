namespace MapAI.Infrastructure.TemplatePrompts
{
    public static class AiPrompt
    {
        /**
         * 1. ROUTER: Phân loại ý định của người dùng
         */
        public const string ROUTER_SYSTEM_PROMPT = @"
Bạn là một bộ định tuyến thông minh (Router AI) cho ứng dụng bản đồ Đà Nẵng.
Nhiệm vụ của bạn là phân tích câu hỏi của người dùng và phân loại vào 3 nhóm:

1. 'error': Những câu hỏi không liên quan đến bản đồ, du lịch, địa điểm hoặc bạn không có đáp án (ví dụ: ""thời tiết hôm nay thế nào"", ""bạn là ai"", ""tính 1+1"").
2. 'place_detail': Những câu hỏi tìm hiểu thông tin, kiến thức về một địa điểm cụ thể (ví dụ: ""Cầu Rồng xây năm nào"", ""Sơn Trà có gì đẹp"", ""Giới thiệu về Ngũ Hành Sơn"").
3. 'action_map': Những câu lệnh yêu cầu bản đồ thực hiện chức năng.

Đối với 'action_map', bạn phải xác định thêm 'action_type':
- '2D': Xem bản đồ phẳng 2D.
- '3D': Xem bản đồ 3D nghiêng.
- 'Location': Tìm MỘT vị trí cụ thể theo tên riêng (ví dụ: ""tìm Cầu Rồng"", ""đưa tôi tới Chợ Cồn""). Trích xuất tên riêng vào 'target_location'.
- 'Direction': Chỉ đường tới một địa điểm (ví dụ: ""chỉ đường tới sân bay"", ""đường đi đến Hội An""). Trích xuất đích đến vào 'target_location'.
- 'Nearby': Tìm CÁC địa điểm theo loại ở GẦN VỊ TRÍ HIỆN TẠI (ví dụ: ""quán cafe gần đây"", ""ATM quanh tôi"", ""cây xăng gần nhất""). Trích xuất loại địa điểm (cafe, atm, xăng...) vào 'search_query'.
- 'CityWide': Tìm CÁC địa điểm theo loại trên TOÀN THÀNH PHỐ ĐÀ NẴNG (ví dụ: ""tìm các quán cafe ở Đà Nẵng"", ""danh sách bệnh viện tại Đà Nẵng"", ""địa điểm du lịch đẹp""). Trích xuất loại địa điểm vào 'search_query'.

TRẢ VỀ JSON CHÍNH XÁC THEO SCHEMA.
";

        public static readonly object ROUTER_SCHEMA = new
        {
            type = "object",
            properties = new
            {
                category = new
                {
                    type = "string",
                    @enum = new[] { "error", "place_detail", "action_map" },
                    description = "Phân loại câu hỏi của người dùng."
                },
                action_type = new
                {
                    type = "string",
                    @enum = new[] { "2D", "3D", "Location", "Direction", "Nearby", "CityWide" },
                    description = "Chỉ cung cấp nếu category là 'action_map'."
                },
                target_location = new
                {
                    type = "string",
                    description = "Tên địa điểm cụ thể (dành cho Location và Direction)."
                },
                search_query = new
                {
                    type = "string",
                    description = "Từ khóa loại địa điểm (dành cho Nearby và CityWide chỉ dùng tiếng anh , ví dụ: 'cafe', 'hospital')."
                }
            },
            required = new[] { "category" }
        };

        /**
         * 2. PLACE DETAIL: AI chuyên giải thích chi tiết
         */
        public const string PLACE_DETAIL_SYSTEM_PROMPT = @"
Bạn là chuyên gia du lịch Đà Nẵng. Hãy trả lời các câu hỏi về thông tin địa điểm một cách chi tiết, sinh động và chính xác. 
Hãy làm cho người dùng cảm thấy hào hứng muốn đến thăm địa điểm đó.
";

        public static readonly object PLACE_DETAIL_SCHEMA = new
        {
            type = "object",
            properties = new
            {
                message = new
                {
                    type = "string",
                    description = "Nội dung giải thích chi tiết, hấp dẫn về địa điểm, sử dụng emoji."
                },
                suggestions = new
                {
                    type = "array",
                    items = new { type = "string" },
                    description = "2-3 câu hỏi gợi ý tiếp theo."
                }
            },
            required = new[] { "message", "suggestions" }
        };

        /**
         * 3. LOCATION PICKER: AI chọn địa điểm đúng nhất từ danh sách Nominatim
         */
        public const string LOCATION_PICKER_SYSTEM_PROMPT = @"
Bạn là một trợ lý định vị. Tôi sẽ cung cấp cho bạn tên địa điểm người dùng tìm kiếm và 3 kết quả từ API bản đồ.
Nhiệm vụ của bạn là chọn ra kết quả CHÍNH XÁC NHẤT và liên quan nhất đến Đà Nẵng hoặc khu vực lân cận.
Trả về chỉ số (index) của kết quả đó.
";

        public static readonly object LOCATION_PICKER_SCHEMA = new
        {
            type = "object",
            properties = new
            {
                selected_index = new
                {
                    type = "number",
                    description = "Chỉ số (0, 1, 2) của kết quả phù hợp nhất trong danh sách cung cấp."
                },
                reason = new
                {
                    type = "string",
                    description = "Lý do tại sao chọn kết quả này."
                }
            },
            required = new[] { "selected_index" }
        };
    }
}
