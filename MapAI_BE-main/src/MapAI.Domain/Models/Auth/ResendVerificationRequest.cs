using System.ComponentModel.DataAnnotations;

namespace MapAI.Domain.Models.Auth;

public class ResendVerificationRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = null!;
}
