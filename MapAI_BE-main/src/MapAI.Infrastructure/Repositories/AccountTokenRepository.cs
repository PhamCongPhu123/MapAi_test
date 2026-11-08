using MapAI.Infrastructure.Interfaces;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace MapAI.Infrastructure.Repositories
{
    public class AccountTokenRepository : IAccountTokenRepository
    {
        private readonly MapAIContext _context;

        public AccountTokenRepository(MapAIContext context)
        {
            _context = context;
        }

        public async Task<AccountTokenEntity?> GetByIdAsync(string id)
        {
            return await _context.AccountTokens.FindAsync(id);
        }

        public async Task<AccountTokenEntity?> GetByUserIdAsync(string userId)
        {
            return await _context.AccountTokens
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.UserId == userId);
        }

        public async Task<AccountTokenEntity?> GetByUserAndType(string userId, ETokenType type)
        {
            return await _context.AccountTokens
                .Include(t => t.User)
                .FirstOrDefaultAsync(t => t.UserId == userId && t.Type == type);
        }

        public async Task AddAsync(AccountTokenEntity token)
        {
            await _context.AccountTokens.AddAsync(token);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(AccountTokenEntity token)
        {
            _context.AccountTokens.Update(token);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteByUserIdAsync(string userId)
        {
            await _context.AccountTokens
                .Where(t => t.UserId == userId)
                .ExecuteDeleteAsync();
        }

        public async Task DeleteByUserAndType(string userId, ETokenType type)
        {
            await _context.AccountTokens
                .Where(t => t.UserId == userId && t.Type == type)
                .ExecuteDeleteAsync();
        }

        public async Task DeleteAsync(string id)
        {
            var token = await _context.AccountTokens.FindAsync(id);
            if (token != null)
            {
                _context.AccountTokens.Remove(token);
                await _context.SaveChangesAsync();
            }
        }
    }
}
