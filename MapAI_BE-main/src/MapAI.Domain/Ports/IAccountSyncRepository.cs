using MapAI.Domain.Models.Sync;
namespace MapAI.Domain.Ports;

public interface IAccountSyncRepository
{
    // The receipt and all writes made by apply share a transaction and an account lock.
    Task<SyncReceipt> OnceAsync(string userId, SyncOperation operation, Func<Task<SyncReceipt>> apply);
    Task SetFavoriteAsync(string userId, FavoriteChange change);
    Task<IReadOnlyList<FavoriteRecord>> FavoritesAsync(string userId);
}
