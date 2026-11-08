using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Osm;
using MapAI.Infrastructure.Interfaces;

namespace MapAI.Application.Services
{
    public class MapService : IMapService
    {
        private readonly IOsmRepository _osmRepository;

        public MapService(IOsmRepository osmRepository)
        {
            _osmRepository = osmRepository;
        }

        public async Task<List<NominatimResult>?> SearchLocationsAsync(string query)
        {
            // Có thể thêm logic xử lý query tại đây (ví dụ: chuẩn hóa chuỗi)
            return await _osmRepository.SearchNominatimAsync(query);
        }

        public async Task<object?> GetDirectionAsync(OsmRouteRequest request)
        {
            // Gọi repository để lấy lộ trình
            return await _osmRepository.GetRouteAsync(
                request.StartLat, 
                request.StartLng, 
                request.EndLat, 
                request.EndLng, 
                request.Mode);
        }
    }
}
