using System.Text.Json.Serialization;

namespace MapAI.Domain.Models.Foursquare
{
    public class FoursquareCategory
    {
        [JsonPropertyName("fsq_category_id")]
        public string? Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;
    }
}
