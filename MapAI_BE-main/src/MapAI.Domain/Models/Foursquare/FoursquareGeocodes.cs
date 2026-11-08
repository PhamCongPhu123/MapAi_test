using System.Text.Json.Serialization;

namespace MapAI.Domain.Models.Foursquare
{
    public class FoursquareGeocodes
    {
        [JsonPropertyName("main")]
        public FoursquarePoint? Main { get; set; }

        [JsonPropertyName("roof")]
        public FoursquarePoint? Roof { get; set; }
    }
}
