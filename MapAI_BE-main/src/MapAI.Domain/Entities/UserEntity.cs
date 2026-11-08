using System;
using System.ComponentModel.DataAnnotations;
using MapAI.Domain.Common;
using MapAI.Domain.Enums;

namespace MapAI.Domain.Entities
{
    public class UserEntity : BaseEntity
    {
        [Key]
        public string Id { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? AvatarUrl { get; set; }
        public string PhoneNumber { get; set; } = null!;
        public string PasswordHash { get; set; } = null!;
        public DateTimeOffset DateOfBirth { get; set; }
        public EUser Role { get; set; } 
        public bool IsActive { get; set; } = false;
    }
}
