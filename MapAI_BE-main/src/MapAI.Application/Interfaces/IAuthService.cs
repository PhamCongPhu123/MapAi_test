using MapAI.Domain.Models.Auth;
using MapAI.Domain.Models.User;

namespace MapAI.Application.Interfaces
{
    public interface IAuthService
    {
        Task<LoginResponse> LoginAsync(LoginRequest request);
        Task<RefreshResponse> RefreshAsync(RefreshRequest request);
        Task LogoutAsync(string userId);
        Task RegisterAsync(RegisterRequest request);
        Task VerifyEmailAsync(string userId, string token);
        Task<bool> ForgotPasswordAsync(string email);
        Task ResetPasswordAsync(string userId, string token, string newPassword);
        Task<LoginResponse> GoogleLoginAsync(string idToken);
        Task UpdateUserAsync(string userId, UpdateUserRequest request);
        Task<string> UpdateAvatarAsync(string userId, Stream avatarStream, string fileName, string contentType);
        Task<UserProfileResponse> GetUserProfileAsync(string userId);
        
        // Admin Methods
        Task<IEnumerable<UserProfileResponse>> GetAllUsersAsync();
        Task DeleteUserAsync(string userId);
        Task ToggleUserStatusAsync(string userId);
        Task ChangeUserRoleAsync(string userId, MapAI.Domain.Enums.EUser role);
    }
}
