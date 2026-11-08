using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using MapAI.Infrastructure.Interfaces;
using MapAI.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MapAI.Infrastructure.Repositories
{
    public class LocationRepository : ILocationRepository
    {
        private readonly MapAIContext _context;

        public LocationRepository(MapAIContext context)
        {
            _context = context;
        }

        public async Task<LocationEntity?> GetByIdAsync(string id)
        {
            return await _context.Locations.FindAsync(id);
        }

        public async Task<IEnumerable<LocationEntity>> GetAllAsync()
        {
            return await _context.Locations.ToListAsync();
        }

        public async Task<IEnumerable<LocationEntity>> SearchByTitleAsync(string title)
        {
            var lowerTitle = title.ToLower();
            // Chỉ lấy các từ có nghĩa (độ dài > 2) để tránh khớp các từ như "an", "bộ", "về"
            var words = lowerTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                                  .Where(w => w.Length > 2)
                                  .ToList();
            
            var query = _context.Locations.AsQueryable();
            
            // 1. Luôn ưu tiên khớp chứa toàn bộ cụm từ trước
            var results = await query
                .Where(l => l.Title.ToLower().Contains(lowerTitle) || 
                            (l.Tags != null && l.Tags.ToLower().Contains(lowerTitle)))
                .ToListAsync();

            // 2. Nếu không có khớp toàn bộ, mới tìm theo từng từ quan trọng
            if (!results.Any() && words.Any())
            {
                // Tìm các bản ghi chứa ít nhất một từ quan trọng
                results = await query
                    .Where(l => words.Any(w => l.Title.ToLower().Contains(w)))
                    .ToListAsync();
            }

            return results;
        }

        public async Task<IEnumerable<LocationEntity>> GetByCoordinatesAsync(double lat, double lng, double epsilon = 0.002)
        {
            return await _context.Locations
                .Where(l => Math.Abs(l.Latitude - lat) <= epsilon && 
                            Math.Abs(l.Longitude - lng) <= epsilon)
                .ToListAsync();
        }

        public async Task<IEnumerable<LocationEntity>> GetPagedAsync(int pageNumber, int pageSize)
        {
            return await _context.Locations
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
        }

        public async Task<int> GetCountAsync()
        {
            return await _context.Locations.CountAsync();
        }

        public async Task<LocationEntity> AddAsync(LocationEntity location)
        {
            await _context.Locations.AddAsync(location);
            await _context.SaveChangesAsync();
            return location;
        }

        public async Task UpdateAsync(LocationEntity location)
        {
            _context.Locations.Update(location);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(string id)
        {
            var location = await _context.Locations.FindAsync(id);
            if (location != null)
            {
                _context.Locations.Remove(location);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<bool> ExistsAsync(string id)
        {
            return await _context.Locations.AnyAsync(e => e.Id == id);
        }
    }
}
