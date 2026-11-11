using MapAI.Application.Interfaces;
using MapAI.Application.Exceptions;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Location;
using Microsoft.EntityFrameworkCore;

namespace MapAI.Application.Services;

public class CommunityLocationService(MapAIContext context) : ICommunityLocationService
{
    public async Task<ContributionResponse> SubmitAsync(string userId, SubmitLocationRequest request)
    {
        var title = request.Title.Trim();
        if (title.Length < 2 || string.IsNullOrWhiteSpace(request.Address))
            throw new ArgumentException("Tên địa điểm và địa chỉ không được để trống.");
        var lat = request.Latitude!.Value;
        var lng = request.Longitude!.Value;
        if (!double.IsFinite(lat) || !double.IsFinite(lng)) throw new ArgumentException("Tọa độ không hợp lệ.");
        if (request.Thumbnail != null &&
            (!Uri.TryCreate(request.Thumbnail, UriKind.Absolute, out var imageUri) ||
             (imageUri.Scheme != Uri.UriSchemeHttp && imageUri.Scheme != Uri.UriSchemeHttps)))
            throw new ArgumentException("Đường dẫn ảnh không hợp lệ.");
        var normalizedTitle = title.ToLowerInvariant();
        var duplicate = await context.Locations.AnyAsync(l => !l.IsDeleted && l.Status != LocationStatus.Rejected
            && l.Title.ToLower() == normalizedTitle
            && Math.Abs(l.Latitude - lat) < 0.0003 && Math.Abs(l.Longitude - lng) < 0.0003);
        if (duplicate) throw new CommunityConflictException("Địa điểm này đã tồn tại hoặc đang chờ duyệt gần vị trí bạn chọn.");
        var location = new LocationEntity
        {
            Title = title, Address = request.Address.Trim(), Description = request.Description?.Trim(),
            Category = request.Category, Latitude = lat, Longitude = lng,
            Thumbnail = request.Thumbnail,
            PhotosJson = request.Thumbnail == null ? null : System.Text.Json.JsonSerializer.Serialize(new[] { request.Thumbnail }),
            Status = LocationStatus.Pending, IsUserContribution = true, SubmittedById = userId,
            Rating = null, TotalReviews = 0
        };
        context.Locations.Add(location);
        await context.SaveChangesAsync();
        return ToContribution(location);
    }

    public async Task<ContributionPageResponse> GetContributionsAsync(string? userId, int page, int pageSize)
    {
        var query = context.Locations.AsNoTracking().Where(l => l.IsUserContribution && !l.IsDeleted);
        query = userId == null ? query.Where(l => l.Status == LocationStatus.Pending) : query.Where(l => l.SubmittedById == userId);
        var count = await query.CountAsync();
        var items = await query.Include(l => l.SubmittedBy).OrderByDescending(l => l.CreatedAt).ThenBy(l => l.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        return new() { Items = items.Select(ToContribution).ToList(), Page = page, PageSize = pageSize, TotalCount = count };
    }

    public async Task ModerateAsync(string id, string adminId, ModerateLocationRequest request)
    {
        if (request.Status is not (LocationStatus.Approved or LocationStatus.Rejected))
            throw new ArgumentException("Chỉ được chọn duyệt hoặc từ chối.");
        var note = request.Note?.Trim();
        if (request.Status == LocationStatus.Rejected && string.IsNullOrWhiteSpace(note))
            throw new ArgumentException("Vui lòng ghi lý do từ chối.");
        var location = await context.Locations.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id && l.IsUserContribution && !l.IsDeleted)
            ?? throw new KeyNotFoundException("Không tìm thấy đóng góp này.");
        if (location.Status != LocationStatus.Pending) throw new CommunityConflictException("Đóng góp đã được xử lý. Hãy tải lại danh sách.");
        var now = DateTimeOffset.UtcNow;
        var updated = await context.Locations.Where(l => l.Id == id && l.Status == LocationStatus.Pending)
            .ExecuteUpdateAsync(update => update.SetProperty(l => l.Status, request.Status.Value)
                .SetProperty(l => l.ModerationNote, note).SetProperty(l => l.ModeratedAt, now)
                .SetProperty(l => l.ModeratedById, adminId).SetProperty(l => l.UpdatedAt, now));
        if (updated == 0) throw new CommunityConflictException("Đóng góp vừa được quản trị viên khác xử lý. Hãy tải lại danh sách.");
    }

    public async Task<ReviewPageResponse> GetReviewsAsync(string id, string? userId, int page, int pageSize)
    {
        await RequirePublishedAsync(id);
        var query = context.LocationReviews.AsNoTracking().Where(r => r.LocationId == id);
        var stats = await query.GroupBy(r => r.LocationId).Select(g => new { Count = g.Count(), Average = g.Average(r => r.Rating) }).SingleOrDefaultAsync();
        var items = await query.Include(r => r.User).OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
        var mine = userId == null ? null : await query.Include(r => r.User).SingleOrDefaultAsync(r => r.UserId == userId);
        return new()
        {
            Items = items.Select(r => ToReview(r, userId)).ToList(), MyReview = mine == null ? null : ToReview(mine, userId),
            Page = page, PageSize = pageSize, TotalCount = stats?.Count ?? 0,
            AverageRating = stats == null ? null : Math.Round(stats.Average, 1)
        };
    }

    public async Task<ReviewResponse> SaveReviewAsync(string id, string userId, SaveLocationReviewRequest request)
    {
        await RequirePublishedAsync(id);
        var review = await context.LocationReviews.SingleOrDefaultAsync(r => r.LocationId == id && r.UserId == userId);
        if (review == null)
        {
            review = new() { LocationId = id, UserId = userId };
            context.LocationReviews.Add(review);
        }
        else review.UpdatedAt = DateTimeOffset.UtcNow;
        review.Rating = request.Rating;
        review.Comment = request.Comment?.Trim() ?? "";
        await context.SaveChangesAsync();
        await context.Entry(review).Reference(r => r.User).LoadAsync();
        return ToReview(review, userId);
    }

    public async Task DeleteReviewAsync(string id, string userId)
    {
        await RequirePublishedAsync(id);
        await context.LocationReviews.Where(r => r.LocationId == id && r.UserId == userId).ExecuteDeleteAsync();
    }

    private async Task RequirePublishedAsync(string id)
    {
        if (!await context.Locations.AnyAsync(l => l.Id == id && l.Status == LocationStatus.Approved && !l.IsDeleted))
            throw new KeyNotFoundException("Không tìm thấy địa điểm đã được duyệt.");
    }

    private static ContributionResponse ToContribution(LocationEntity l) => new()
    {
        Id = l.Id, Title = l.Title, Address = l.Address, Description = l.Description, Category = l.Category,
        Thumbnail = l.Thumbnail,
        Latitude = l.Latitude, Longitude = l.Longitude, Status = l.Status, CreatedAt = l.CreatedAt,
        SubmittedByName = l.SubmittedBy?.FullName, ModerationNote = l.ModerationNote, ModeratedAt = l.ModeratedAt
    };

    private static ReviewResponse ToReview(LocationReviewEntity r, string? userId) => new()
    {
        Id = r.Id, AuthorName = r.User.FullName, Rating = r.Rating, Comment = r.Comment,
        CreatedAt = r.CreatedAt, UpdatedAt = r.UpdatedAt, IsMine = r.UserId == userId
    };
}
