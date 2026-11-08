using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;

namespace MapAI.Domain.Models.Osm;

public record MapPlaceCategory(string Id, string Name, string[] Filters, string[] Aliases);

public static class MapPlaceCategories
{
    // Filters are application constants; user/model text is never interpolated into Overpass QL.
    public static readonly IReadOnlyList<MapPlaceCategory> All = new[]
    {
        new MapPlaceCategory("fuel", "Cây xăng", ["[\"amenity\"=\"fuel\"]"], ["cay xang", "tram xang", "gas station", "petrol station", "fuel station", "gas", "petrol"]),
        new MapPlaceCategory("atm", "ATM", ["[\"amenity\"=\"atm\"]", "[\"amenity\"=\"bank\"][\"atm\"=\"yes\"]"], ["may rut tien", "rut tien", "atm ngan hang"]),
        new MapPlaceCategory("pharmacy", "Nhà thuốc", ["[\"amenity\"=\"pharmacy\"]"], ["nha thuoc", "hieu thuoc", "drugstore"]),
        new MapPlaceCategory("hospital", "Bệnh viện", ["[\"amenity\"=\"hospital\"]"], ["benh vien"]),
        new MapPlaceCategory("cafe", "Cà phê", ["[\"amenity\"=\"cafe\"]"], ["ca phe", "quan ca phe", "quan cafe", "coffee", "coffee shop"]),
        new MapPlaceCategory("restaurant", "Quán ăn", ["[\"amenity\"=\"restaurant\"]", "[\"amenity\"=\"fast_food\"]"], ["an uong", "quan an", "nha hang", "food", "fast food"]),
        new MapPlaceCategory("parking", "Bãi đỗ xe", ["[\"amenity\"=\"parking\"]"], ["bai do xe", "bai giu xe", "parking lot"]),
        new MapPlaceCategory("charging_station", "Trạm sạc", ["[\"amenity\"=\"charging_station\"]"], ["tram sac", "tram sac xe dien", "ev charging", "charging station"])
    };

    public static string Normalize(string value)
    {
        var builder = new StringBuilder();
        foreach (var ch in value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) builder.Append(ch == 'đ' ? 'd' : ch);
        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    public static MapPlaceCategory? Find(string? query)
    {
        if (string.IsNullOrWhiteSpace(query)) return null;
        var normalized = Normalize(query);
        return All.FirstOrDefault(category => category.Id == normalized || Normalize(category.Name) == normalized || category.Aliases.Contains(normalized));
    }
}

public class MapPlaceQuery
{
    [Required, Range(-90, 90)] public double? Lat { get; set; }
    [Required, Range(-180, 180)] public double? Lng { get; set; }
    [Required, StringLength(100)] public string Category { get; set; } = "";
    [Range(100, 20000)] public int Radius { get; set; } = 5000;
    [Range(1, 50)] public int Limit { get; set; } = 10;
}

public class NearestDirectionRequest : MapPlaceQuery
{
    [RegularExpression("^(driving|bicycle|foot)$")] public string Mode { get; set; } = "driving";
}

public class MapPlaceResult
{
    public string Id { get; set; } = "";
    public string? LocationId { get; set; }
    public string Name { get; set; } = "";
    public string? Address { get; set; }
    public string Category { get; set; } = "";
    public string Source { get; set; } = "";
    public double Lat { get; set; }
    public double Lng { get; set; }
    public double DistanceMeters { get; set; }
}

public class MapPlaceSearchResult
{
    public string Category { get; set; } = "";
    public string CategoryName { get; set; } = "";
    public int Radius { get; set; }
    public string DistanceBasis { get; set; } = "straight_line";
    public List<MapPlaceResult> Places { get; set; } = [];
    public List<string> Warnings { get; set; } = [];
}

public class NearestDirectionResult
{
    public MapPlaceSearchResult Search { get; set; } = new();
    public MapPlaceResult? Destination { get; set; }
    public object? Route { get; set; }
    public string Mode { get; set; } = "driving";
}

public static class MapDistance
{
    public static bool Valid(double lat, double lng) => double.IsFinite(lat) && double.IsFinite(lng) && Math.Abs(lat) <= 90 && Math.Abs(lng) <= 180;
    public static double Meters(double lat1, double lng1, double lat2, double lng2)
    {
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLng = (lng2 - lng1) * Math.PI / 180;
        var a = Math.Pow(Math.Sin(dLat / 2), 2) + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Pow(Math.Sin(dLng / 2), 2);
        return 6371000 * 2 * Math.Asin(Math.Sqrt(Math.Clamp(a, 0, 1)));
    }
}
