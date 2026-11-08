using MapAI.Domain.Enums;

namespace MapAI.Domain.Models.Auth
{
    public class RegisterRequest
    {
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string PhoneNumber { get; set; } = null!;
        public string DateOfBirth { get; set; } = null!;
        public EUser Role { get; set; } = EUser.User;
    }
}
