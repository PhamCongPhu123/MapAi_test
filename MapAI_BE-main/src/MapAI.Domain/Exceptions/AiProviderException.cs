namespace MapAI.Domain.Exceptions;

// Contains only safe, actionable text; never a provider response body or API key.
public sealed class AiProviderException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}
