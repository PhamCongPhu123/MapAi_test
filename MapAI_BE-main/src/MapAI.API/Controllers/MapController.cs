using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Osm;
using Microsoft.AspNetCore.Mvc;

namespace MapAI.API.Controllers
{
    [ApiController]
    [Route("api/v1/map")]
    public class MapController : ControllerBase
    {
        private readonly IMapService _mapService;
        private readonly ILogger<MapController> _logger;

        public MapController(IMapService mapService, ILogger<MapController> logger)
        {
            _mapService = mapService;
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

        [HttpGet("categories")]
        public IActionResult Categories() => Ok(MapPlaceCategories.All.Select(category => new { category.Id, category.Name }));

        [HttpGet("places")]
        public Task<IActionResult> FindPlaces([FromQuery] MapPlaceQuery request, CancellationToken cancellationToken) =>
            ExecutePlaceTool(() => _mapService.FindPlacesAsync(request, cancellationToken));

        [HttpGet("nearest")]
        public Task<IActionResult> FindNearest([FromQuery] MapPlaceQuery request, CancellationToken cancellationToken)
        {
            request.Limit = 1;
            return ExecutePlaceTool(() => _mapService.FindPlacesAsync(request, cancellationToken));
        }

        [HttpPost("nearest/direction")]
        public Task<IActionResult> DirectionToNearest([FromBody] NearestDirectionRequest request, CancellationToken cancellationToken) =>
            ExecutePlaceTool(() => _mapService.GetNearestDirectionAsync(request, cancellationToken));

        private async Task<IActionResult> ExecutePlaceTool<T>(Func<Task<T>> action)
        {
            try { return Ok(await action()); }
            catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
            catch (HttpRequestException error)
            {
                _logger.LogWarning(error, "Map place tool source unavailable");
                return StatusCode(503, new { message = "Nguồn dữ liệu bản đồ đang không khả dụng. Vui lòng thử lại sau." });
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
        public Task<IActionResult> GetNearby([FromQuery] double lat, [FromQuery] double lng, [FromQuery] string? query = "", [FromQuery] int radius = 1000) =>
            ExecutePlaceTool(() => _mapService.SearchNearbyPlacesAsync(lat, lng, query ?? string.Empty, radius));

        [HttpGet("city-wide")]
        public Task<IActionResult> GetCityWide([FromQuery] string? query = "") =>
            ExecutePlaceTool(() => _mapService.SearchCityWidePlacesAsync(query ?? string.Empty));
    }
}
