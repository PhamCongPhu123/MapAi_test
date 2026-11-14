using System.Collections.Generic;
using System.Threading.Tasks;
using MapAI.Domain.Entities;

namespace MapAI.Domain.Ports
{
    public interface ILocationRepository
    {
        Task<LocationEntity?> GetByIdAsync(string id);
        Task<IEnumerable<LocationEntity>> GetAllAsync();
        Task<IEnumerable<LocationEntity>> SearchByTitleAsync(string title);
        Task<IEnumerable<LocationEntity>> GetByCoordinatesAsync(double lat, double lng, double epsilon = 0.00001);
        Task<IEnumerable<LocationEntity>> GetPagedAsync(int pageNumber, int pageSize);
        Task<int> GetCountAsync();
        Task<LocationEntity> AddAsync(LocationEntity location);
        Task UpdateAsync(LocationEntity location);
        Task DeleteAsync(string id);
        Task<bool> ExistsAsync(string id);
    }
}
