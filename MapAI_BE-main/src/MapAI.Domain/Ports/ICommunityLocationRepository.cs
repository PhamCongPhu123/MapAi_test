using MapAI.Domain.Entities;
using MapAI.Domain.Enums;

namespace MapAI.Domain.Ports;

public sealed record ReviewSummary(int Count, double Average);
public sealed record ReviewData(List<LocationReviewEntity> Items, LocationReviewEntity? Mine, int Count, double? Average);

public interface ICommunityLocationRepository
{
    Task<bool> DuplicateExistsAsync(string normalizedTitle, double lat, double lng);
    Task AddContributionAsync(LocationEntity location);
    Task<(List<LocationEntity> Items, int Count)> ContributionsAsync(string? userId, int page, int pageSize);
    Task<LocationEntity?> FindContributionAsync(string id);
    Task<bool> ModeratePendingAsync(string id, string adminId, LocationStatus status, string? note, DateTimeOffset now);
    Task<bool> IsPublishedAsync(string id);
    Task<ReviewData> ReviewsAsync(string id, string? userId, int page, int pageSize);
    Task<LocationReviewEntity> SaveReviewAsync(string id, string userId, int rating, string comment);
    Task DeleteReviewAsync(string id, string userId);
    Task<Dictionary<string, ReviewSummary>> SummariesAsync(string[] ids);
}
