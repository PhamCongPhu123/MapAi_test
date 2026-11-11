using System.ComponentModel.DataAnnotations;
using MapAI.Domain.Enums;

namespace MapAI.Domain.Models.Location;

public class SubmitLocationRequest
{
    [Required, StringLength(255, MinimumLength = 2)]
    public string Title { get; set; } = "";
    [Required, StringLength(500)]
    public string Address { get; set; } = "";
    [StringLength(2000)]
    public string? Description { get; set; }
    [Url, StringLength(2048)]
    public string? Thumbnail { get; set; }
    [Required, RegularExpression("^(Cafe|Ăn uống|Du lịch|Landmark|Khác|Cây xăng|ATM|Nhà thuốc|Bệnh viện|Bãi đỗ xe|Trạm sạc)$")]
    public string Category { get; set; } = "";
    [Required, Range(-90, 90)]
    public double? Latitude { get; set; }
    [Required, Range(-180, 180)]
    public double? Longitude { get; set; }
}

public class ModerateLocationRequest
{
    [Required]
    public LocationStatus? Status { get; set; }
    [StringLength(500)]
    public string? Note { get; set; }
}

public class SaveLocationReviewRequest
{
    [Range(1, 5)]
    public int Rating { get; set; }
    [StringLength(2000)]
    public string? Comment { get; set; }
}

public class ContributionResponse
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Address { get; set; }
    public string? Description { get; set; }
    public string? Thumbnail { get; set; }
    public string? Category { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public LocationStatus Status { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public string? SubmittedByName { get; set; }
    public string? ModerationNote { get; set; }
    public DateTimeOffset? ModeratedAt { get; set; }
}

public class ReviewResponse
{
    public string Id { get; set; } = "";
    public string AuthorName { get; set; } = "";
    public int Rating { get; set; }
    public string Comment { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public bool IsMine { get; set; }
}

public class ReviewPageResponse
{
    public IReadOnlyList<ReviewResponse> Items { get; set; } = [];
    public ReviewResponse? MyReview { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public double? AverageRating { get; set; }
}

public class ContributionPageResponse
{
    public IReadOnlyList<ContributionResponse> Items { get; set; } = [];
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
}
