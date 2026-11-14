using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Exceptions;
using MapAI.Domain.Ports;
using MapAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MapAI.Infrastructure.Repositories;

public sealed class CommunityLocationRepository(MapAIContext context) : ICommunityLocationRepository
{
    public Task<bool> DuplicateExistsAsync(string title, double lat, double lng) => context.Locations.AnyAsync(l =>
        !l.IsDeleted && l.Status != LocationStatus.Rejected && l.Title.ToLower() == title &&
        Math.Abs(l.Latitude - lat) < 0.0003 && Math.Abs(l.Longitude - lng) < 0.0003);

    public async Task AddContributionAsync(LocationEntity location)
    { context.Locations.Add(location); await context.SaveChangesAsync(); }

    public async Task<(List<LocationEntity> Items, int Count)> ContributionsAsync(string? userId, int page, int pageSize)
    {
        var query = context.Locations.AsNoTracking().Where(l => l.IsUserContribution && !l.IsDeleted);
        query = userId == null ? query.Where(l => l.Status == LocationStatus.Pending) : query.Where(l => l.SubmittedById == userId);
        var count = await query.CountAsync();
        return (await query.Include(l => l.SubmittedBy).OrderByDescending(l => l.CreatedAt).ThenBy(l => l.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(), count);
    }
    public Task<LocationEntity?> FindContributionAsync(string id) => context.Locations.AsNoTracking()
        .FirstOrDefaultAsync(l => l.Id == id && l.IsUserContribution && !l.IsDeleted);

    public async Task<bool> ModeratePendingAsync(string id, string adminId, LocationStatus status, string? note, DateTimeOffset now) =>
        await context.Locations.Where(l => l.Id == id && l.Status == LocationStatus.Pending && !l.IsDeleted)
            .ExecuteUpdateAsync(u => u.SetProperty(l => l.Status, status).SetProperty(l => l.ModerationNote, note)
                .SetProperty(l => l.ModeratedAt, now).SetProperty(l => l.ModeratedById, adminId).SetProperty(l => l.UpdatedAt, now)) > 0;

    public Task<bool> IsPublishedAsync(string id) => context.Locations.AnyAsync(l => l.Id == id && l.Status == LocationStatus.Approved && !l.IsDeleted);

    public async Task<ReviewData> ReviewsAsync(string id, string? userId, int page, int pageSize)
    {
        var query = context.LocationReviews.AsNoTracking().Where(r => r.LocationId == id);
        var stats = await query.GroupBy(r => r.LocationId).Select(g => new { Count = g.Count(), Average = g.Average(r => r.Rating) }).SingleOrDefaultAsync();
        var items = await query.Include(r => r.User).OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var mine = userId == null ? null : await query.Include(r => r.User).SingleOrDefaultAsync(r => r.UserId == userId);
        return new(items, mine, stats?.Count ?? 0, stats?.Average);
    }
    public async Task<LocationReviewEntity> SaveReviewAsync(string id, string userId, int rating, string comment)
    {
        var review = await context.LocationReviews.SingleOrDefaultAsync(r => r.LocationId == id && r.UserId == userId);
        if (review == null) { review = new() { LocationId = id, UserId = userId }; context.LocationReviews.Add(review); }
        else review.UpdatedAt = DateTimeOffset.UtcNow;
        review.Rating = rating; review.Comment = comment;
        try { await context.SaveChangesAsync(); }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        { throw new CommunityConflictException("Đánh giá vừa được cập nhật ở nơi khác. Hãy tải lại và thử lại."); }
        await context.Entry(review).Reference(r => r.User).LoadAsync();
        return review;
    }
    public async Task DeleteReviewAsync(string id, string userId) =>
        await context.LocationReviews.Where(r => r.LocationId == id && r.UserId == userId).ExecuteDeleteAsync();

    public async Task<Dictionary<string, ReviewSummary>> SummariesAsync(string[] ids) => await context.LocationReviews.AsNoTracking()
        .Where(r => ids.Contains(r.LocationId)).GroupBy(r => r.LocationId)
        .Select(g => new { Id = g.Key, Count = g.Count(), Average = g.Average(r => r.Rating) })
        .ToDictionaryAsync(x => x.Id, x => new ReviewSummary(x.Count, x.Average));
}
