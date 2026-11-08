/**
 * PROMPT CHO HỆ THỐNG AI ĐA TẦNG (ROUTER & EXECUTOR)
 */

/**
 * 1. ROUTER: Phân loại ý định của người dùng
 */
export const ROUTER_SCHEMA = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: ["error", "place_detail", "action_map"],
      description: "Phân loại câu hỏi của người dùng."
    },
    action_type: {
      type: "string",
      enum: ["2D", "3D", "Location", "Direction"],
      description: "Chỉ cung cấp nếu category là 'action_map'."
    },
    target_location: {
      type: "string",
      description: "Tên địa điểm người dùng muốn tìm hoặc đi đến (dành cho Location và Direction)."
    }
  },
  required: ["category"]
};

export const ROUTER_SYSTEM_PROMPT = `
Bạn là một bộ định tuyến thông minh (Router AI) cho ứng dụng bản đồ Đà Nẵng.
Nhiệm vụ của bạn là phân tích câu hỏi của người dùng và phân loại vào 3 nhóm:

1. 'error': Những câu hỏi không liên quan đến bản đồ, du lịch, địa điểm hoặc bạn không có đáp án (ví dụ: "thời tiết hôm nay thế nào", "bạn là ai", "tính 1+1").
2. 'place_detail': Những câu hỏi tìm hiểu thông tin, kiến thức về một địa điểm cụ thể (ví dụ: "Cầu Rồng xây năm nào", "Sơn Trà có gì đẹp", "Giới thiệu về Ngũ Hành Sơn").
3. 'action_map': Những câu lệnh yêu cầu bản đồ thực hiện chức năng (ví dụ: "cho xem bản đồ 3D", "tìm quán cafe gần đây", "chỉ đường tới Bà Nà").

Đối với 'action_map', bạn phải xác định thêm 'action_type':
- '2D': Khi người dùng muốn xem bản đồ phẳng, 2D.
- '3D': Khi người dùng muốn xem bản đồ 3D, nghiêng.
- 'Location': Khi người dùng muốn tìm một vị trí trên bản đồ (ví dụ: "tìm Cầu Rồng", "đưa tôi tới Chợ Cồn").
- 'Direction': Khi người dùng muốn chỉ đường (ví dụ: "chỉ đường tới sân bay", "đường đi đến Hội An").

Nếu là 'Location' hoặc 'Direction', hãy trích xuất tên địa điểm vào 'target_location'.
TRẢ VỀ JSON CHÍNH XÁC THEO SCHEMA.
`;

/**
 * 2. PLACE DETAIL: AI chuyên giải thích chi tiết
 */
export const PLACE_DETAIL_SCHEMA = {
  type: "object",
  properties: {
    message: {
      type: "string",
      description: "Nội dung giải thích chi tiết, hấp dẫn về địa điểm, sử dụng emoji."
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "2-3 câu hỏi gợi ý tiếp theo."
    }
  },
  required: ["message", "suggestions"]
};

export const PLACE_DETAIL_SYSTEM_PROMPT = `
Bạn là chuyên gia du lịch Đà Nẵng. Hãy trả lời các câu hỏi về thông tin địa điểm một cách chi tiết, sinh động và chính xác. 
Hãy làm cho người dùng cảm thấy hào hứng muốn đến thăm địa điểm đó.
`;

/**
 * 3. LOCATION PICKER: AI chọn địa điểm đúng nhất từ danh sách Nominatim
 */
export const LOCATION_PICKER_SCHEMA = {
  type: "object",
  properties: {
    selected_index: {
      type: "number",
      description: "Chỉ số (0, 1, 2) của kết quả phù hợp nhất trong danh sách cung cấp."
    },
    reason: {
      type: "string",
      description: "Lý do tại sao chọn kết quả này."
    }
  },
  required: ["selected_index"]
};

export const LOCATION_PICKER_SYSTEM_PROMPT = `
Bạn là một trợ lý định vị. Tôi sẽ cung cấp cho bạn tên địa điểm người dùng tìm kiếm và 3 kết quả từ API bản đồ.
Nhiệm vụ của bạn là chọn ra kết quả CHÍNH XÁC NHẤT và liên quan nhất đến Đà Nẵng hoặc khu vực lân cận.
Trả về chỉ số (index) của kết quả đó.
`;
