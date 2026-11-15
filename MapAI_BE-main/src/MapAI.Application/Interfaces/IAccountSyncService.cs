using MapAI.Domain.Models.Sync;
namespace MapAI.Application.Interfaces;
public interface IAccountSyncService
{
    Task<SyncReceipt> ApplyAsync(string userId, SyncOperation operation);
    Task<IReadOnlyList<FavoriteRecord>> FavoritesAsync(string userId);
    Task<PublicCatalog> CatalogAsync();
}
