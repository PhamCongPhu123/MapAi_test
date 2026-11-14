using Google.Apis.Auth;
using MapAI.Domain.Ports;

namespace MapAI.Infrastructure.Repositories;
public sealed class GoogleIdentityRepository : IGoogleIdentityRepository
{
    public async Task<ExternalIdentity> VerifyAsync(string idToken, string clientId)
    {
        var payload = await GoogleJsonWebSignature.ValidateAsync(idToken, new GoogleJsonWebSignature.ValidationSettings { Audience = new[] { clientId } });
        return new(payload.Email, payload.Name);
    }
}
