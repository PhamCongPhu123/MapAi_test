using System.Security.Cryptography;
using System.Text.Json;
using MapAI.Domain.Entities;
using MapAI.Domain.Exceptions;
using MapAI.Domain.Models.Sync;
using MapAI.Domain.Ports;
using MapAI.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MapAI.Infrastructure.Repositories;
public sealed class AccountSyncRepository(MapAIContext context) : IAccountSyncRepository
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static byte[] Canonical(SyncOperation operation)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream)) Write(writer, JsonSerializer.SerializeToElement(operation, Json));
        return stream.ToArray();
    }
    private static void Write(Utf8JsonWriter writer, JsonElement value)
    {
        switch (value.ValueKind)
        {
            case JsonValueKind.Object:
                writer.WriteStartObject();
                foreach (var property in value.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal)) { writer.WritePropertyName(property.Name); Write(writer, property.Value); }
                writer.WriteEndObject(); break;
            case JsonValueKind.Array:
                writer.WriteStartArray(); foreach (var item in value.EnumerateArray()) Write(writer, item); writer.WriteEndArray(); break;
            case JsonValueKind.Number: writer.WriteNumberValue(value.GetDouble()); break;
            default: value.WriteTo(writer); break;
        }
    }
    public async Task<SyncReceipt> OnceAsync(string userId, SyncOperation op, Func<Task<SyncReceipt>> apply)
    {
        var hash = Convert.ToHexString(SHA256.HashData(Canonical(op)));
        await using var transaction = await context.Database.BeginTransactionAsync();
        // Serialize operations for the authenticated owner, including concurrent retries from two devices.
        await context.Database.ExecuteSqlInterpolatedAsync($"SELECT 1 FROM \"Users\" WHERE \"Id\" = {userId} FOR UPDATE");
        var receipt = await context.SyncReceipts.FindAsync(userId, op.Id);
        if (receipt != null)
        {
            if (receipt.RequestHash != hash) throw new CommunityConflictException("Mã đồng bộ đã được dùng cho nội dung khác.");
            return JsonSerializer.Deserialize<SyncReceipt>(receipt.ResultJson, Json)!;
        }
        var result = await apply();
        context.SyncReceipts.Add(new SyncReceiptEntity { UserId = userId, OperationId = op.Id, RequestHash = hash,
            ResultJson = JsonSerializer.Serialize(result, Json), CreatedAt = DateTimeOffset.UtcNow });
        await context.SaveChangesAsync();
        await transaction.CommitAsync();
        return result;
    }
    public async Task SetFavoriteAsync(string userId, FavoriteChange change)
    {
        var row = await context.AccountFavorites.FindAsync(userId, change.Place.Key);
        if (row == null) { row = new() { UserId = userId, PlaceKey = change.Place.Key }; context.AccountFavorites.Add(row); }
        row.SnapshotJson = JsonSerializer.Serialize(change.Place, Json);
        row.Deleted = change.Deleted; row.UpdatedAt = DateTimeOffset.UtcNow;
    }
    public async Task<IReadOnlyList<FavoriteRecord>> FavoritesAsync(string userId) =>
        (await context.AccountFavorites.AsNoTracking().Where(f => f.UserId == userId).OrderBy(f => f.PlaceKey).ToListAsync())
        .Select(f => new FavoriteRecord(JsonSerializer.Deserialize<SavedPlace>(f.SnapshotJson, Json)!, f.Deleted, f.UpdatedAt)).ToList();
}
