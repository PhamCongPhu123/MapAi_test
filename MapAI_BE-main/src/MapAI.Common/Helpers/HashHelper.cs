namespace MapAI.Common.Helpers
{
    public static class HashHelper
    {
        public static string Hash(string text)
        {
            return BCrypt.Net.BCrypt.HashPassword(text);
        }

        public static bool Verify(string text, string hash)
        {
            if (string.IsNullOrEmpty(text) || string.IsNullOrEmpty(hash)) return false;
            return BCrypt.Net.BCrypt.Verify(text, hash);
        }
    }
}
