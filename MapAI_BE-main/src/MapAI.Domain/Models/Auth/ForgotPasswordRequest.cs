using System.ComponentModel.DataAnnotations;

namespace MapAI.Domain.Models.Auth
{
    public class ForgotPasswordRequest
    {
        [Required, EmailAddress, StringLength(254)]
        public string Email { get; set; } = null!;
    }
}
