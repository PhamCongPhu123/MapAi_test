using MapAI.Application.Interfaces;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Osm;
using MapAI.Domain.Models.Places;
using MapAI.Domain.Models.Sync;
using MapAI.Domain.Ports;
using Microsoft.Extensions.Logging;

namespace MapAI.Application.Services;
public sealed class UnifiedPlaceService(IUnifiedPlaceRepository repository, IUnifiedOsmSource osm, ILogger<UnifiedPlaceService> logger) : IUnifiedPlaceService
{
    public async Task<FederatedPlaceResult> SearchAsync(string query, CancellationToken cancellationToken = default)
    {
        if (query.Trim().Length is < 2 or > 200) throw new ArgumentException("Từ khóa cần từ 2 đến 200 ký tự.");
        var normalized = UnifiedPlaceRules.Normalize(query);
        async Task<(List<UnifiedPlace> Places, bool Ok)> Read(Func<Task<List<UnifiedPlace>>> source, string name) {
            try { return (await source(), true); }
            catch (Exception error) when (!cancellationToken.IsCancellationRequested) { logger.LogWarning("Place search source {Source} unavailable ({Failure})", name, error.GetType().Name); return ([], false); }
        }
        var localTask = Read(async () => (await repository.SearchAsync(normalized, MapPlaceCategories.FindForBrowse(normalized)?.Id, cancellationToken)).Select(UnifiedPlaceRules.FromMapai).ToList(), "MapAI");
        var osmTask = Read(() => osm.SearchAsync(query, cancellationToken), "OSM");
        await Task.WhenAll(localTask, osmTask);
        var local = await localTask; var external = await osmTask;
        if (!local.Ok && !external.Ok) throw new HttpRequestException("Hai nguồn tìm kiếm đang không khả dụng. Hãy thử lại sau.");
        var category = MapPlaceCategories.FindForBrowse(normalized)?.Id;
        var ranked = UnifiedPlaceRules.Merge(local.Places.Concat(external.Places))
            .OrderByDescending(p => p.NormalizedName == normalized ? 10 : p.NormalizedName.Contains(normalized) ? 5 : category != null && p.CategoryMapping == category ? 3 : UnifiedPlaceRules.Similarity(p.Name, query))
            .ThenBy(p => p.SourceType == "openstreetmap" ? 1 : 0).ThenBy(p => p.CanonicalId, StringComparer.Ordinal).Take(30).ToList();
        var warnings = new List<string>();
        if (!local.Ok) warnings.Add("MapAI tạm thời không khả dụng; đang hiển thị dữ liệu OpenStreetMap.");
        if (!external.Ok) warnings.Add("OpenStreetMap tạm thời không khả dụng; đang hiển thị dữ liệu MapAI.");
        return new(ranked, new() { ["mapai"] = local.Ok ? "ok" : "unavailable", ["osm"] = external.Ok ? "ok" : "unavailable" }, warnings);
    }
    public async Task<UnifiedPlace> ReferenceForInteractionAsync(SavedPlace place, CancellationToken cancellationToken = default)
    {
        var canonical = UnifiedPlaceRules.OsmCanonical(place.OsmType, place.OsmId) ?? throw new ArgumentException("Địa điểm OSM cần loại và ID gốc hợp lệ.");
        if (place.Key != canonical || (place.CanonicalId != null && place.CanonicalId != canonical)) throw new ArgumentException("Định danh OSM không khớp.");
        var existing = await repository.FindOsmReferenceAsync(canonical);
        if (existing != null) {
            if (existing.IsDeleted || existing.Status != LocationStatus.Approved) throw new KeyNotFoundException("Địa điểm này đã bị ẩn trên MapAI.");
            var linked = UnifiedPlaceRules.FromMapai(existing);
            linked.CanonicalId = canonical; linked.SourceType = "openstreetmap"; linked.OsmType = place.OsmType; linked.OsmId = place.OsmId;
            return linked;
        }
        // Client coordinates/names never become public without checking the original OSM identity.
        var verified = await osm.ResolveAsync(place.OsmType!, place.OsmId!, cancellationToken) ?? throw new KeyNotFoundException("Không tìm thấy định danh OSM gốc. Thông tin trên thiết bị vẫn được giữ.");
        if (verified.CanonicalId != canonical || !DaNangBounds.Contains(verified.Lat, verified.Lng)) throw new ArgumentException("Địa điểm OSM nằm ngoài phạm vi Đà Nẵng.");
        var matching = (await repository.NearbyAsync(verified.Lat, verified.Lng)).Select(UnifiedPlaceRules.FromMapai).FirstOrDefault(p => UnifiedPlaceRules.SamePlace(p, verified));
        var stored = await repository.EnsureOsmReferenceAsync(verified, matching?.MapaiId);
        var result = UnifiedPlaceRules.FromMapai(stored);
        // Interactions retain the OSM key even when the reference enriches an existing MapAI place.
        result.CanonicalId = canonical; result.OsmType = verified.OsmType; result.OsmId = verified.OsmId; result.SourceType = "openstreetmap";
        return result;
    }
}
