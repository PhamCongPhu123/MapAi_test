using System.ComponentModel.DataAnnotations;
using MapAI.Domain.Common;

namespace MapAI.Domain.Entities;

public class LocationReviewEntity : BaseEntity
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string LocationId { get; set; } = null!;
    public LocationEntity Location { get; set; } = null!;
    public string UserId { get; set; } = null!;
    public UserEntity User { get; set; } = null!;
    [Range(1, 5)]
    public int Rating { get; set; }
    [MaxLength(2000)]
    public string Comment { get; set; } = "";
}
