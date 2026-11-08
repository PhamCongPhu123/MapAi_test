namespace MapAI.Infrastructure.Interfaces
{
    public interface IEmailRepository
    {
        Task SendEmailAsync(string toEmail, string subject, string body);
    }
}
