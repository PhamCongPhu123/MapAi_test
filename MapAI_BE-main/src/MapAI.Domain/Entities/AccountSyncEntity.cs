namespace MapAI.Domain.Entities;

public sealed class AccountFavoriteEntity
{
    public string UserId { get; set; } = "";
    public string PlaceKey { get; set; } = "";
    public string SnapshotJson { get; set; } = "";
    public bool Deleted { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
public sealed class SyncReceiptEntity
{
    public string UserId { get; set; } = "";
    public Guid OperationId { get; set; }
    public string RequestHash { get; set; } = "";
    public string ResultJson { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}
