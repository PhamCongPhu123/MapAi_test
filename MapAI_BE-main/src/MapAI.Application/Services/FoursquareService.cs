using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Foursquare;
using MapAI.Domain.Ports;

namespace MapAI.Application.Services
{
    public class FoursquareService : IFoursquareService
    {
        private readonly IFoursquareRepository _foursquareRepository;

        public FoursquareService(IFoursquareRepository foursquareRepository)
        {
            _foursquareRepository = foursquareRepository;
        }

        public async Task<List<FoursquareNearbyResult>> GetNearbyPlacesAsync(FoursquareSearchRequest request)
        {
            return await _foursquareRepository.SearchNearbyPlacesAsync(
                request.Lat, 
                request.Lng, 
                request.Query, 
                request.Radius);
        }
    }
}
