using System.Collections.Generic;
using System.Threading.Tasks;
using MapAI.Domain.Models.Location;

namespace MapAI.Application.Interfaces
{
    public interface ILocationService
    {
        Task<LocationResponse> GetLocationByIdAsync(string id);
        Task<LocationResponse> GetLocationByTitleAsync(string title);
        Task<LocationResponse> GetLocationByDetailsAsync(string title, double lat, double lng);
        Task<IEnumerable<LocationResponse>> GetAllLocationsAsync(string? title = null);
        Task<LocationResponse> CreateLocationAsync(CreateLocationRequest request);
        Task<LocationResponse> UpdateLocationAsync(string id, UpdateLocationRequest request);
        Task DeleteLocationAsync(string id);
        Task<string> UploadThumbnailAsync(Stream imageStream, string fileName, string contentType);
    }
}
