namespace MapAI.Infrastructure.Interfaces
{
    public interface IStorageRepository
    {
        Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType, string bucketName);
        Task DeleteFileAsync(string fileUrl, string bucketName);
    }
}
