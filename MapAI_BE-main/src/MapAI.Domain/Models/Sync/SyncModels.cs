using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace MapAI.Domain.Models.Sync;

// Snapshots are private account data, never added to the public location catalogue.
public sealed class SavedPlace
{
    [Required, StringLength(200)] public string Key { get; set; } = "";
    [StringLength(200)] public string? Id { get; set; }
    [StringLength(200)] public string? LocalId { get; set; }
    [Required, StringLength(255)] public string Name { get; set; } = "";
    [Range(-90, 90)] public double Lat { get; set; }
    [Range(-180, 180)] public double Lng { get; set; }
    [StringLength(500)] public string? Address { get; set; }
    [StringLength(2000)] public string? Description { get; set; }
    [StringLength(100)] public string? Category { get; set; }
    [StringLength(100)] public string? District { get; set; }
    [StringLength(50)] public string? Source { get; set; }
}
public sealed class FavoriteChange
{
    [Required] public SavedPlace Place { get; set; } = new();
    public bool Deleted { get; set; }
}
public sealed class SyncOperation
{
    public Guid Id { get; set; }
    [Required, RegularExpression("^(favorite|contribution|review|review-delete)$")]
    public string Kind { get; set; } = "";
    public JsonElement Payload { get; set; }
    [StringLength(200)] public string? LocationId { get; set; }
}
public sealed record SyncReceipt(Guid Id, string Kind, string? ResourceId);
public sealed record FavoriteRecord(SavedPlace Place, bool Deleted, DateTimeOffset UpdatedAt);
public sealed record PublicCatalog(string Version, string Sha256, string Payload);
