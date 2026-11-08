using System;

namespace MapAI.Domain.Models.Location
{
    public class LocationResponse
    {
        public string Id { get; set; } = null!;
        public string Title { get; set; } = null!;
        public string? PlaceId { get; set; }
        public string? Address { get; set; }
        public string? Description { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public string? Thumbnail { get; set; }
        public string? GoogleMapsUrl { get; set; }
        public string? Website { get; set; }
        public string? PhoneNumber { get; set; }
        public double? Rating { get; set; }
        public int? TotalReviews { get; set; }
        public string? Category { get; set; }
        public string? Tags { get; set; }
        public List<string>? Images { get; set; }
    }
}
