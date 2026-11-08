using System.Text.Json.Serialization;

namespace MapAI.Domain.Models.Foursquare
{
    public class FoursquareLocation
    {
        [JsonPropertyName("address")]
        public string? Address { get; set; }

        [JsonPropertyName("formatted_address")]
        public string? FormattedAddress { get; set; }

        [JsonPropertyName("locality")]
        public string? Locality { get; set; }

        [JsonPropertyName("region")]
        public string? Region { get; set; }

        [JsonPropertyName("postcode")]
        public string? Postcode { get; set; }

        [JsonPropertyName("country")]
        public string? Country { get; set; }
    }
}
