using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using MapAI.Domain.Models.Osm;
using MapAI.Domain.Models.Places;
using MapAI.Domain.Ports;
using Microsoft.Extensions.Caching.Memory;

namespace MapAI.Infrastructure.Repositories;

// A bounded public-data cache; no account data or database imports occur here.
public sealed class OsmSearchCache : IDisposable
{
    internal readonly MemoryCache Values = new(new MemoryCacheOptions { SizeLimit = 2048 });
    internal readonly SemaphoreSlim LookupGate = new(1);
    internal DateTimeOffset LastLookup;
    public void Dispose() { Values.Dispose(); LookupGate.Dispose(); }
}

public sealed class UnifiedOsmSource(HttpClient client, OsmSearchCache cache) : IUnifiedOsmSource
{
    private static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;
    private static string Text(JsonElement value, string key) => value.TryGetProperty(key, out var part) ? part.ToString() : "";
    private static Dictionary<string, string> Tags(JsonElement value) => value.ValueKind == JsonValueKind.Object
        ? value.EnumerateObject().Where(p => p.Value.ValueKind == JsonValueKind.String).ToDictionary(p => p.Name, p => p.Value.GetString()!) : [];
    private T? Cached<T>(string key) => cache.Values.TryGetValue<string>(key, out var json) ? JsonSerializer.Deserialize<T>(json!) : default;
    private void Store<T>(string key, T value, int minutes = 15) => cache.Values.Set(key, JsonSerializer.Serialize(value), new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(minutes) });
    private UnifiedPlace? Place(string type, string id, double lat, double lng, Dictionary<string, string> tags, string? address = null)
    {
        type = type switch { "N" => "node", "W" => "way", "R" => "relation", _ => type };
        var canonical = UnifiedPlaceRules.OsmCanonical(type, id);
        if (canonical == null || !MapDistance.Valid(lat, lng) || !DaNangBounds.Contains(lat, lng)) return null;
        var category = MapPlaceCategories.All.FirstOrDefault(c => (c.Id != "bus" || tags.GetValueOrDefault("railway") != "platform" || tags.GetValueOrDefault("bus") == "yes") && c.Filters.Any(f => tags.Any(t => f == $"[\"{t.Key}\"=\"{t.Value}\"]")))
            ?? MapPlaceCategories.FindForBrowse(tags.GetValueOrDefault("amenity"));
        var name = new[] { tags.GetValueOrDefault("name:vi"), tags.GetValueOrDefault("name"), tags.GetValueOrDefault("name:en"), tags.GetValueOrDefault("brand"), category?.Name }.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
        if (string.IsNullOrWhiteSpace(name)) return null;
        name = name[..Math.Min(name.Length, 255)];
        return new() { CanonicalId = canonical, SourceType = "openstreetmap", OsmType = type, OsmId = id, Lat = lat, Lng = lng,
            Name = name, NormalizedName = UnifiedPlaceRules.Normalize(name), CategoryMapping = category?.Id ?? "place", Category = category?.Name ?? "Địa điểm",
            Address = address ?? string.Join(", ", new[] { "addr:housenumber", "addr:street", "addr:suburb", "addr:city" }.Select(k => tags.GetValueOrDefault(k)).Where(v => !string.IsNullOrWhiteSpace(v))),
            OsmTags = tags, Aliases = [canonical] };
    }
    public async Task<List<UnifiedPlace>> SearchAsync(string query, CancellationToken cancellationToken)
    {
        var normalized = UnifiedPlaceRules.Normalize(query);
        var key = "search:" + normalized;
        if (Cached<List<UnifiedPlace>>(key) is { } cached) return cached;
        var category = MapPlaceCategories.All.SelectMany(c => c.Aliases.Append(c.Id).Append(UnifiedPlaceRules.Normalize(c.Name)).Select(a => (Category: c, Alias: a)))
            .OrderByDescending(p => p.Alias.Length).FirstOrDefault(p => (" " + normalized + " ").Contains(" " + p.Alias + " "));
        List<UnifiedPlace> places;
        if (category.Category != null)
        {
            var remaining = normalized.Replace(category.Alias, " ").Replace("da nang", " ").Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(w => !new[] { "tim", "giup", "toi", "cho", "tai", "o", "den", "chi", "duong" }.Contains(w)).ToArray();
            // A name-based geocoder and a category index complement one another. Either may be unavailable.
            async Task<List<UnifiedPlace>?> Safe(Func<Task<List<UnifiedPlace>>> action) { try { return await action(); } catch (Exception) when (!cancellationToken.IsCancellationRequested) { return null; } }
            var tagTask = Safe(() => CategoryAsync(category.Category, cancellationToken));
            var nameTask = Safe(() => PhotonAsync(remaining.Length > 0 ? string.Join(" ", remaining) : category.Category.Name, cancellationToken));
            await Task.WhenAll(tagTask, nameTask);
            if (tagTask.Result == null && nameTask.Result == null) throw new HttpRequestException("OSM search is temporarily unavailable.");
            places = (tagTask.Result ?? []).Concat(nameTask.Result ?? []).Where(p => p.CategoryMapping == category.Category.Id && remaining.All(w => p.NormalizedName.Contains(w) || UnifiedPlaceRules.Normalize(p.Address).Contains(w))).Take(50).ToList();
        }
        else places = await PhotonAsync(query, cancellationToken);
        places = places.DistinctBy(p => p.CanonicalId).ToList();
        foreach (var place in places) Store("identity:" + place.CanonicalId, place, 30);
        Store(key, places);
        return places;
    }
    private async Task<List<UnifiedPlace>> PhotonAsync(string query, CancellationToken cancellationToken)
    {
        var url = "https://photon.komoot.io/api/?limit=30&bbox=107.81,15.91,108.35,16.25&lat=16.047&lon=108.206&q=" + Uri.EscapeDataString(query);
        using var response = await client.GetAsync(url, cancellationToken); response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        var places = new List<UnifiedPlace>();
        foreach (var feature in json.RootElement.GetProperty("features").EnumerateArray())
        {
            var properties = feature.GetProperty("properties"); var coordinates = feature.GetProperty("geometry").GetProperty("coordinates");
            var tags = Tags(properties); var osmKey = Text(properties, "osm_key"); if (osmKey.Length > 0) tags[osmKey] = Text(properties, "osm_value");
            var address = string.Join(", ", new[] { "housenumber", "street", "district", "city" }.Select(k => Text(properties, k)).Where(v => v.Length > 0));
            var place = Place(Text(properties, "osm_type"), Text(properties, "osm_id"), coordinates[1].GetDouble(), coordinates[0].GetDouble(), tags, address);
            if (place != null) places.Add(place);
        }
        return places;
    }
    private async Task<List<UnifiedPlace>> CategoryAsync(MapPlaceCategory category, CancellationToken cancellationToken)
    {
        var key = "category:" + category.Id;
        if (Cached<List<UnifiedPlace>>(key) is { } existing) return existing;
        // Only application-owned tag filters are used in Overpass QL.
        var query = "[out:json][timeout:12];(" + string.Concat(category.Filters.Select(f => $"nwr{f}({DaNangBounds.Overpass});")) + ");out body center 1500;";
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken); deadline.CancelAfter(TimeSpan.FromSeconds(8));
        using var response = await client.PostAsync("https://overpass-api.de/api/interpreter", new FormUrlEncodedContent(new Dictionary<string, string> { ["data"] = query }), deadline.Token);
        response.EnsureSuccessStatusCode();
        using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
        if (json.RootElement.TryGetProperty("remark", out _)) throw new HttpRequestException("OSM returned an incomplete extract.");
        var places = new List<UnifiedPlace>();
        foreach (var element in json.RootElement.GetProperty("elements").EnumerateArray())
        {
            if (!element.TryGetProperty("tags", out var tags)) continue;
            var point = element.TryGetProperty("center", out var center) ? center : element;
            if (!point.TryGetProperty("lat", out var lat) || !point.TryGetProperty("lon", out var lng)) continue;
            var place = Place(Text(element, "type"), Text(element, "id"), lat.GetDouble(), lng.GetDouble(), Tags(tags));
            if (place != null) places.Add(place);
        }
        Store(key, places); return places;
    }
    public async Task<UnifiedPlace?> ResolveAsync(string osmType, string osmId, CancellationToken cancellationToken)
    {
        var canonical = UnifiedPlaceRules.OsmCanonical(osmType, osmId) ?? throw new ArgumentException("Invalid OSM identity.");
        if (Cached<UnifiedPlace>("identity:" + canonical) is { } existing) return existing;
        // Lookup is an explicit favorite/review interaction, never autocomplete. Respect 1 request/second.
        await cache.LookupGate.WaitAsync(cancellationToken);
        try
        {
            if (Cached<UnifiedPlace>("identity:" + canonical) is { } second) return second;
            var delay = TimeSpan.FromSeconds(1) - (DateTimeOffset.UtcNow - cache.LastLookup);
            if (delay > TimeSpan.Zero) await Task.Delay(delay, cancellationToken);
            cache.LastLookup = DateTimeOffset.UtcNow;
            var prefix = osmType switch { "node" => "N", "way" => "W", _ => "R" };
            var url = $"https://nominatim.openstreetmap.org/lookup?osm_ids={prefix}{osmId}&format=json&addressdetails=1&extratags=1&namedetails=1";
            using var response = await client.GetAsync(url, cancellationToken); response.EnsureSuccessStatusCode();
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
            var item = json.RootElement.EnumerateArray().FirstOrDefault();
            if (item.ValueKind == JsonValueKind.Undefined || Text(item, "osm_type") != osmType || Text(item, "osm_id") != osmId) return null;
            var tags = item.TryGetProperty("extratags", out var extra) ? Tags(extra) : new();
            var names = item.TryGetProperty("namedetails", out var detail) ? Tags(detail) : new();
            foreach (var pair in names) tags[pair.Key] = pair.Value;
            tags[Text(item, "class")] = Text(item, "type");
            if (!tags.ContainsKey("name")) tags["name"] = Text(item, "name");
            var result = Place(osmType, osmId, double.Parse(Text(item, "lat"), Invariant), double.Parse(Text(item, "lon"), Invariant), tags, Text(item, "display_name"));
            if (result != null) Store("identity:" + canonical, result, 30);
            return result;
        }
        finally { cache.LookupGate.Release(); }
    }
}
