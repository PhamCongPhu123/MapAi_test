using Google.Apis.Auth;
using MapAI.Infrastructure.Interfaces;
using MapAI.Application.Interfaces;
using MapAI.Application.Exceptions;
using MapAI.Common.Helpers;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Auth;
using MapAI.Domain.Models.User;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;

namespace MapAI.Application.Services
{
    public class AuthService : IAuthService
    {
        private readonly IUserRepository _userRepository;
        private readonly IAccountTokenRepository _tokenRepository;
        private readonly IEmailRepository _emailRepository;
        private readonly IJwtRepository _jwtRepository;
        private readonly IConfiguration _config;
        private readonly IStorageRepository _storageRepository;
        private readonly ILogger<AuthService> _logger;

        public AuthService(
            IUserRepository userRepository,
            IAccountTokenRepository tokenRepository,
            IEmailRepository emailRepository,
            IJwtRepository jwtRepository,
            IConfiguration config,
            IStorageRepository storageRepository,
            ILogger<AuthService> logger)
        {
            _userRepository = userRepository;
            _tokenRepository = tokenRepository;
            _emailRepository = emailRepository;
            _jwtRepository = jwtRepository;
            _config = config;
            _storageRepository = storageRepository;
            _logger = logger;
        }

        public async Task<LoginResponse> LoginAsync(LoginRequest request)
        {
            var user = await _userRepository.GetByEmailAsync(request.Email);
            if (user == null || !HashHelper.Verify(request.Password, user.PasswordHash))
            {
                throw new AuthException(401, "INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.");
            }

            if (!user.IsActive)
            {
                var verification = await _tokenRepository.GetByUserAndType(user.Id, ETokenType.EmailVerification);
                if (verification is { IsDeleted: false })
                    throw new AuthException(403, "EMAIL_NOT_VERIFIED", "Bạn chưa xác thực email. Hãy mở liên kết trong email hoặc gửi lại email xác thực; không cần quản trị viên duyệt.");
                throw new AuthException(403, "ACCOUNT_DISABLED", "Tài khoản đã bị vô hiệu hóa.");
            }

            var accessToken = _jwtRepository.GenerateAccessToken(user);
            var refreshToken = _jwtRepository.GenerateRefreshToken();

            var tokenEntity = new AccountTokenEntity
            {
                UserId = user.Id,
                TokenHash = HashHelper.Hash(refreshToken),
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(30),
                Type = ETokenType.RefreshToken
            };

            await _tokenRepository.DeleteByUserAndType(user.Id, ETokenType.RefreshToken);
            await _tokenRepository.AddAsync(tokenEntity);

            return new LoginResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken
            };
        }

        public async Task<RefreshResponse> RefreshAsync(RefreshRequest request)
        {
            var entity = await _tokenRepository.GetByUserAndType(request.UserId, ETokenType.RefreshToken);
            if (entity == null || entity.ExpiresAt < DateTimeOffset.UtcNow)
                throw new Exception("Refresh token expired");

            if (!HashHelper.Verify(request.RefreshToken, entity.TokenHash))
                throw new Exception("Invalid refresh token");

            var user = await _userRepository.GetByIdOrEmailAsync(request.UserId);
            if (user == null || !user.IsActive) throw new AuthException(401, "SESSION_EXPIRED", "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.");

            var newAccessToken = _jwtRepository.GenerateAccessToken(user);
            var newRefreshToken = _jwtRepository.GenerateRefreshToken();

            entity.TokenHash = HashHelper.Hash(newRefreshToken);
            entity.ExpiresAt = DateTimeOffset.UtcNow.AddDays(30);
            await _tokenRepository.UpdateAsync(entity);

            return new RefreshResponse
            {
                AccessToken = newAccessToken,
                RefreshToken = newRefreshToken
            };
        }

        public async Task LogoutAsync(string userId)
        {
            await _tokenRepository.DeleteByUserAndType(userId, ETokenType.RefreshToken);
        }

