using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace MapAI.Domain.Models.Osm
{
    public class NominatimResult
    {
        [JsonPropertyName("display_name")]
        public string DisplayName { get; set; } = string.Empty;

        [JsonPropertyName("lat")]
        public string Lat { get; set; } = string.Empty;

        [JsonPropertyName("lon")]
        public string Lon { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("address")]
        public Dictionary<string, string>? Address { get; set; }
    }

    public class OsmRouteRequest
    {
        public double StartLat { get; set; }
        public double StartLng { get; set; }
        public double EndLat { get; set; }
        public double EndLng { get; set; }
        public string Mode { get; set; } = "driving"; // driving, bicycle, foot
    }

    public class OverpassResponse
    {
        [JsonPropertyName("remark")]
        public string? Remark { get; set; }
        [JsonPropertyName("elements")]
        public List<OverpassElement>? Elements { get; set; }
    }

    public class OverpassElement
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("lat")]
        public double? Lat { get; set; }

        [JsonPropertyName("lon")]
        public double? Lon { get; set; }

        [JsonPropertyName("center")]
        public OverpassCenter? Center { get; set; }

        [JsonPropertyName("tags")]
        public Dictionary<string, string>? Tags { get; set; }
    }

    public class OverpassCenter
    {
        [JsonPropertyName("lat")]
        public double Lat { get; set; }
        [JsonPropertyName("lon")]
        public double Lon { get; set; }
    }
}
