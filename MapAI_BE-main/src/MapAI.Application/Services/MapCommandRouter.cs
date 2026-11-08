using System.Globalization;
using System.Text.RegularExpressions;
using MapAI.Domain.Models.Ai;
using MapAI.Domain.Models.Osm;

namespace MapAI.Application.Services;

// Unambiguous common commands work without a model call. More complex language
// still uses the Gemini router; neither path generates executable browser code.
public static class MapCommandRouter
{
    private static readonly IReadOnlyDictionary<string, string> Commands = new Dictionary<string, string>
    {
        ["phong to"] = "ZoomIn", ["phong to ban do"] = "ZoomIn", ["thu nho"] = "ZoomOut", ["thu nho ban do"] = "ZoomOut",
        ["ve vi tri cua toi"] = "Locate", ["vi tri cua toi"] = "Locate", ["toi dang o dau"] = "Locate",
        ["quay ve huong bac"] = "ResetNorth", ["dat lai huong bac"] = "ResetNorth",
        ["xoa ket qua tim kiem"] = "ClearResults", ["xoa tuyen duong"] = "ClearRoute",
        ["chi duong den do"] = "DirectionSelected", ["chi duong toi do"] = "DirectionSelected"
    };

    public static RouterResponse? TryParse(string input)
    {
        var normalized = MapPlaceCategories.Normalize(input).Trim(' ', '.', '!', '?');
        if (Commands.TryGetValue(normalized, out var action)) return new() { Category = "action_map", ActionType = action };
        var aliases = MapPlaceCategories.All.SelectMany(category => category.Aliases.Append(category.Id).Append(MapPlaceCategories.Normalize(category.Name)))
            .Distinct().OrderByDescending(s => s.Length).Select(Regex.Escape);
        var pattern = @"^(?:(?:toi muon|hay|vui long|ban oi)\s+)*(?<verb>tim giup toi|tim cho toi|tim|cho toi|chi duong den|chi duong toi|dan duong den|dan duong toi)?\s*(?<category>"
            + string.Join("|", aliases) + @")\s+(?<near>gan nhat|gan day nhat|gan day|gan toi|quanh toi)(?:\s+(?:voi toi|o day))?(?:\s+(?:trong ban kinh|ban kinh|trong pham vi)\s+(?<radius>\d+(?:[.,]\d+)?)\s*(?<unit>km|m))?(?:\s+(?<mode>di bo|bang xe dap|di xe dap|bang o to|di o to|bang xe may))?$";
        var match = Regex.Match(normalized, pattern, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(100));
        if (!match.Success) return null;
        var verb = match.Groups["verb"].Value;
        var direction = verb.StartsWith("chi duong") || verb.StartsWith("dan duong");
        var radius = 5000;
        if (match.Groups["radius"].Success)
        {
            if (!double.TryParse(match.Groups["radius"].Value.Replace(',', '.'), CultureInfo.InvariantCulture, out var requested)) return null;
            requested *= match.Groups["unit"].Value == "km" ? 1000 : 1;
            radius = requested > int.MaxValue ? int.MaxValue : (int)requested;
        }
        return new()
        {
            Category = "action_map", ActionType = direction ? "NearestDirection" : match.Groups["near"].Value.Contains("nhat") ? "Nearest" : "Nearby",
            SearchQuery = MapPlaceCategories.Find(match.Groups["category"].Value)!.Id, RadiusMeters = radius,
            TravelMode = match.Groups["mode"].Value.Contains("bo") ? "foot" : match.Groups["mode"].Value.Contains("xe dap") ? "bicycle" : "driving"
        };
    }
}
