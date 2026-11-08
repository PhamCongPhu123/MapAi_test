namespace MapAI.Domain.Models.Auth
{
    public class ResetPasswordRequest
    {
        public string UserId { get; set; } = null!;
        public string Token { get; set; } = null!;
        public string NewPassword { get; set; } = null!;
    }
}
