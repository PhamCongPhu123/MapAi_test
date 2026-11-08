namespace MapAI.Domain.Models.Foursquare
{
    public class FoursquareSearchRequest
    {
        public double Lat { get; set; }
        public double Lng { get; set; }
        public string Query { get; set; } = string.Empty;
        public int Radius { get; set; } = 1000;
    }
}
