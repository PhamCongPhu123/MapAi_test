import { request } from './api';
import { aiFailure } from './aiErrors';

/**
 * HÀM CHÍNH: Xử lý yêu cầu người dùng qua Backend MapAI
 * Thay vì gọi trực tiếp Gemini API từ FE, chúng ta gọi qua BE để bảo mật và đồng bộ logic
 * 
 * @param {string} userInput - Câu lệnh của người dùng
 * @param {Array} chatHistory - Lịch sử trò chuyện
 */
export const askMapAI = async (userInput, chatHistory = [], selectedLocation = null) => {
  try {
    // Gọi đến API của Backend: /api/ai/ask
    const response = await request('/ai/ask', {
      method: 'POST',
      body: JSON.stringify({
        userInput,
        chatHistory: chatHistory.filter(msg => !msg.error && typeof msg.text === 'string' && msg.text.trim()).map(msg => ({
          role: msg.type === 'ai' ? 'model' : 'user',
          text: msg.text
        })),
        selectedLocation,
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return aiFailure(response.status, errorData);
    }

    const data = await response.json().catch(() => null);
    if (!data || typeof data.message !== 'string' || !data.message.trim()) return aiFailure(502, { code: 'AI_INVALID_RESPONSE' });

    /**
     * Dữ liệu trả về (data) sẽ có cấu trúc:
     * {
     *   "message": "...",
     *   "suggestions": ["...", "..."],
     *   "action": { "type": "...", "value": "..." }
     * }
     */
    return data;
    
  } catch {
    return aiFailure(0);
  }
};
