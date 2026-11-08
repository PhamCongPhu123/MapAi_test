using System;

namespace MapAI.Domain.Models.User
{
    public class UpdateUserRequest
    {
        public string? FullName { get; set; }
        public string? PhoneNumber { get; set; }
        public string? DateOfBirth { get; set; }
    }
}
