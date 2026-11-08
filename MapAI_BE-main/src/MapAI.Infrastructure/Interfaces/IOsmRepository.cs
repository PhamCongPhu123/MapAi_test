using System.Collections.Generic;
using System.Threading.Tasks;
using MapAI.Domain.Models.Osm;
using MapAI.Domain.Models.Foursquare;

namespace MapAI.Infrastructure.Interfaces
{
    public interface IOsmRepository
    {
        Task<List<NominatimResult>?> SearchNominatimAsync(string query);
        Task<object?> GetRouteAsync(double startLat, double startLng, double endLat, double endLng, string mode = "driving");
        Task<List<FoursquareNearbyResult>> SearchNearbyOverpassAsync(double lat, double lng, string query = "", int radius = 1000);
        Task<List<FoursquareNearbyResult>> SearchCityWideOverpassAsync(string query = "");
    }
}
