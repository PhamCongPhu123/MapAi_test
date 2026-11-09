using System.ComponentModel.DataAnnotations;

namespace MapAI.Domain.Models.Auth
{
    public class LoginRequest
    {
        [Required]
        public string Email { get; set; } = null!;
        [Required]
        public string Password { get; set; } = null!;
    }
}
