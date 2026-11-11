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
        private readonly ILogger<LocationController> _logger;

        public LocationController(ILocationService locationService, ILogger<LocationController> logger)
        {
            _locationService = locationService;
            _logger = logger;
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

        [Authorize(Policy = "UserOnly")]
        [HttpPost("upload-thumbnail")]
        [RequestSizeLimit(6 * 1024 * 1024)]
        [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
        public async Task<IActionResult> UploadThumbnail(IFormFile file)
        {
            try 
            {
                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "Vui lòng chọn một ảnh." });

                if (file.Length > 5 * 1024 * 1024)
                    return BadRequest(new { message = "Ảnh không được vượt quá 5 MB." });

                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
                var extension = Path.GetExtension(file.FileName).ToLower();
                if (!allowedExtensions.Contains(extension))
                    return BadRequest(new { message = "Chỉ chấp nhận ảnh JPG, PNG, GIF hoặc WebP." });

                using (var stream = file.OpenReadStream())
                {
                    var header = new byte[12];
                    var length = await stream.ReadAtLeastAsync(header, header.Length, throwOnEndOfStream: false);
                    var validImage = extension switch
                    {
                        ".jpg" or ".jpeg" => file.ContentType == "image/jpeg" && length >= 3 &&
                            header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff,
                        ".png" => file.ContentType == "image/png" && length >= 8 &&
                            header.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
                        ".gif" => file.ContentType == "image/gif" && length >= 6 &&
                            (header.AsSpan(0, 6).SequenceEqual("GIF87a"u8) || header.AsSpan(0, 6).SequenceEqual("GIF89a"u8)),
                        ".webp" => file.ContentType == "image/webp" && length >= 12 &&
                            header.AsSpan(0, 4).SequenceEqual("RIFF"u8) && header.AsSpan(8, 4).SequenceEqual("WEBP"u8),
                        _ => false
                    };
                    if (!validImage)
                        return BadRequest(new { message = "Nội dung tệp không phải ảnh hợp lệ hoặc không khớp định dạng." });

                    stream.Position = 0;
                    var url = await _locationService.UploadThumbnailAsync(
                        stream, 
                        file.FileName, 
                        file.ContentType);

                    return Ok(new { url });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not upload location photo");
                return StatusCode(500, new { message = "Không thể tải ảnh lên. Vui lòng thử lại." });
            }
        }
    }
}
