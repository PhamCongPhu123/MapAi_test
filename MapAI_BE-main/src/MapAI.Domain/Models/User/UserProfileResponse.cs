using System;

namespace MapAI.Domain.Models.User
{
    public class UserProfileResponse
    {
        public string Id { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? AvatarUrl { get; set; }
        public string PhoneNumber { get; set; } = null!;
        public string DateOfBirth { get; set; } = null!;
        public string Role { get; set; } = null!;
    }
}
