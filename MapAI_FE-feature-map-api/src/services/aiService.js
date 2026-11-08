import { request } from './api';

/**
 * HÀM CHÍNH: Xử lý yêu cầu người dùng qua Backend MapAI
 * Thay vì gọi trực tiếp Gemini API từ FE, chúng ta gọi qua BE để bảo mật và đồng bộ logic
 * 
 * @param {string} userInput - Câu lệnh của người dùng
 * @param {Array} chatHistory - Lịch sử trò chuyện
 */
export const askMapAI = async (userInput, chatHistory = []) => {
  try {
    // Gọi đến API của Backend: /api/ai/ask
    const response = await request('/ai/ask', {
      method: 'POST',
      body: JSON.stringify({
        userInput,
        chatHistory: chatHistory.map(msg => ({
          role: msg.type === 'ai' ? 'assistant' : 'user',
          content: msg.text
        }))
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Lỗi khi kết nối với trợ lý ảo MapAI");
    }

    const data = await response.json();
    
    console.log("AI Response Data:", data);

    /**
     * Dữ liệu trả về (data) sẽ có cấu trúc:
     * {
     *   "message": "...",
     *   "suggestions": ["...", "..."],
     *   "action": { "type": "...", "value": "..." }
     * }
     */
    return data;
    
  } catch (error) {
    console.error("Error in askMapAI:", error);
    return {
      message: "Xin lỗi, em đang gặp chút trục trặc khi kết nối với hệ thống. Bạn thử lại sau nhé!",
      suggestions: ["Tìm Chợ Cồn", "Xem các địa điểm tham quan"],
      error: true
    };
  }
};
