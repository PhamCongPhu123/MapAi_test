using System.Net;
using System.Net.Http.Json;
using System.Text;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Foursquare;
using MapAI.Domain.Models.Osm;
using MapAI.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace MapAI.Tests;

public class MapSearchTests
{
    private const string City = "/api/v1/map/city-wide?query=gas%20station";
    private const string Nearby = "/api/v1/map/nearby?lat=16.06&lng=108.22&query=gas%20station&radius=5000";
    private const string Nearest = "/api/v1/map/nearest?lat=16.06&lng=108.22&category=fuel&radius=5000";

    private static LocationEntity Station(string id = "new-station", LocationStatus status = LocationStatus.Approved) => new()
    {
        Id = id, Title = "Trạm xăng mới gần nhà", Category = "Cây xăng", Address = "12 Đường kiểm thử",
        Latitude = 16.0601, Longitude = 108.22, Status = status
    };

    [Fact]
    public async Task ApprovedContributionAppearsInBothCategoryButtonsAndAiSearch()
    {
        using var app = new MapAiFactory();
        var station = Station(status: LocationStatus.Pending);
        app.Locations.Add(station);
        using var client = app.CreateClient();
        Assert.Empty((await client.GetFromJsonAsync<MapPlaceSearchResult>(Nearest))!.Places);
        Assert.Empty((await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(City))!);
        Assert.Empty((await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(Nearby))!);

        // Simulate completion of moderation; no tile publishing or OSM write is needed.
        station.Status = LocationStatus.Approved;
        var nearest = Assert.Single((await client.GetFromJsonAsync<MapPlaceSearchResult>(Nearest))!.Places);
        foreach (var endpoint in new[] { City, Nearby })
        {
            var result = Assert.Single((await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(endpoint))!);
            Assert.Equal(nearest.LocationId, result.LocationId);
            Assert.Equal("mapai:new-station", result.FsqId);
            Assert.Equal("mapai", result.Source);
            Assert.Equal("fuel", Assert.Single(result.Categories!).Name);
            Assert.Equal(station.Address, result.DisplayName);
        }
    }

    [Theory]
    [InlineData(City)]
    [InlineData(Nearby)]
    public async Task CategoryButtonsMergeSourcesAndPreferStoredIdentityForDuplicates(string endpoint)
    {
        using var app = new MapAiFactory();
        app.Locations.Add(Station());
        app.ExternalPlaces.Add(new() { FsqId = "osm:node:1", Name = "TRẠM XĂNG MỚI GẦN NHÀ", Lat = 16.06011, Lng = 108.22 });
        app.ExternalPlaces.Add(new() { FsqId = "osm:node:2", Name = "Trạm OSM khác", Lat = 16.061, Lng = 108.22 });
        using var client = app.CreateClient();
        var result = (await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(endpoint))!;
        Assert.Equal(2, result.Count);
        Assert.Contains(result, p => p.LocationId == "new-station");
        Assert.Contains(result, p => p.FsqId == "osm:node:2");
        Assert.DoesNotContain(result, p => p.FsqId == "osm:node:1");
    }

    [Theory]
    [InlineData(City)]
    [InlineData(Nearby)]
    public async Task CategoryButtonsExcludeUnpublishedWrongCategoryAndOutOfScopePlaces(string endpoint)
    {
        using var app = new MapAiFactory();
        app.Locations.AddRange(new[] { Station(), Station("pending", LocationStatus.Pending), Station("rejected", LocationStatus.Rejected) });
        var deleted = Station("deleted"); deleted.IsDeleted = true; app.Locations.Add(deleted);
        var cafe = Station("cafe"); cafe.Category = "Cafe"; app.Locations.Add(cafe);
        var far = Station("other-city"); far.Latitude = 10; app.Locations.Add(far);
        var invalid = Station("invalid"); invalid.Latitude = double.NaN; app.Locations.Add(invalid);
        using var client = app.CreateClient();
        Assert.Equal("new-station", Assert.Single((await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(endpoint))!).LocationId);
    }

    [Theory]
    [InlineData("coffee", "Cafe")]
    [InlineData("restaurant", "Ăn uống")]
    [InlineData("hospital", "Bệnh viện")]
    [InlineData("atm bank", "ATM")]
    [InlineData("atm bank", "Ngân hàng")]
    [InlineData("bus station", "Trạm xe bus")]
    [InlineData("attraction", "Du lịch")]
    [InlineData("attraction", "Tourist attraction")]
    [InlineData("attraction", "Landmark")]
    public async Task OtherCategoryButtonsMatchStoredCategoryAliases(string query, string storedCategory)
    {
        using var app = new MapAiFactory();
        var place = Station(); place.Category = storedCategory; app.Locations.Add(place);
        using var client = app.CreateClient();
        Assert.Single((await client.GetFromJsonAsync<List<FoursquareNearbyResult>>($"/api/v1/map/city-wide?query={Uri.EscapeDataString(query)}"))!);
    }

