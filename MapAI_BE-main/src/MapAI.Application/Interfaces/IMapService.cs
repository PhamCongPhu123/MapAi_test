using MapAI.Domain.Models.Osm;
using MapAI.Domain.Models.Foursquare;

namespace MapAI.Application.Interfaces
{
    public interface IMapService
    {
        Task<List<NominatimResult>?> SearchLocationsAsync(string query);
        Task<object?> GetDirectionAsync(OsmRouteRequest request);
        Task<List<FoursquareNearbyResult>> SearchNearbyPlacesAsync(double lat, double lng, string query, int radius);
        Task<List<FoursquareNearbyResult>> SearchCityWidePlacesAsync(string query);
        Task<MapPlaceSearchResult> FindPlacesAsync(MapPlaceQuery request, CancellationToken cancellationToken = default);
        Task<NearestDirectionResult> GetNearestDirectionAsync(NearestDirectionRequest request, CancellationToken cancellationToken = default);
    }
}
