using MapAI.Infrastructure.Interfaces;
using MapAI.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MapAI.Infrastructure.Repositories
{
    public class UserRepository : IUserRepository
    {
        private readonly MapAIContext _context;

        public UserRepository(MapAIContext context)
        {
            _context = context;
        }

        public async Task<UserEntity?> GetByIdAsync(string id)
        {
            return await _context.Users.FindAsync(id);
        }

        public async Task<UserEntity?> GetByEmailAsync(string email)
        {
            return await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        }

        public async Task<UserEntity?> GetByIdOrEmailAsync(string search)
        {
            return await _context.Users
                .FirstOrDefaultAsync(u => u.Id == search || u.Email == search);
        }

        public async Task<IEnumerable<UserEntity>> GetAllAsync()
        {
            return await _context.Users.ToListAsync();
        }

        public async Task<bool> AddAsync(UserEntity entity)
        {
            await _context.Users.AddAsync(entity);
            int changed = await _context.SaveChangesAsync();
            return changed > 0;
        }

        public async Task<bool> UpdateAsync(UserEntity entity)
        {
            _context.Users.Update(entity);
            int changed = await _context.SaveChangesAsync();
            return changed > 0;
        }

        public async Task<bool> DeleteAsync(string id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null) return false;

            _context.Users.Remove(user);
            int changed = await _context.SaveChangesAsync();
            return changed > 0;
        }

        public async Task<bool> ExistsByEmailAsync(string email)
        {
            return await _context.Users.AnyAsync(u => u.Email == email);
        }
    }
}
