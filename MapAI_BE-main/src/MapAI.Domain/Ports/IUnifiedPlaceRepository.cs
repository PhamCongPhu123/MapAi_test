using MapAI.Domain.Entities;
using MapAI.Domain.Models.Places;
namespace MapAI.Domain.Ports;
public interface IUnifiedOsmSource
{
    Task<List<UnifiedPlace>> SearchAsync(string query, CancellationToken cancellationToken);
    Task<UnifiedPlace?> ResolveAsync(string osmType, string osmId, CancellationToken cancellationToken);
}
public interface IUnifiedPlaceRepository
{
    Task<List<LocationEntity>> SearchAsync(string normalizedQuery, string? category, CancellationToken cancellationToken);
    Task<LocationEntity?> FindOsmReferenceAsync(string canonicalId);
    Task<List<LocationEntity>> NearbyAsync(double lat, double lng);
    Task<LocationEntity> EnsureOsmReferenceAsync(UnifiedPlace verifiedPlace, string? matchingMapaiId);
}
