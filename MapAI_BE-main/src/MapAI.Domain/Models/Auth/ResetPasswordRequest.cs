using System.ComponentModel.DataAnnotations;

namespace MapAI.Domain.Models.Auth
{
    public class ResetPasswordRequest
    {
        [Required, StringLength(100)]
        public string UserId { get; set; } = null!;
        [Required, StringLength(2048)]
        public string Token { get; set; } = null!;
        [Required, MinLength(6), MaxLength(72)]
        public string NewPassword { get; set; } = null!;
    }
}
