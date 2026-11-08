using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MapAI.Application.Interfaces;
using MapAI.Domain.Models.User;
using System.Security.Claims;

namespace MapAI.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/v1/user")]
    public class UserController : ControllerBase
    {
        private readonly IAuthService _authService;

        public UserController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpGet("infor")]
        public async Task<IActionResult> GetInfo()
        {
            try
            {
                var userId = User.FindFirst("id")?.Value;
                if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "Invalid token." });

                var result = await _authService.GetUserProfileAsync(userId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving profile.", error = ex.Message });
            }
        }

        [HttpPut("update-info")]
        public async Task<IActionResult> UpdateInfo([FromBody] UpdateUserRequest request)
        {
            try
            {
                var userId = User.FindFirst("id")?.Value;
                if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "Invalid token." });

                await _authService.UpdateUserAsync(userId, request);
                return Ok(new { message = "User information updated successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Update failed.", error = ex.Message });
            }
        }

        [HttpPost("update-avatar")]
        public async Task<IActionResult> UpdateAvatar(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest(new { message = "No file uploaded." });

                var userId = User.FindFirst("id")?.Value;
                if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "Invalid token." });

                // Validate file type
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp" };
                var extension = Path.GetExtension(file.FileName).ToLower();
                if (!allowedExtensions.Contains(extension))
                    return BadRequest(new { message = "Invalid file type. Only images are allowed." });

                using (var stream = file.OpenReadStream())
                {
                    var avatarUrl = await _authService.UpdateAvatarAsync(
                        userId, 
                        stream, 
                        file.FileName, 
                        file.ContentType);

                    return Ok(new { message = "Avatar updated successfully.", avatarUrl });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error updating avatar.", error = ex.Message });
            }
        }
    }
}
