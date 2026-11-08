using Google.Apis.Auth;
using MapAI.Infrastructure.Interfaces;
using MapAI.Application.Interfaces;
using MapAI.Common.Helpers;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Auth;
using MapAI.Domain.Models.User;
using Microsoft.Extensions.Configuration;
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

        public AuthService(
            IUserRepository userRepository,
            IAccountTokenRepository tokenRepository,
            IEmailRepository emailRepository,
            IJwtRepository jwtRepository,
            IConfiguration config,
            IStorageRepository storageRepository)
        {
            _userRepository = userRepository;
            _tokenRepository = tokenRepository;
            _emailRepository = emailRepository;
            _jwtRepository = jwtRepository;
            _config = config;
            _storageRepository = storageRepository;
        }

        public async Task<LoginResponse> LoginAsync(LoginRequest request)
        {
            var user = await _userRepository.GetByIdOrEmailAsync(request.Email);
            if (user == null || !HashHelper.Verify(request.Password, user.PasswordHash))
            {
                throw new Exception("Invalid credentials");
            }

            if (!user.IsActive)
            {
                throw new Exception("Account not active");
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
            if (user == null) throw new Exception("User not found");

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
            var existing = await _userRepository.GetByIdOrEmailAsync(request.Email);
            if (existing != null) throw new Exception("Email already exists");

            var user = new UserEntity
            {
                Id = Guid.NewGuid().ToString(),
                Email = request.Email,
                FullName = request.FullName,
                PhoneNumber = request.PhoneNumber,
                PasswordHash = HashHelper.Hash(request.Password),
                Role = request.Role,
                IsActive = false,
                DateOfBirth = DateTime.SpecifyKind(DateTime.Parse(request.DateOfBirth), DateTimeKind.Utc)
            };

            await _userRepository.AddAsync(user);
            await GenerateAndSendVerificationEmail(user);
        }

        public async Task VerifyEmailAsync(string userId, string token)
        {
            var entity = await _tokenRepository.GetByUserAndType(userId, ETokenType.EmailVerification);
            if (entity == null || entity.ExpiresAt < DateTimeOffset.UtcNow)
                throw new Exception("Verification token expired");

            if (!HashHelper.Verify(token, entity.TokenHash))
                throw new Exception("Invalid verification token");

            var user = await _userRepository.GetByIdOrEmailAsync(userId);
            if (user == null) throw new Exception("User not found");

            user.IsActive = true;
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _userRepository.UpdateAsync(user);
            await _tokenRepository.DeleteAsync(entity.Id);
        }

        public async Task<bool> ForgotPasswordAsync(string email)
        {
            var user = await _userRepository.GetByIdOrEmailAsync(email);
            if (user == null) throw new Exception("User not found");

            var rawToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
            var tokenEntity = new AccountTokenEntity
            {
                UserId = user.Id,
                TokenHash = HashHelper.Hash(rawToken),
                ExpiresAt = DateTimeOffset.UtcNow.AddMinutes((double)EExpiredTime.ForgotPassword),
                Type = ETokenType.PasswordReset
            };

            await _tokenRepository.DeleteByUserAndType(user.Id, ETokenType.PasswordReset);
            await _tokenRepository.AddAsync(tokenEntity);

            var resetLink = $"{_config["FrontendUrl"]}/reset-password?userId={user.Id}&token={rawToken}";
            await _emailRepository.SendEmailAsync(user.Email, "Reset Password", $"Click here to reset your password: {resetLink}");

            return true;
        }

        public async Task ResetPasswordAsync(string userId, string token, string newPassword)
        {
            var entity = await _tokenRepository.GetByUserAndType(userId, ETokenType.PasswordReset);
            if (entity == null || entity.ExpiresAt < DateTimeOffset.UtcNow)
                throw new Exception("Reset token expired");

            if (!HashHelper.Verify(token, entity.TokenHash))
                throw new Exception("Invalid reset token");

            var user = await _userRepository.GetByIdOrEmailAsync(userId);
            if (user == null) throw new Exception("User not found");

            user.PasswordHash = HashHelper.Hash(newPassword);
            user.UpdatedAt = DateTimeOffset.UtcNow;
            await _userRepository.UpdateAsync(user);
            await _tokenRepository.DeleteAsync(entity.Id);
        }

        public async Task<LoginResponse> GoogleLoginAsync(string idToken)
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _config["Google:ClientId"] }
            });

            var user = await _userRepository.GetByIdOrEmailAsync(payload.Email);
            bool isNewUser = false;

            if (user == null)
            {
                isNewUser = true;
                user = new UserEntity
                {
                    Id = Guid.NewGuid().ToString(),
                    Email = payload.Email,
                    FullName = payload.Name,
                    IsActive = true,
                    Role = EUser.User,
                    PasswordHash = HashHelper.Hash(Guid.NewGuid().ToString()),
                    PhoneNumber = "",
                    DateOfBirth = DateTimeOffset.UtcNow
                };
                await _userRepository.AddAsync(user);
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

            var verifyLink = $"{_config["FrontendUrl"]}/verify-email?userId={user.Id}&token={rawToken}";
            await _emailRepository.SendEmailAsync(user.Email, "Verify Email", $"Click here to verify your email: {verifyLink}");
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
