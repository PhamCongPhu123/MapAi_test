const messages = {
  AI_NOT_CONFIGURED: 'Trợ lý AI chưa được cấu hình khóa truy cập Gemini. Các lệnh bản đồ cơ bản vẫn dùng được.',
  AI_KEY_INVALID: 'Khóa truy cập Gemini không hợp lệ hoặc đã hết hạn. Cần cập nhật API key ở backend; bật GPS không khắc phục được lỗi này.',
  AI_ACCESS_DENIED: 'Gemini từ chối quyền truy cập. Cần kiểm tra API key và quyền sử dụng dịch vụ ở backend.',
  AI_MODEL_UNAVAILABLE: 'Model Gemini đang cấu hình không khả dụng. Cần chọn model được hỗ trợ trong cấu hình backend.',
  AI_RATE_LIMITED: 'Gemini đã chạm giới hạn lượt dùng hoặc hạn mức. Vui lòng thử lại sau hoặc kiểm tra quota của dự án.',
  AI_TIMEOUT: 'Dịch vụ AI phản hồi quá thời gian chờ. Vui lòng thử lại.',
  AI_CONNECTION_FAILED: 'Backend không kết nối được tới Gemini. Vui lòng kiểm tra kết nối tới dịch vụ AI rồi thử lại.',
  AI_BACKEND_UNREACHABLE: 'Không kết nối được máy chủ MapAI. Hãy kiểm tra backend và địa chỉ API rồi thử lại.',
  AI_INVALID_RESPONSE: 'Dịch vụ AI trả về dữ liệu chưa hợp lệ. Vui lòng thử lại.',
  AI_RESPONSE_BLOCKED: 'Dịch vụ AI không thể trả lời nội dung này. Bạn có thể diễn đạt lại yêu cầu.',
  AI_REQUEST_REJECTED: 'Gemini chưa chấp nhận yêu cầu xử lý này. Vui lòng thử lại sau.',
  AI_INVALID_REQUEST: 'Tin nhắn chưa hợp lệ. Vui lòng nhập nội dung từ 1 đến 2000 ký tự.',
  AI_SESSION_EXPIRED: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
  AI_UNAVAILABLE: 'Dịch vụ AI hiện chưa sẵn sàng. Bạn có thể thử các lệnh bản đồ cơ bản.',
};

export function aiFailure(status, payload = {}) {
  let code = payload?.code;
  // Compatibility with an older backend; never display its raw exception/body.
  if (!code && typeof payload?.error === 'string' && /API_KEY_INVALID|API_KEY_EXPIRED|API key not valid/i.test(payload.error)) code = 'AI_KEY_INVALID';
  if (!Object.hasOwn(messages, code)) code = status === 0 ? 'AI_BACKEND_UNREACHABLE' : status === 401 ? 'AI_SESSION_EXPIRED'
    : status === 429 ? 'AI_RATE_LIMITED' : status === 504 ? 'AI_TIMEOUT' : status === 400 ? 'AI_INVALID_REQUEST' : 'AI_UNAVAILABLE';
  return { error: true, errorCode: code, message: messages[code], suggestions: ['Tìm cây xăng gần nhất', 'Phóng to bản đồ', 'Vị trí của tôi'] };
}
