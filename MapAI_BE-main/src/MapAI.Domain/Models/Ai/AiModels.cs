using System.Text.Json.Serialization;

namespace MapAI.Domain.Models.Ai
{
    public class RouterResponse
    {
        [JsonPropertyName("category")]
        public string Category { get; set; } = string.Empty;

        [JsonPropertyName("action_type")]
        public string? ActionType { get; set; }

        [JsonPropertyName("target_location")]
        public string? TargetLocation { get; set; }

        [JsonPropertyName("search_query")]
        public string? SearchQuery { get; set; }
    }

    public class PlaceDetailResponse
    {
        [JsonPropertyName("message")]
        public string Message { get; set; } = string.Empty;

        [JsonPropertyName("suggestions")]
        public List<string> Suggestions { get; set; } = new();
    }

    public class LocationPickerResponse
    {
        [JsonPropertyName("selected_index")]
        public int SelectedIndex { get; set; }

        [JsonPropertyName("reason")]
        public string Reason { get; set; } = string.Empty;
    }

    public class AiFinalResponse
    {
        public string Message { get; set; } = string.Empty;
        public List<string> Suggestions { get; set; } = new();
        public AiAction? Action { get; set; }
        public AiLocation? Location { get; set; }
    }

    public class AiAction
    {
        public string Type { get; set; } = string.Empty;
        public object? Value { get; set; }
        public object? Destination { get; set; }
    }

    public class AiLocation
    {
        public string Name { get; set; } = string.Empty;
        public double Lat { get; set; }
        public double Lng { get; set; }
        public string Address { get; set; } = string.Empty;
    }

    public class AiRequest
    {
        public string UserInput { get; set; } = string.Empty;
        public List<ChatMessage> ChatHistory { get; set; } = new();
    }
}
