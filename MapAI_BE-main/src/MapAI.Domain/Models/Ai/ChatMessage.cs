namespace MapAI.Domain.Models.Ai
{
    public class ChatMessage
    {
        public string Role { get; set; } = "user"; // "user" hoặc "model"
        public string Text { get; set; } = string.Empty;
    }
}
