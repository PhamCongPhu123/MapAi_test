namespace MapAI.Domain.Models.Auth
{
    public class LoginResponse
    {
        public string AccessToken { get; set; } = null!;
        public string RefreshToken { get; set; } = null!;
        public bool IsRegistered { get; set; } = true;
    }
}
