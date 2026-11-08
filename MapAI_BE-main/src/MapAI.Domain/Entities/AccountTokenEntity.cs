using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using MapAI.Domain.Common;
using MapAI.Domain.Enums;

namespace MapAI.Domain.Entities
{
    public class AccountTokenEntity : BaseEntity
    {
        [Key]
        public string Id { get; set; } = Guid.NewGuid().ToString();

        [Required]
        public string UserId { get; set; }

        [ForeignKey("UserId")]
        public virtual UserEntity User { get; set; } = null!;

        [Required]
        public string TokenHash { get; set; } = null!;

        public DateTimeOffset ExpiresAt { get; set; }

        public ETokenType Type { get; set; }
    }
}
