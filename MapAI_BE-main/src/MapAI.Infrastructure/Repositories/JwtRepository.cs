using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using MapAI.Domain.Ports;
using MapAI.Domain.Entities;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace MapAI.Infrastructure.Repositories
{
    public class JwtRepository : IJwtRepository
    {
        private readonly IConfiguration _config;

        public JwtRepository(IConfiguration config)
        {
            _config = config;
        }

        public string GenerateAccessToken(UserEntity user)
        {
            var claims = new List<Claim>
            {
                new Claim("id", user.Id),
                new Claim("credential_version", Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(user.PasswordHash)))),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role.ToString())
            };

            var secret = _config["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret is not configured");
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expires = DateTime.UtcNow.AddMinutes(Convert.ToDouble(_config["Jwt:ExpiredTime"] ?? "1440"));

            var token = new JwtSecurityToken(
                claims: claims,
                expires: expires,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string GenerateRefreshToken()
        {
            return Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        }
    }
}