        public async Task RegisterAsync(RegisterRequest request)
        {
            var existing = await _userRepository.GetByEmailAsync(request.Email);
            if (existing != null) throw new AuthException(409, "EMAIL_EXISTS", "Email đã được đăng ký. Bạn có thể đăng nhập hoặc gửi lại email xác thực.");

            var user = new UserEntity
            {
                Id = Guid.NewGuid().ToString(),
                Email = request.Email.Trim().ToLowerInvariant(),
                FullName = request.FullName.Trim(),
                PhoneNumber = request.PhoneNumber,
                PasswordHash = HashHelper.Hash(request.Password),
                Role = EUser.User,
                IsActive = false,
                DateOfBirth = DateTime.SpecifyKind(DateTime.Parse(request.DateOfBirth), DateTimeKind.Utc)
            };

            await _userRepository.AddAsync(user);
            await GenerateAndSendVerificationEmail(user);
        }

        public async Task VerifyEmailAsync(string userId, string token)
        {
            var entity = await _tokenRepository.GetByUserAndType(userId, ETokenType.EmailVerification);
            if (entity == null)
                throw new AuthException(400, "VERIFICATION_EXPIRED", "Liên kết xác thực đã hết hạn hoặc không còn hợp lệ. Nếu đã xác thực email, bạn có thể đăng nhập; nếu chưa, hãy gửi lại email xác thực.");

            // Support links sent by earlier versions, which did not URL-encode '+'.
            if (!HashHelper.Verify(token.Replace(' ', '+'), entity.TokenHash))
                throw new AuthException(400, "VERIFICATION_INVALID", "Liên kết xác thực không hợp lệ. Vui lòng gửi lại email xác thực.");

            if (!await _tokenRepository.CompleteEmailVerificationAsync(entity))
                throw new AuthException(400, "VERIFICATION_EXPIRED", "Liên kết xác thực đã hết hạn hoặc không còn hợp lệ. Nếu đã xác thực email, bạn có thể đăng nhập; nếu chưa, hãy gửi lại email xác thực.");
        }

        public async Task ResendVerificationEmailAsync(string email)
        {
            var user = await _userRepository.GetByEmailAsync(email);
            if (user == null || user.IsActive) return;

            // Only accounts awaiting email verification may self-activate.
            // Disabled accounts have no verification token and stay disabled.
            var pending = await _tokenRepository.GetByUserAndType(user.Id, ETokenType.EmailVerification);
            if (pending == null || pending.IsDeleted) return;
            if (pending.CreatedAt > DateTimeOffset.UtcNow.AddMinutes(-1))
                throw new AuthException(429, "VERIFICATION_COOLDOWN", "Vui lòng chờ 60 giây giữa hai lần gửi email xác thực.");

            await GenerateAndSendVerificationEmail(user);
        }

        public async Task<bool> ForgotPasswordAsync(string email)
        {
            var user = await _userRepository.GetByEmailAsync(email.Trim());
            // Return the same result for unknown accounts so email addresses cannot be enumerated.
            if (user == null) return true;

            var frontendUrl = _config["FrontendUrl"]?.TrimEnd('/');
            if (!Uri.TryCreate(frontendUrl, UriKind.Absolute, out var frontendUri) ||
                (frontendUri.Scheme != Uri.UriSchemeHttp && frontendUri.Scheme != Uri.UriSchemeHttps))
                throw new InvalidOperationException("FrontendUrl must be an absolute HTTP(S) URL.");

            // 256 random bits; URL safe and below BCrypt's 72-byte input limit.
            var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            var tokenEntity = new AccountTokenEntity
            {
                UserId = user.Id,
                TokenHash = HashHelper.Hash(rawToken),
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes((double)EExpiredTime.ForgotPassword),
                Type = ETokenType.PasswordReset
            };

            await _tokenRepository.DeleteByUserAndType(user.Id, ETokenType.PasswordReset);
            await _tokenRepository.AddAsync(tokenEntity);

            var resetLink = $"{frontendUrl}/reset-password?userId={Uri.EscapeDataString(user.Id)}&token={Uri.EscapeDataString(rawToken)}";
            var safeLink = System.Net.WebUtility.HtmlEncode(resetLink);
            await _emailRepository.SendEmailAsync(user.Email, "Đặt lại mật khẩu MapAI",
                $"<p>Bạn vừa yêu cầu đặt lại mật khẩu MapAI.</p><p><a href=\"{safeLink}\">Đặt lại mật khẩu</a></p>" +
                "<p>Liên kết có hiệu lực trong 60 phút và chỉ dùng một lần. Nếu không yêu cầu, bạn có thể bỏ qua email này.</p>");

            return true;
        }

