using MapAI.Domain.Entities;

namespace MapAI.Domain.Ports
{
    public interface IJwtRepository
    {
        string GenerateAccessToken(UserEntity user);
        string GenerateRefreshToken();
    }
}
