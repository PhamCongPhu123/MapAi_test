using MapAI.Domain.Ports;
using MapAI.Application.Interfaces;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;

namespace MapAI.Application.Services
{
    public class TokenStoreService : ITokenStoreService
    {
        private readonly IAccountTokenRepository _tokenRepository;

        public TokenStoreService(IAccountTokenRepository tokenRepository)
        {
            _tokenRepository = tokenRepository;
        }

        public async Task<AccountTokenEntity?> GetSessionAsync(string userId)
        {
            return await _tokenRepository.GetByUserAndType(userId, ETokenType.RefreshToken);
        }

        public async Task StoreSessionAsync(AccountTokenEntity token)
        {
            await _tokenRepository.DeleteByUserAndType(token.UserId, ETokenType.RefreshToken);
            await _tokenRepository.AddAsync(token);
        }

        public async Task RemoveSessionAsync(string userId)
        {
            await _tokenRepository.DeleteByUserAndType(userId, ETokenType.RefreshToken);
        }
    }
}
