namespace MapAI.Domain.Ports;
public sealed record ExternalIdentity(string Email, string Name);
public interface IGoogleIdentityRepository
{
    Task<ExternalIdentity> VerifyAsync(string idToken, string clientId);
}
