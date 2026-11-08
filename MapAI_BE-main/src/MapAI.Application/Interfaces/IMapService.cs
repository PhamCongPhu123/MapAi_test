using MapAI.Domain.Models.Osm;

namespace MapAI.Application.Interfaces
{
    public interface IMapService
    {
        Task<List<NominatimResult>?> SearchLocationsAsync(string query);
        Task<object?> GetDirectionAsync(OsmRouteRequest request);
        Task<MapPlaceSearchResult> FindPlacesAsync(MapPlaceQuery request, CancellationToken cancellationToken = default);
        Task<NearestDirectionResult> GetNearestDirectionAsync(NearestDirectionRequest request, CancellationToken cancellationToken = default);
    }
}
