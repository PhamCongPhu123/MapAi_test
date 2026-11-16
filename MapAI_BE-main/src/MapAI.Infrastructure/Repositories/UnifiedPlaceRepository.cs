using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Osm;
using MapAI.Domain.Models.Places;
using MapAI.Domain.Ports;
using MapAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace MapAI.Infrastructure.Repositories;
public sealed class UnifiedPlaceRepository(MapAIContext context) : IUnifiedPlaceRepository
{
    private IQueryable<LocationEntity> Published() => context.Locations.AsNoTracking().Include(l => l.OsmReferences).Where(l => l.Status == LocationStatus.Approved && !l.IsDeleted);
    public async Task<List<LocationEntity>> SearchAsync(string normalizedQuery, string? category, CancellationToken cancellationToken)
    {
        var tokens = normalizedQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(t => t.Length > 1).Take(10).ToArray();
        var aliases = category == null ? Array.Empty<string>() : (MapPlaceCategories.FindForBrowse(category)?.Aliases ?? []).Append(MapPlaceCategories.FindForBrowse(category)?.Name.ToLower() ?? "").Append(category).ToArray();
        return await Published().Where(l => tokens.Any(t => l.NormalizedName.Contains(t)) || (l.Category != null && aliases.Contains(l.Category.ToLower())))
            .OrderBy(l => l.Id).Take(150).ToListAsync(cancellationToken);
    }
    public async Task<LocationEntity?> FindOsmReferenceAsync(string canonicalId) =>
        await context.Locations.AsNoTracking().Include(l => l.OsmReferences).FirstOrDefaultAsync(l => l.OsmReferences.Any(r => r.CanonicalId == canonicalId));
    public Task<List<LocationEntity>> NearbyAsync(double lat, double lng) => Published().Where(l => Math.Abs(l.Latitude - lat) < .001 && Math.Abs(l.Longitude - lng) < .001).OrderBy(l => l.Id).ToListAsync();
    public async Task<LocationEntity> EnsureOsmReferenceAsync(UnifiedPlace verifiedPlace, string? matchingMapaiId)
    {
        // Called inside the account-operation transaction; coordinates are verified by the application port.
        if (context.Database.CurrentTransaction == null) throw new InvalidOperationException("OSM references require an interaction transaction.");
        await context.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({verifiedPlace.CanonicalId}, 0))");
        var existing = await context.OsmPlaceReferences.Include(r => r.Location).ThenInclude(l => l.OsmReferences).FirstOrDefaultAsync(r => r.CanonicalId == verifiedPlace.CanonicalId);
        if (existing != null) return existing.Location;
        var location = matchingMapaiId == null ? null : await context.Locations.Include(l => l.OsmReferences).FirstOrDefaultAsync(l => l.Id == matchingMapaiId && !l.IsDeleted && l.Status == LocationStatus.Approved);
        if (matchingMapaiId != null && location == null) throw new KeyNotFoundException("Địa điểm MapAI vừa được thay đổi. Hãy tìm lại.");
        if (location == null) {
            location = new() { Title = verifiedPlace.Name, Address = verifiedPlace.Address, Latitude = verifiedPlace.Lat, Longitude = verifiedPlace.Lng,
                Category = verifiedPlace.CategoryMapping, IsOsmReference = true, Status = LocationStatus.Approved, Rating = null, TotalReviews = 0 };
            context.Locations.Add(location);
        }
        context.OsmPlaceReferences.Add(new() { CanonicalId = verifiedPlace.CanonicalId, OsmType = verifiedPlace.OsmType!, OsmId = verifiedPlace.OsmId!, Location = location, LocationId = location.Id, VerifiedAt = DateTimeOffset.UtcNow });
        await context.SaveChangesAsync();
        return location;
    }
}
