using MapAI.Domain.Entities;
using MapAI.Domain.Enums;

namespace MapAI.Infrastructure.Interfaces
{
    public interface IAccountTokenRepository
    {
        Task<AccountTokenEntity?> GetByIdAsync(string id);
        Task<AccountTokenEntity?> GetByUserIdAsync(string userId);
        Task<AccountTokenEntity?> GetByUserAndType(string userId, ETokenType type);
        Task AddAsync(AccountTokenEntity token);
        Task UpdateAsync(AccountTokenEntity token);
        Task<bool> CompleteEmailVerificationAsync(AccountTokenEntity token);
        Task<bool> CompletePasswordResetAsync(AccountTokenEntity token, string passwordHash);
        Task DeleteByUserIdAsync(string userId);
        Task DeleteByUserAndType(string userId, ETokenType type);
        Task DeleteAsync(string id);
    }
}
