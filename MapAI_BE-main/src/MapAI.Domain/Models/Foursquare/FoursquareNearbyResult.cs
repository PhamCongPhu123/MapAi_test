using System.Collections.Generic;

namespace MapAI.Domain.Models.Foursquare
{
    public class FoursquareNearbyResult
    {
        public string FsqId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public FoursquareLocation? Location { get; set; }
        public List<FoursquareCategory>? Categories { get; set; }
        public int? Distance { get; set; }
        public FoursquareGeocodes? Geocodes { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public double Lat { get; set; }
        public double Lng { get; set; }
        public string Type { get; set; } = "foursquare_place";
    }
}
