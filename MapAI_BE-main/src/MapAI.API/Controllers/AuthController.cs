using MapAI.Application.Interfaces;
using MapAI.Application.Exceptions;
using MapAI.Domain.Models.Auth;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace MapAI.API.Controllers
{
    [ApiController]
    [Route("api/v1/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;
        private readonly ILogger<AuthController> _logger;

        public AuthController(IAuthService authService, ILogger<AuthController> logger)
        {
            _authService = authService;
            _logger = logger;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                var result = await _authService.LoginAsync(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return AuthFailure(ex, "Không thể đăng nhập lúc này. Vui lòng thử lại sau.");
            }
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> Refresh([FromBody] RefreshRequest request)
        {
            try
            {
                var result = await _authService.RefreshAsync(request);
                return Ok(result);
            }
            catch (Exception)
            {
                return Unauthorized(new { code = "SESSION_EXPIRED", message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
            }
        }

        [Authorize]
        [HttpPost("logout")]
        public async Task<IActionResult> Logout()
        {
            try
            {
                var userId = User.FindFirstValue("id");
                if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "User ID not found in token." });

                await _authService.LogoutAsync(userId);
                return Ok(new { message = "Logged out successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error during logout.", error = ex.Message });
            }
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            try
            {
                await _authService.RegisterAsync(request);
                return Ok(new { requiresEmailVerification = true, message = "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản; không cần quản trị viên duyệt." });
            }
            catch (Exception ex)
            {
                return AuthFailure(ex, "Không thể đăng ký lúc này. Vui lòng thử lại sau.");
            }
        }

        [HttpGet("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromQuery] string userId, [FromQuery] string token)
        {
            try
            {
                await _authService.VerifyEmailAsync(userId, token);
                return Ok(new { message = "Xác thực email thành công. Bạn có thể đăng nhập ngay." });
            }
            catch (Exception ex)
            {
                return AuthFailure(ex, "Không thể xác thực email lúc này. Vui lòng thử lại sau.");
            }
        }

        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest request)
        {
            try
            {
                await _authService.ResendVerificationEmailAsync(request.Email);
                return Ok(new { message = "Nếu email này đang chờ xác thực, một liên kết mới đã được gửi. Vui lòng kiểm tra cả thư mục Spam. Liên kết có hiệu lực 5 phút." });
            }
            catch (Exception ex)
            {
                return AuthFailure(ex, "Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.");
            }
        }

        [HttpPost("forgot-password")]
        [EnableRateLimiting("password-recovery")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            try
            {
                await _authService.ForgotPasswordAsync(request.Email);
                return Ok(new { message = "Nếu email đã được đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu. Vui lòng kiểm tra cả thư mục Spam." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not send password recovery email");
                return StatusCode(503, new { message = "Chưa thể gửi email khôi phục. Vui lòng thử lại sau." });
            }
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            try
            {
                await _authService.ResetPasswordAsync(request.UserId, request.Token, request.NewPassword);
                return Ok(new { message = "Password updated successfully." });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not reset password");
                return StatusCode(503, new { message = "Chưa thể đặt lại mật khẩu. Vui lòng thử lại sau." });
            }
        }

        [HttpPost("google-login")]
        public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
        {
            try
            {
                var result = await _authService.GoogleLoginAsync(request.IdToken);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return AuthFailure(ex, "Đăng nhập Google thất bại. Vui lòng thử lại hoặc đăng nhập bằng email.");
            }
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            try
            {
                var userId = User.FindFirstValue("id");
                if (string.IsNullOrEmpty(userId)) return Unauthorized(new { message = "Invalid token." });
                
                return Ok(new { 
                    id = userId, 
                    email = User.FindFirstValue(ClaimTypes.Email), 
                    role = User.FindFirstValue(ClaimTypes.Role) 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while retrieving your information.", error = ex.Message });
            }
        }

        private IActionResult AuthFailure(Exception exception, string fallback)
        {
            if (exception is AuthException failure)
                return StatusCode(failure.StatusCode, new { code = failure.Code, message = failure.Message });

            _logger.LogError("Authentication request failed ({FailureType}).", exception.GetType().Name);
            return StatusCode(500, new { code = "AUTH_UNAVAILABLE", message = fallback });
        }
    }
}
