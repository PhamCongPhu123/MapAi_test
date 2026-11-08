using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace MapAI.Domain.Models.Foursquare
{
    public class FoursquareSearchResponse
    {
        [JsonPropertyName("results")]
        public List<FoursquarePlace>? Results { get; set; }
    }
}
