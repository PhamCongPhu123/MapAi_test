namespace MapAI.Application.Exceptions;

// Expected authentication failures have stable codes for web and mobile clients.
public sealed class AuthException(int statusCode, string code, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public string Code { get; } = code;
}
