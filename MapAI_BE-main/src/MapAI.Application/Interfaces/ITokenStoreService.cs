using MapAI.Domain.Entities;

namespace MapAI.Application.Interfaces
{
    public interface ITokenStoreService
    {
        Task<AccountTokenEntity?> GetSessionAsync(string userId);
        Task StoreSessionAsync(AccountTokenEntity token);
        Task RemoveSessionAsync(string userId);
    }
}
