using System;
using System.ComponentModel.DataAnnotations;
using MapAI.Domain.Common;

namespace MapAI.Domain.Entities
{
    public class LocationEntity : BaseEntity
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = null!; // "title" from SerpApi/Mock

        public string? PlaceId { get; set; } // "place_id" unique Google Maps ID
        
        public string? Address { get; set; } // Full address string
        
        public string? Description { get; set; } // Brief description or summary

        // GPS Coordinates
        public double Latitude { get; set; }
        public double Longitude { get; set; }

        // Media and Visuals
        public string? Thumbnail { get; set; } // Primary image URL
        public string? PhotosJson { get; set; } // JSON array of photo objects (thumbnail + image)

        // External Links
        public string? GoogleMapsUrl { get; set; }
        public string? Website { get; set; }
        public string? PhoneNumber { get; set; }

        // Ratings and Popularity
        public double? Rating { get; set; } // Average rating
        public int? TotalReviews { get; set; } // Total number of ratings/reviews

        // Categorization
        public string? Category { get; set; } // Main category (e.g., 'Tourist attraction')
        public string? Tags { get; set; } // Comma-separated or JSON tags for searching


        // Flexible data for other API-specific fields
        public string? RawDataJson { get; set; } 
    }
}