        public async Task ResetPasswordAsync(string userId, string token, string newPassword)
        {
            if (string.IsNullOrEmpty(newPassword) || newPassword.Length < 6 ||
                System.Text.Encoding.UTF8.GetByteCount(newPassword) > 72)
                throw new ArgumentException("Mật khẩu phải có ít nhất 6 ký tự và không vượt quá 72 byte UTF-8.");

            var entity = await _tokenRepository.GetByUserAndType(userId, ETokenType.PasswordReset);
            if (entity == null || entity.IsDeleted || entity.ExpiresAt <= DateTimeOffset.UtcNow)
                throw new ArgumentException("Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.");

            if (!HashHelper.Verify(token, entity.TokenHash))
                throw new ArgumentException("Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.");

            if (!await _tokenRepository.CompletePasswordResetAsync(entity, HashHelper.Hash(newPassword)))
                throw new ArgumentException("Liên kết không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới.");
        }

        public async Task<LoginResponse> GoogleLoginAsync(string idToken)
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _config["Google:ClientId"] }
            });

            var user = await _userRepository.GetByEmailAsync(payload.Email);
            bool isNewUser = false;

            if (user == null)
            {
                isNewUser = true;
                user = new UserEntity
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = payload.Email.Trim().ToLowerInvariant(),
                    FullName = payload.Name,
                    IsActive = true,
                    Role = EUser.User,
                    PasswordHash = HashHelper.Hash(Guid.NewGuid().ToString()),
                    PhoneNumber = "",
                    DateOfBirth = DateTimeOffset.UtcNow
                };
                await _userRepository.AddAsync(user);
            }

            if (!user.IsActive)
                throw new AuthException(403, "ACCOUNT_INACTIVE", "Tài khoản chưa được kích hoạt hoặc đã bị vô hiệu hóa. Vui lòng đăng nhập bằng email để xem hướng dẫn.");

            var accessToken = _jwtRepository.GenerateAccessToken(user);
            var refreshToken = _jwtRepository.GenerateRefreshToken();

            var tokenEntity = new AccountTokenEntity
            {
                UserId = user.Id,
                TokenHash = HashHelper.Hash(refreshToken),
                ExpiresAt = DateTimeOffset.UtcNow.AddDays(30),
                Type = ETokenType.RefreshToken
            };

            await _tokenRepository.DeleteByUserAndType(user.Id, ETokenType.RefreshToken);
            await _tokenRepository.AddAsync(tokenEntity);

            return new LoginResponse
            {
                AccessToken = accessToken,
                RefreshToken = refreshToken,
                IsRegistered = !isNewUser
            };
        }

        private async Task GenerateAndSendVerificationEmail(UserEntity user)
        {
            var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            var tokenEntity = new AccountTokenEntity
            {
                UserId = user.Id,
                TokenHash = HashHelper.Hash(rawToken),
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes((double)EExpiredTime.VerifyEmail),
                Type = ETokenType.EmailVerification
            };

            await _tokenRepository.DeleteByUserAndType(user.Id, ETokenType.EmailVerification);
            await _tokenRepository.AddAsync(tokenEntity);

            var verifyLink = BuildAccountLink("verify-email", user.Id, rawToken);
            try
            {
                await _emailRepository.SendEmailAsync(user.Email, "Xác thực email MapAI", $"<p>Nhấn vào <a href=\"{System.Net.WebUtility.HtmlEncode(verifyLink)}\">Xác thực email</a> để hoàn tất đăng ký MapAI. Liên kết có hiệu lực {(int)EExpiredTime.VerifyEmail} phút.</p><p>Bạn không cần chờ quản trị viên duyệt tài khoản.</p>");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Verification email delivery failed ({FailureType}).", ex.GetType().Name);
                throw new AuthException(503, "VERIFICATION_EMAIL_UNAVAILABLE", "Tài khoản chưa được xác thực vì không gửi được email. Vui lòng thử Gửi lại email xác thực sau.");
            }
        }

        private string BuildAccountLink(string path, string userId, string token)
        {
            var frontendUrl = _config["FrontendUrl"]?.TrimEnd('/')
                ?? throw new InvalidOperationException("FrontendUrl is not configured.");
            return $"{frontendUrl}/{path}?userId={Uri.EscapeDataString(userId)}&token={Uri.EscapeDataString(token)}";
        }

        public async Task UpdateUserAsync(string userId, UpdateUserRequest request)
        {
            var user = await _userRepository.GetByIdOrEmailAsync(userId);
            if (user == null) throw new Exception("User not found");

            if (!string.IsNullOrEmpty(request.FullName)) user.FullName = request.FullName;
            if (!string.IsNullOrEmpty(request.PhoneNumber)) user.PhoneNumber = request.PhoneNumber;
            if (!string.IsNullOrEmpty(request.DateOfBirth)) user.DateOfBirth = DateTime.SpecifyKind(DateTime.Parse(request.DateOfBirth), DateTimeKind.Utc);

            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _userRepository.UpdateAsync(user);
        }

        public async Task<string> UpdateAvatarAsync(string userId, Stream avatarStream, string fileName, string contentType)
        {
            var user = await _userRepository.GetByIdOrEmailAsync(userId);
            if (user == null) throw new Exception("User not found");

            var oldAvatarUrl = user.AvatarUrl;
            var newFileName = $"{userId}_{DateTime.UtcNow.Ticks}_{fileName}";
            
            var newAvatarUrl = await _storageRepository.UploadFileAsync(avatarStream, newFileName, contentType, "avatars");
            
            user.AvatarUrl = newAvatarUrl;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _userRepository.UpdateAsync(user);

            if (!string.IsNullOrEmpty(oldAvatarUrl))
            {
                try { await _storageRepository.DeleteFileAsync(oldAvatarUrl, "avatars"); } catch { /* Ignore delete errors */ }
            }

            return newAvatarUrl;
        }

        public async Task<UserProfileResponse> GetUserProfileAsync(string userId)
        {
            var user = await _userRepository.GetByIdOrEmailAsync(userId);
            if (user == null) throw new Exception("User not found");

            return new UserProfileResponse
            {
                Id = user.Id,
                Email = user.Email,
                FullName = user.FullName,
                AvatarUrl = user.AvatarUrl,
                PhoneNumber = user.PhoneNumber,
                DateOfBirth = user.DateOfBirth.ToString("yyyy-MM-dd"),
                Role = user.Role.ToString()
            };
        }

        // Admin Methods
        public async Task<IEnumerable<UserProfileResponse>> GetAllUsersAsync()
        {
            var users = await _userRepository.GetAllAsync();
            return users.Select(u => new UserProfileResponse
            {
                Id = u.Id,
                Email = u.Email,
                FullName = u.FullName,
                AvatarUrl = u.AvatarUrl,
                PhoneNumber = u.PhoneNumber,
                DateOfBirth = u.DateOfBirth.ToString("yyyy-MM-dd"),
                Role = u.Role.ToString()
            });
        }

        public async Task DeleteUserAsync(string userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) throw new Exception("User not found");

            // Xóa ảnh đại diện nếu có
            if (!string.IsNullOrEmpty(user.AvatarUrl))
            {
                try { await _storageRepository.DeleteFileAsync(user.AvatarUrl, "avatars"); } catch { /* Ignore */ }
            }

            // Xóa các Token liên quan
            await _tokenRepository.DeleteByUserAndType(userId, ETokenType.RefreshToken);
            await _tokenRepository.DeleteByUserAndType(userId, ETokenType.EmailVerification);
            await _tokenRepository.DeleteByUserAndType(userId, ETokenType.PasswordReset);

            // Xóa User
            await _userRepository.DeleteAsync(userId);
        }

        public async Task ToggleUserStatusAsync(string userId)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) throw new Exception("User not found");

            user.IsActive = !user.IsActive;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _userRepository.UpdateAsync(user);
            // An old email/refresh link must not reactivate a disabled account.
            await _tokenRepository.DeleteByUserAndType(userId, ETokenType.EmailVerification);
            if (!user.IsActive)
                await _tokenRepository.DeleteByUserAndType(userId, ETokenType.RefreshToken);
        }

        public async Task ChangeUserRoleAsync(string userId, EUser role)
        {
            var user = await _userRepository.GetByIdAsync(userId);
            if (user == null) throw new Exception("User not found");

            user.Role = role;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _userRepository.UpdateAsync(user);
        }
    }
}
