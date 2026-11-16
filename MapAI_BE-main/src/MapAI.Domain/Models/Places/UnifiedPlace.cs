using System.Globalization;
using System.Text.RegularExpressions;
using MapAI.Domain.Entities;
using MapAI.Domain.Models.Osm;

namespace MapAI.Domain.Models.Places;
public sealed class UnifiedPlace
{
    public string CanonicalId { get; set; } = "";
    public string SourceType { get; set; } = "mapai_curated";
    public string NormalizedName { get; set; } = "";
    public string Name { get; set; } = "";
    public string? MapaiId { get; set; }
    public string? OsmType { get; set; }
    public string? OsmId { get; set; }
    public string? OsmCanonicalId { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }
    public string Address { get; set; } = "";
    public string? District { get; set; }
    public string CategoryMapping { get; set; } = "place";
    public string Category { get; set; } = "";
    public string? Description { get; set; }
    public string? Thumbnail { get; set; }
    public double? Rating { get; set; }
    public double? DistanceMeters { get; set; }
    public Dictionary<string, string> OsmTags { get; set; } = [];
    public List<string> Aliases { get; set; } = [];
    public bool ReferenceSynced => MapaiId != null && OsmType != null;
    // Compatibility for existing marker/route consumers; canonicalId remains authoritative.
    public string Id => CanonicalId;
    public string? LocationId => MapaiId;
    public string Source => SourceType == "openstreetmap" ? "openstreetmap" : "mapai";
}
public sealed record FederatedPlaceResult(List<UnifiedPlace> Places, Dictionary<string, string> SourceStatus, List<string> Warnings);
public static class UnifiedPlaceRules
{
    public static string Normalize(string value) => Regex.Replace(MapPlaceCategories.Normalize(value), "[^a-z0-9]+", " ").Trim();
    public static string? OsmCanonical(string? type, string? id) => type is "node" or "way" or "relation" &&
        long.TryParse(id, NumberStyles.None, CultureInfo.InvariantCulture, out var number) && number > 0 ? $"osm:{type}:{number}" : null;
    public static UnifiedPlace FromMapai(LocationEntity location)
    {
        var reference = location.OsmReferences.OrderBy(r => r.CanonicalId, StringComparer.Ordinal).FirstOrDefault();
        var canonical = location.IsOsmReference && reference != null ? reference.CanonicalId : $"mapai:{location.Id}";
        return new() { CanonicalId = canonical, SourceType = location.IsOsmReference ? "openstreetmap" : location.IsUserContribution ? "mapai_community" : "mapai_curated",
            MapaiId = location.Id, OsmType = reference?.OsmType, OsmId = reference?.OsmId, Name = location.Title, NormalizedName = Normalize(location.Title),
            Lat = location.Latitude, Lng = location.Longitude, Address = location.Address ?? "", Category = location.Category ?? "", CategoryMapping = MapPlaceCategories.FindForBrowse(location.Category)?.Id ?? "place",
            Description = location.Description, Thumbnail = location.Thumbnail, Rating = location.Rating,
            Aliases = new[] { canonical }.Concat(location.OsmReferences.Select(r => r.CanonicalId)).Distinct().ToList() };
    }
    public static double Similarity(string a, string b)
    {
        a = Normalize(a); b = Normalize(b); if (a.Length == 0 || b.Length == 0) return 0;
        var previous = Enumerable.Range(0, b.Length + 1).ToArray();
        for (var i = 1; i <= a.Length; i++) {
            var current = new int[b.Length + 1]; current[0] = i;
            for (var j = 1; j <= b.Length; j++) current[j] = Math.Min(current[j - 1] + 1, Math.Min(previous[j] + 1, previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1)));
            previous = current;
        }
        return 1 - previous[b.Length] / (double)Math.Max(a.Length, b.Length);
    }
    public static bool SamePlace(UnifiedPlace a, UnifiedPlace b) => a.CanonicalId == b.CanonicalId || a.Aliases.Contains(b.CanonicalId) || b.Aliases.Contains(a.CanonicalId) ||
        ((a.SourceType == "openstreetmap") != (b.SourceType == "openstreetmap") && MapDistance.Meters(a.Lat, a.Lng, b.Lat, b.Lng) < 50 && Similarity(a.Name, b.Name) > .8);
    public static List<UnifiedPlace> Merge(IEnumerable<UnifiedPlace> input)
    {
        var result = new List<UnifiedPlace>();
        foreach (var place in input.Where(p => MapDistance.Valid(p.Lat, p.Lng) && DaNangBounds.Contains(p.Lat, p.Lng))) {
            var existing = result.FindIndex(p => SamePlace(p, place));
            if (existing < 0) { result.Add(place); continue; }
            var previous = result[existing];
            var primary = previous.SourceType == "openstreetmap" && place.SourceType != "openstreetmap" ? place : previous;
            var osm = place.SourceType == "openstreetmap" ? place : previous.SourceType == "openstreetmap" ? previous : null;
            if (osm != null) { primary.Lat = osm.Lat; primary.Lng = osm.Lng; primary.OsmType = osm.OsmType; primary.OsmId = osm.OsmId; primary.OsmCanonicalId = osm.CanonicalId; }
            primary.Aliases = previous.Aliases.Concat(place.Aliases).Append(previous.CanonicalId).Append(place.CanonicalId).Distinct().ToList();
            result[existing] = primary;
        }
        return result;
    }
}
