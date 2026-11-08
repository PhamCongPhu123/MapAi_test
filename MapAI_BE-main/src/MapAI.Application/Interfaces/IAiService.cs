using MapAI.Domain.Models.Ai;

namespace MapAI.Application.Interfaces
{
    public interface IAiService
    {
        Task<AiFinalResponse> AskMapAIAsync(AiRequest request);
    }
}
