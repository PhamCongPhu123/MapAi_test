using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Osm;
using MapAI.Domain.Models.Foursquare;
using MapAI.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace MapAI.API.Controllers
{
    [ApiController]
    [Route("api/v1/map")]
    public class MapController : ControllerBase
    {
        private readonly IMapService _mapService;
        private readonly IFoursquareService _foursquareService;
        private readonly IOsmRepository _osmRepository;
        private readonly ILogger<MapController> _logger;

        public MapController(IMapService mapService, IFoursquareService foursquareService, IOsmRepository osmRepository, ILogger<MapController> logger)
        {
            _mapService = mapService;
            _foursquareService = foursquareService;
            _osmRepository = osmRepository;
            _logger = logger;
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q)
        {
            try 
            {
                if (string.IsNullOrWhiteSpace(q))
                {
                    return BadRequest(new { message = "Query parameter 'q' is required." });
                }

                var results = await _mapService.SearchLocationsAsync(q);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Map Search API");
                return StatusCode(500, new { message = "Error searching with map service.", error = ex.Message });
            }
        }

        [HttpPost("direction")]
        public async Task<IActionResult> GetDirection([FromBody] OsmRouteRequest request)
        {
            try 
            {
                if (request == null)
                {
                    return BadRequest(new { message = "Invalid route request." });
                }

                var route = await _mapService.GetDirectionAsync(request);

                if (route == null)
                {
                    return NotFound(new { message = "Could not find a route between these locations." });
                }

                return Ok(route);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetDirection API");
                return StatusCode(500, new { message = "An internal error occurred while calculating directions.", error = ex.Message });
            }
        }

        [HttpGet("nearby")]
        public async Task<IActionResult> GetNearby([FromQuery] double lat, [FromQuery] double lng, [FromQuery] string? query = "", [FromQuery] int radius = 1000)
        {
            try 
            {
                // Tạm thời chuyển sang dùng Overpass API để tìm địa điểm nearby
                var overpassResults = await _osmRepository.SearchNearbyOverpassAsync(lat, lng, query ?? string.Empty, radius);
                
                if (overpassResults != null && overpassResults.Count > 0)
                {
                    return Ok(overpassResults);
                }

                // Delay 2 giây trước khi gọi Foursquare fallback
                await Task.Delay(2000);

                // Fallback sang Foursquare nếu Overpass không có kết quả
                var request = new FoursquareSearchRequest
                {
                    Lat = lat,
                    Lng = lng,
                    Query = query ?? string.Empty,
                    Radius = radius
                };

                var results = await _foursquareService.GetNearbyPlacesAsync(request);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetNearby API");
                return StatusCode(500, new { message = "An error occurred while fetching nearby places.", error = ex.Message });
            }
        }

        [HttpGet("city-wide")]
        public async Task<IActionResult> GetCityWide([FromQuery] string? query = "")
        {
            try 
            {
                var results = await _osmRepository.SearchCityWideOverpassAsync(query ?? string.Empty);
                
                if (results != null && results.Count > 0)
                {
                    return Ok(results);
                }

                // Delay 2 giây trước khi gọi Foursquare fallback
                await Task.Delay(2000);

                // Fallback sang Foursquare nếu Overpass không có kết quả
                var request = new FoursquareSearchRequest
                {
                    Lat = 16.0544, 
                    Lng = 108.2022,
                    Query = query ?? string.Empty,
                    Radius = 15000 // 15km bao phủ toàn thành phố
                };

                var foursquareResults = await _foursquareService.GetNearbyPlacesAsync(request);
                return Ok(foursquareResults);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetCityWide API");
                return StatusCode(500, new { message = "An error occurred while searching city-wide places.", error = ex.Message });
            }
        }
    }
}
