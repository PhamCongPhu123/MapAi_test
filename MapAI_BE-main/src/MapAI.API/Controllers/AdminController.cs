using MapAI.Application.Interfaces;
using MapAI.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MapAI.API.Controllers
{
    [Authorize(Policy = "AdminOnly")]
    [ApiController]
    [Route("api/v1/admin")]
    public class AdminController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AdminController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpGet("users")]
        public async Task<IActionResult> GetAllUsers()
        {
            try
            {
                var result = await _authService.GetAllUsersAsync();
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving users.", error = ex.Message });
            }
        }

        [HttpDelete("users/{userId}")]
        public async Task<IActionResult> DeleteUser(string userId)
        {
            try
            {
                await _authService.DeleteUserAsync(userId);
                return Ok(new { message = "User deleted successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Failed to delete user.", error = ex.Message });
            }
        }

        [HttpPatch("users/{userId}/toggle-status")]
        public async Task<IActionResult> ToggleUserStatus(string userId)
        {
            try
            {
                await _authService.ToggleUserStatusAsync(userId);
                return Ok(new { message = "User status updated successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Failed to update user status.", error = ex.Message });
            }
        }

        [HttpPatch("users/{userId}/role")]
        public async Task<IActionResult> ChangeUserRole(string userId, [FromQuery] EUser role)
        {
            try
            {
                await _authService.ChangeUserRoleAsync(userId, role);
                return Ok(new { message = "User role updated successfully." });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Failed to update user role.", error = ex.Message });
            }
        }
    }
}
