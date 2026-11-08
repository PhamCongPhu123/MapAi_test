using MapAI.Domain.Entities;

namespace MapAI.Infrastructure.Interfaces
{
    public interface IJwtRepository
    {
        string GenerateAccessToken(UserEntity user);
        string GenerateRefreshToken();
    }
}
