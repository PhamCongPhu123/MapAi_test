using System.Net.Http.Headers;
using MapAI.Domain.Ports;
using Microsoft.Extensions.Configuration;

namespace MapAI.Infrastructure.Repositories
{
    public class StorageRepository : IStorageRepository
    {
        private readonly HttpClient _httpClient;
        private readonly string _supabaseUrl;
        private readonly string _supabaseKey;

        public StorageRepository(HttpClient httpClient, IConfiguration configuration, Microsoft.Extensions.Logging.ILogger<StorageRepository> logger)
        {
            _httpClient = httpClient;
            _supabaseUrl = configuration["Supabase:Url"] ?? throw new ArgumentNullException("Supabase:Url missing");
            _supabaseKey = configuration["Supabase:ServiceRoleKey"]?.Trim() ?? string.Empty;
        }

        public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string bucketName)
        {
            var requestUrl = $"{_supabaseUrl}/storage/v1/object/{bucketName}/{fileName}";

            using (var content = new StreamContent(fileStream))
            {
                content.Headers.ContentType = new MediaTypeHeaderValue(contentType);

                var request = new HttpRequestMessage(HttpMethod.Post, requestUrl)
                {
                    Content = content
                };

                request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
                request.Headers.Add("apikey", _supabaseKey);
                request.Headers.Add("x-upsert", "true");

                var response = await _httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    throw new Exception($"Failed to upload to Supabase bucket '{bucketName}': {error}");
                }

                return $"{_supabaseUrl}/storage/v1/object/public/{bucketName}/{fileName}";
            }
        }

        public async Task DeleteFileAsync(string fileUrl, string bucketName)
        {
            var bucketPrefix = $"/storage/v1/object/public/{bucketName}/";
            var index = fileUrl.IndexOf(bucketPrefix);
            if (index == -1) return;

            var fileName = fileUrl.Substring(index + bucketPrefix.Length);
            var requestUrl = $"{_supabaseUrl}/storage/v1/object/{bucketName}/{fileName}";

            var request = new HttpRequestMessage(HttpMethod.Delete, requestUrl);
            request.Headers.Add("Authorization", $"Bearer {_supabaseKey}");
            request.Headers.Add("apikey", _supabaseKey);

            await _httpClient.SendAsync(request);
        }
    }
}
