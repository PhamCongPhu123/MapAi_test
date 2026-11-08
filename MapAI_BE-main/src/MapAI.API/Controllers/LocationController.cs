using System.Collections.Generic;
using System.Threading.Tasks;
using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Location;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MapAI.API.Controllers
{
    [ApiController]
    [Route("api/v1/location")]
    public class LocationController : ControllerBase
    {
        private readonly ILocationService _locationService;

        public LocationController(ILocationService locationService)
        {
            _locationService = locationService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LocationResponse>>> GetAll([FromQuery] string? title)
        {
            try 
            {
                var results = await _locationService.GetAllLocationsAsync(title);
                return Ok(results);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving locations.", error = ex.Message });
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<LocationResponse>> GetById(string id)
        {
            try
            {
                var result = await _locationService.GetLocationByIdAsync(id);
                return Ok(result);
            } 
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = $"Location with ID {id} not found." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred.", error = ex.Message });
            }
        }

        [HttpGet("title/{title}")]
        public async Task<ActionResult<LocationResponse>> GetByTitle(string title)
        {
            try
            {
                var result = await _locationService.GetLocationByTitleAsync(title);
                return Ok(result);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = $"Location with title '{title}' not found." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred.", error = ex.Message });
            }
        }

        [HttpGet("search")]
        public async Task<ActionResult<LocationResponse>> GetByDetails([FromQuery] string title, [FromQuery] double lat, [FromQuery] double lng)
        {
            try
            {
                var result = await _locationService.GetLocationByDetailsAsync(title, lat, lng);
                return Ok(result);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = "No matching location found for these details." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred.", error = ex.Message });
            }
        }

        [Authorize(Policy = "AdminOnly")] 
        [HttpPost]
        public async Task<ActionResult<LocationResponse>> Create([FromBody] CreateLocationRequest request)
        {
            try 
            {
                var result = await _locationService.CreateLocationAsync(request);
                return CreatedAtAction(nameof(GetById), new { id = result.Id }, result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Could not create location.", error = ex.Message });
            }
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPut("{id}")]
        public async Task<ActionResult<LocationResponse>> Update(string id, [FromBody] UpdateLocationRequest request)
        {
            try
            {
                var result = await _locationService.UpdateLocationAsync(id, request);
                return Ok(result);
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = $"Location with ID {id} not found." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Could not update location.", error = ex.Message });
            }
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            try
            {
                await _locationService.DeleteLocationAsync(id);
                return NoContent();
            }
            catch (KeyNotFoundException)
            {
                return NotFound(new { message = $"Location with ID {id} not found." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while deleting the location.", error = ex.Message });
            }
        }

        [Authorize(Policy = "AdminOnly")]
        [HttpPost("upload-thumbnail")]
        public async Task<IActionResult> UploadThumbnail(IFormFile file)
        {
            try 
            {
                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "No file uploaded." });

                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
                var extension = Path.GetExtension(file.FileName).ToLower();
                if (!allowedExtensions.Contains(extension))
                    return BadRequest(new { message = "Invalid file type. Only images are allowed." });

                using (var stream = file.OpenReadStream())
                {
                    var url = await _locationService.UploadThumbnailAsync(
                        stream, 
                        file.FileName, 
                        file.ContentType);

                    return Ok(new { url });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error uploading image to Supabase.", error = ex.Message });
            }
        }
    }
}
