using MapAI.Domain.Models.Ai;

namespace MapAI.Domain.Ports
{
    public interface IAiRepository
    {
        Task<string> CallGeminiAsync(
            string systemPrompt, 
            object responseSchema, 
            string userMessage, 
            List<ChatMessage>? chatHistory = null, 
            double temperature = 0.3
        );
    }
}
