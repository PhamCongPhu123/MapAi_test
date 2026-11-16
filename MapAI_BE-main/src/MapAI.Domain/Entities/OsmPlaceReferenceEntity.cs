namespace MapAI.Domain.Entities;
public sealed class OsmPlaceReferenceEntity
{
    public string CanonicalId { get; set; } = "";
    public string OsmType { get; set; } = "";
    public string OsmId { get; set; } = "";
    public string LocationId { get; set; } = "";
    public LocationEntity Location { get; set; } = null!;
    public DateTimeOffset VerifiedAt { get; set; }
}
