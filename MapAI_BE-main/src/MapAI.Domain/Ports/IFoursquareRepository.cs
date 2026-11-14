using MapAI.Domain.Models.Foursquare;

namespace MapAI.Domain.Ports
{
    public interface IFoursquareRepository
    {
        Task<List<FoursquareNearbyResult>> SearchNearbyPlacesAsync(double lat, double lng, string query = "", int radius = 1000);
    }
}
