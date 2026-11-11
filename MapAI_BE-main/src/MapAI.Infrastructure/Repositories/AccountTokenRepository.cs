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

        public async Task<bool> CompleteEmailVerificationAsync(AccountTokenEntity token)
        {
            // Soft-delete a used verification token instead of losing its proof.
            // Replaying the same valid link then succeeds without activating the
            // account again. Both first activation and consumption are atomic.
            var now = DateTimeOffset.UtcNow;
            await using var transaction = await _context.Database.BeginTransactionAsync();
            var matching = _context.AccountTokens.Where(t => t.Id == token.Id
                && t.UserId == token.UserId && t.TokenHash == token.TokenHash
                && t.Type == ETokenType.EmailVerification);
            var consumed = await matching.Where(t => !t.IsDeleted && t.ExpiresAt >= now)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.IsDeleted, true)
                    .SetProperty(t => t.UpdatedAt, now));
            if (consumed == 1)
            {
                await _context.Users.Where(u => u.Id == token.UserId)
                    .ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, true)
                        .SetProperty(u => u.UpdatedAt, now));
            }
            // A consumed link is only a confirmation, never permission to
            // reactivate a disabled account or accept an arbitrary token.
            var verified = await matching.AnyAsync(t => t.IsDeleted && t.User.IsActive);
            await transaction.CommitAsync();
            return verified;
        }

        public async Task<bool> CompletePasswordResetAsync(AccountTokenEntity token, string passwordHash)
        {
            var now = DateTimeOffset.UtcNow;
            await using var transaction = await _context.Database.BeginTransactionAsync();
            // Competing requests must consume the same row before either can change the password.
            var consumed = await _context.AccountTokens.Where(t => t.Id == token.Id
                && t.UserId == token.UserId && t.TokenHash == token.TokenHash
                && t.Type == ETokenType.PasswordReset && !t.IsDeleted && t.ExpiresAt > now)
                .ExecuteDeleteAsync();
            if (consumed != 1) return false;

            var updated = await _context.Users.Where(u => u.Id == token.UserId)
                .ExecuteUpdateAsync(s => s.SetProperty(u => u.PasswordHash, passwordHash)
                    .SetProperty(u => u.UpdatedAt, now));
            if (updated != 1) return false;

            await _context.AccountTokens.Where(t => t.UserId == token.UserId
                && (t.Type == ETokenType.PasswordReset || t.Type == ETokenType.RefreshToken))
                .ExecuteDeleteAsync();
            await transaction.CommitAsync();
            return true;
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