    [Theory]
    [InlineData(City)]
    [InlineData(Nearby)]
    public async Task ExternalOutageDoesNotHideApprovedLocalPlaces(string endpoint)
    {
        using var app = new MapAiFactory { FailExternalPlaces = true };
        app.Locations.Add(Station());
        using var client = app.CreateClient();
        Assert.Equal("new-station", Assert.Single((await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(endpoint))!).LocationId);
    }

    [Theory]
    [InlineData(City)]
    [InlineData(Nearby)]
    public async Task AllSourcesUnavailableIsAnErrorInsteadOfAnEmptySearch(string endpoint)
    {
        using var app = new MapAiFactory { FailExternalPlaces = true, FailPlaces = true };
        using var client = app.CreateClient();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync(endpoint)).StatusCode);
    }

    [Theory]
    [InlineData(City)]
    [InlineData(Nearby)]
    public async Task FoursquareFallbackIsMergedWithLocalPlaces(string endpoint)
    {
        using var app = new MapAiFactory();
        app.Locations.Add(Station());
        app.FoursquarePlaces.Add(new() { FsqId = "fsq-1", Name = "Trạm dự phòng", Lat = 16.061, Lng = 108.22 });
        using var client = app.CreateClient();
        var result = (await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(endpoint))!;
        Assert.Equal(2, result.Count);
        Assert.Contains(result, p => p.LocationId == "new-station");
        Assert.Contains(result, p => p.FsqId == "fsq-1");
    }

    [Fact]
    public async Task NearbyAppliesExactRadiusWhileCityButtonsKeepTheirCityScope()
    {
        using var app = new MapAiFactory();
        app.Locations.Add(Station());
        var farther = Station("farther-in-city"); farther.Latitude = 16.15; app.Locations.Add(farther);
        using var client = app.CreateClient();
        Assert.Single((await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(Nearby))!);
        Assert.Equal(2, (await client.GetFromJsonAsync<List<FoursquareNearbyResult>>(City))!.Count);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task GasStationButtonUsesOsmFuelTagRatherThanAnEnglishNameRegex(bool cityWide)
    {
        var handler = new OverpassHandler();
        using var http = new HttpClient(handler);
        var osm = new OsmRepository(http, NullLogger<OsmRepository>.Instance);
        if (cityWide) await osm.SearchCityWideOverpassAsync("gas station");
        else await osm.SearchNearbyOverpassAsync(16.06, 108.22, "gas station", 2000);
        Assert.Contains("[\"amenity\"=\"fuel\"]", handler.Query);
        Assert.DoesNotContain("\"name\"~\"gas station\"", handler.Query);
        Assert.Contains(cityWide ? DaNangBounds.Overpass : "around:2000,16.06,108.22", handler.Query);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task OverpassFailureCannotMasqueradeAsAnEmptyCategorySearch(bool cityWide)
    {
        using var http = new HttpClient(new OverpassHandler { Json = "{\"remark\":\"query timed out\",\"elements\":[]}" });
        var osm = new OsmRepository(http, NullLogger<OsmRepository>.Instance);
        await Assert.ThrowsAsync<HttpRequestException>(() => cityWide ? osm.SearchCityWideOverpassAsync("gas station")
            : osm.SearchNearbyOverpassAsync(16.06, 108.22, "gas station", 2000));
    }

    [Theory]
    [InlineData(503, "{}")]
    [InlineData(200, "{}")]
    public async Task FoursquareFailureCannotMasqueradeAsAnEmptyCategorySearch(int status, string json)
    {
        using var http = new HttpClient(new OverpassHandler { Status = (HttpStatusCode)status, Json = json });
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Foursquare:ApiKey"] = "fixture-key" }).Build();
        var repository = new FoursquareRepository(http, NullLogger<FoursquareRepository>.Instance, config);
        await Assert.ThrowsAsync<HttpRequestException>(() => repository.SearchNearbyPlacesAsync(16.06, 108.22, "gas station", 2000));
    }

    private sealed class OverpassHandler : HttpMessageHandler
    {
        public string Query { get; private set; } = "";
        public string Json { get; set; } = "{\"elements\":[]}";
        public HttpStatusCode Status { get; set; } = HttpStatusCode.OK;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.Content != null) Query = WebUtility.UrlDecode(await request.Content.ReadAsStringAsync(cancellationToken));
            return new(Status) { Content = new StringContent(Json, Encoding.UTF8, "application/json") };
        }
    }
}
