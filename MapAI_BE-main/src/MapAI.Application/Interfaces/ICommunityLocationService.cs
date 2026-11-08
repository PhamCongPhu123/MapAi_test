using MapAI.Domain.Models.Location;

namespace MapAI.Application.Interfaces;

public interface ICommunityLocationService
{
    Task<ContributionResponse> SubmitAsync(string userId, SubmitLocationRequest request);
    Task<ContributionPageResponse> GetContributionsAsync(string? userId, int page, int pageSize);
    Task ModerateAsync(string id, string adminId, ModerateLocationRequest request);
    Task<ReviewPageResponse> GetReviewsAsync(string id, string? userId, int page, int pageSize);
    Task<ReviewResponse> SaveReviewAsync(string id, string userId, SaveLocationReviewRequest request);
    Task DeleteReviewAsync(string id, string userId);
}
