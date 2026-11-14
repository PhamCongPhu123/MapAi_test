using MapAI.Domain.Exceptions;
using MapAI.Application.Interfaces;
using MapAI.Application.Exceptions;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Location;
using MapAI.Domain.Ports;

namespace MapAI.Application.Services;

public class CommunityLocationService(ICommunityLocationRepository repository) : ICommunityLocationService
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
        var duplicate = await repository.DuplicateExistsAsync(normalizedTitle, lat, lng);
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
        await repository.AddContributionAsync(location);
        return ToContribution(location);
    }

    public async Task<ContributionPageResponse> GetContributionsAsync(string? userId, int page, int pageSize)
    {
        var result = await repository.ContributionsAsync(userId, page, pageSize);
        return new() { Items = result.Items.Select(ToContribution).ToList(), Page = page, PageSize = pageSize, TotalCount = result.Count };
    }

    public async Task ModerateAsync(string id, string adminId, ModerateLocationRequest request)
    {
        if (request.Status is not (LocationStatus.Approved or LocationStatus.Rejected))
            throw new ArgumentException("Chỉ được chọn duyệt hoặc từ chối.");
        var note = request.Note?.Trim();
        if (request.Status == LocationStatus.Rejected && string.IsNullOrWhiteSpace(note))
            throw new ArgumentException("Vui lòng ghi lý do từ chối.");
        var location = await repository.FindContributionAsync(id) ?? throw new KeyNotFoundException("Không tìm thấy đóng góp này.");
        if (location.Status != LocationStatus.Pending) throw new CommunityConflictException("Đóng góp đã được xử lý. Hãy tải lại danh sách.");
        var now = DateTimeOffset.UtcNow;
        if (!await repository.ModeratePendingAsync(id, adminId, request.Status.Value, note, now))
            throw new CommunityConflictException("Đóng góp vừa được quản trị viên khác xử lý. Hãy tải lại danh sách.");
    }

    public async Task<ReviewPageResponse> GetReviewsAsync(string id, string? userId, int page, int pageSize)
    {
        await RequirePublishedAsync(id);
        var result = await repository.ReviewsAsync(id, userId, page, pageSize);
        return new() { Items = result.Items.Select(r => ToReview(r, userId)).ToList(), MyReview = result.Mine == null ? null : ToReview(result.Mine, userId),
            Page = page, PageSize = pageSize, TotalCount = result.Count, AverageRating = result.Average.HasValue ? Math.Round(result.Average.Value, 1) : null };
    }

    public async Task<ReviewResponse> SaveReviewAsync(string id, string userId, SaveLocationReviewRequest request)
    {
        await RequirePublishedAsync(id);
        if (request.Rating is < 1 or > 5) throw new ArgumentException("Đánh giá phải từ 1 đến 5 sao.");
        return ToReview(await repository.SaveReviewAsync(id, userId, request.Rating, request.Comment?.Trim() ?? ""), userId);
    }
    public async Task DeleteReviewAsync(string id, string userId)
    { await RequirePublishedAsync(id); await repository.DeleteReviewAsync(id, userId); }
    private async Task RequirePublishedAsync(string id)
    { if (!await repository.IsPublishedAsync(id)) throw new KeyNotFoundException("Không tìm thấy địa điểm đã được duyệt."); }

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
