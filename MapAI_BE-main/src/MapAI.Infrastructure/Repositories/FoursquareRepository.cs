using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Web;
using MapAI.Domain.Models.Foursquare;
using MapAI.Domain.Ports;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace MapAI.Infrastructure.Repositories
{
    public class FoursquareRepository : IFoursquareRepository
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<FoursquareRepository> _logger;
        private readonly string _apiKey;
        private readonly string _version;
        private const string BaseUrl = "https://places-api.foursquare.com/places/search";

        public FoursquareRepository(HttpClient httpClient, ILogger<FoursquareRepository> logger, IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _apiKey = configuration["Foursquare:ApiKey"] ?? string.Empty;
            _version = configuration["Foursquare:Version"] ?? "2025-06-17";
        }

        public async Task<List<FoursquareNearbyResult>> SearchNearbyPlacesAsync(double lat, double lng, string query = "", int radius = 1000)
        {
            if (string.IsNullOrEmpty(_apiKey))
            {
                _logger.LogWarning("Foursquare API Key is not configured.");
                throw new HttpRequestException("Nguồn Foursquare chưa được cấu hình.");
            }

            try
            {
                var builder = new UriBuilder(BaseUrl);
                var queryParams = HttpUtility.ParseQueryString(string.Empty);
                queryParams["ll"] = $"{lat.ToString(CultureInfo.InvariantCulture)},{lng.ToString(CultureInfo.InvariantCulture)}";
                queryParams["radius"] = radius.ToString();
                queryParams["limit"] = "20";
                queryParams["sort"] = "DISTANCE";

                if (!string.IsNullOrEmpty(query))
                {
                    queryParams["query"] = query;
                }

                builder.Query = queryParams.ToString();

                var request = new HttpRequestMessage(HttpMethod.Get, builder.Uri);
                request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
                request.Headers.Add("X-Places-Api-Version", _version);

                var response = await _httpClient.SendAsync(request);
                var content = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Foursquare API error: {StatusCode} {Reason}. Content: {Content}", response.StatusCode, response.ReasonPhrase, content);
                    response.EnsureSuccessStatusCode();
                }

                _logger.LogInformation("Foursquare RAW Response: {Content}", content); // Log data để kiểm tra

                var data = JsonSerializer.Deserialize<FoursquareSearchResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (data?.Results == null)
                {
                    throw new HttpRequestException("Foursquare không trả về danh sách địa điểm hợp lệ.");
                }

                return data.Results.Select(place => new FoursquareNearbyResult
                {
                    FsqId = !string.IsNullOrEmpty(place.FsqId) ? place.FsqId : place.FsqPlaceId,
                    Source = "foursquare",
                    Name = place.Name,
                    Location = place.Location,
                    Categories = place.Categories,
                    Distance = place.Distance,
                    Geocodes = place.Geocodes,
                    DisplayName = $"{place.Name}, {(place.Location?.FormattedAddress ?? place.Location?.Address ?? string.Empty)}",
                    Lat = place.Latitude ?? place.Geocodes?.Main?.Latitude ?? 0,
                    Lng = place.Longitude ?? place.Geocodes?.Main?.Longitude ?? 0,
                    Type = "foursquare_place"
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching nearby places from Foursquare at {Lat}, {Lng}", lat, lng);
                throw new HttpRequestException("Nguồn Foursquare đang không khả dụng.", ex);
            }
        }
    }
}
