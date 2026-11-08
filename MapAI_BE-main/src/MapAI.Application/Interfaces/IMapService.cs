using MapAI.Domain.Models.Osm;

namespace MapAI.Application.Interfaces
{
    public interface IMapService
    {
        Task<List<NominatimResult>?> SearchLocationsAsync(string query);
        Task<object?> GetDirectionAsync(OsmRouteRequest request);
    }
}
