using MapAI.Domain.Models.Foursquare;

namespace MapAI.Application.Interfaces
{
    public interface IFoursquareService
    {
        Task<List<FoursquareNearbyResult>> GetNearbyPlacesAsync(FoursquareSearchRequest request);
    }
}
