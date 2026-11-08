namespace MapAI.Domain.Enums
{
    public enum ETokenType
    {
        EmailVerification = 0,
        PasswordReset = 1,
        RefreshToken = 2
    }

    public enum EExpiredTime
    {
        VerifyEmail = 5, // 5 minutes
        ForgotPassword = 60, // 1 hour
        RefreshToken = 43200 // 30 days
    }
}
