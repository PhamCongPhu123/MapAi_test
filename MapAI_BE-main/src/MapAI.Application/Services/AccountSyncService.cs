using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Location;
using MapAI.Domain.Models.Sync;
using MapAI.Domain.Ports;

namespace MapAI.Application.Services;
public sealed class AccountSyncService(IAccountSyncRepository repository, ICommunityLocationService community,
    ILocationRepository locations, IUnifiedPlaceService unifiedPlaces) : IAccountSyncService
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static T Read<T>(JsonElement payload)
    {
        var value = payload.Deserialize<T>(Json) ?? throw new ArgumentException("Nội dung đồng bộ không hợp lệ.");
        var errors = new List<ValidationResult>();
        if (!Validator.TryValidateObject(value, new ValidationContext(value), errors, true))
            throw new ArgumentException(string.Join(" ", errors.Select(e => e.ErrorMessage)));
        return value;
    }
    public Task<SyncReceipt> ApplyAsync(string userId, SyncOperation op)
    {
        if (op.Id == Guid.Empty || op.Payload.ValueKind != JsonValueKind.Object || op.Payload.GetRawText().Length > 20000)
            throw new ArgumentException("Mã hoặc nội dung đồng bộ không hợp lệ.");
        return repository.OnceAsync(userId, op, async () =>
        {
            string? resource = op.LocationId;
            string? mapaiLocationId = null;
            switch (op.Kind)
            {
                case "favorite":
                    var change = Read<FavoriteChange>(op.Payload);
                    var errors = new List<ValidationResult>();
                    if (!Validator.TryValidateObject(change.Place, new ValidationContext(change.Place), errors, true) ||
                        !double.IsFinite(change.Place.Lat) || !double.IsFinite(change.Place.Lng) ||
                        !new[] { "seed:", "mapai:", "osm:" }.Any(change.Place.Key.StartsWith))
                        throw new ArgumentException("Thông tin địa điểm yêu thích không hợp lệ.");
                    if (!change.Deleted && change.Place.Key.StartsWith("osm:") && change.Place.OsmType != null)
                    {
                        var linked = await unifiedPlaces.ReferenceForInteractionAsync(change.Place);
                        change.Place.MapaiId = linked.MapaiId; change.Place.Id = linked.CanonicalId;
                        change.Place.CanonicalId = linked.CanonicalId; change.Place.SourceType = "openstreetmap";
                        change.Place.Name = linked.Name; change.Place.Lat = linked.Lat; change.Place.Lng = linked.Lng;
                        change.Place.Address = linked.Address; change.Place.Category = linked.CategoryMapping; change.Place.Source = "openstreetmap";
                        mapaiLocationId = linked.MapaiId;
                    }
                    await repository.SetFavoriteAsync(userId, change); resource = change.Place.Key;
                    break;
                case "contribution": resource = (await community.SubmitAsync(userId, Read<SubmitLocationRequest>(op.Payload))).Id; break;
                case "review":
                    if (string.IsNullOrWhiteSpace(resource)) throw new ArgumentException("Thiếu địa điểm đánh giá.");
                    if (resource.StartsWith("osm:"))
                    {
                        if (op.Place == null || op.Place.Key != resource) throw new ArgumentException("Thiếu định danh địa điểm OSM để đánh giá.");
                        var linked = await unifiedPlaces.ReferenceForInteractionAsync(op.Place);
                        resource = linked.MapaiId!; mapaiLocationId = linked.MapaiId;
                    }
                    resource = (await community.SaveReviewAsync(resource, userId, Read<SaveLocationReviewRequest>(op.Payload))).Id;
                    break;
                case "review-delete":
                    if (string.IsNullOrWhiteSpace(resource)) throw new ArgumentException("Thiếu địa điểm đánh giá.");
                    await community.DeleteReviewAsync(resource, userId); break;
                default: throw new ArgumentException("Loại đồng bộ không được hỗ trợ.");
            }
            return new SyncReceipt(op.Id, op.Kind, resource, mapaiLocationId);
        });
    }
    public Task<IReadOnlyList<FavoriteRecord>> FavoritesAsync(string userId) => repository.FavoritesAsync(userId);
    public async Task<PublicCatalog> CatalogAsync()
    {
        // Approved, public fields only; deterministic ordering changes the version on edit/approval/deletion.
        var places = (await locations.GetAllAsync()).OrderBy(p => p.Id, StringComparer.Ordinal).Select(p => new SavedPlace
        {
            Key = MapAI.Domain.Models.Places.UnifiedPlaceRules.FromMapai(p).CanonicalId, Id = p.Id,
            CanonicalId = MapAI.Domain.Models.Places.UnifiedPlaceRules.FromMapai(p).CanonicalId,
            SourceType = p.IsOsmReference ? "openstreetmap" : p.IsUserContribution ? "mapai_community" : "mapai_curated",
            OsmType = p.IsOsmReference ? p.OsmReferences.FirstOrDefault()?.OsmType : null, OsmId = p.IsOsmReference ? p.OsmReferences.FirstOrDefault()?.OsmId : null,
            MapaiId = p.Id, Name = p.Title, Lat = p.Latitude, Lng = p.Longitude,
            Address = p.Address, Description = p.Description, Category = p.Category, Source = "mapai"
        });
        var payload = JsonSerializer.Serialize(places, Json);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
        return new PublicCatalog(hash, hash, payload);
    }
}
