using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace MapAI.Domain.Models.Foursquare
{
    public class FoursquarePlace
    {
        [JsonPropertyName("fsq_id")]
        public string FsqId { get; set; } = string.Empty;

        [JsonPropertyName("fsq_place_id")]
        public string FsqPlaceId { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("latitude")]
        public double? Latitude { get; set; }

        [JsonPropertyName("longitude")]
        public double? Longitude { get; set; }

        [JsonPropertyName("location")]
        public FoursquareLocation? Location { get; set; }

        [JsonPropertyName("categories")]
        public List<FoursquareCategory>? Categories { get; set; }

        [JsonPropertyName("distance")]
        public int? Distance { get; set; }

        [JsonPropertyName("geocodes")]
        public FoursquareGeocodes? Geocodes { get; set; }
    }
}
