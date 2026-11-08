namespace MapAI.Domain.Models.Auth
{
    public class RefreshRequest
    {
        public string UserId { get; set; } = null!;
        public string RefreshToken { get; set; } = null!;
    }
}
