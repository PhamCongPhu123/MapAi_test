using MapAI.Domain.Models.Places;
using MapAI.Domain.Models.Sync;
namespace MapAI.Application.Interfaces;
public interface IUnifiedPlaceService
{
    Task<FederatedPlaceResult> SearchAsync(string query, CancellationToken cancellationToken = default);
    Task<UnifiedPlace> ReferenceForInteractionAsync(SavedPlace place, CancellationToken cancellationToken = default);
}
