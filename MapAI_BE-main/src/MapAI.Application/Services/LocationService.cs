using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MapAI.Infrastructure.Interfaces;
using MapAI.Application.Interfaces;
using MapAI.Domain.Entities;
using MapAI.Domain.Models.Location;

namespace MapAI.Application.Services
{
    public class LocationService : ILocationService
    {
        private readonly ILocationRepository _locationRepository;
        private readonly IStorageRepository _storageRepository;
        private readonly MapAIContext _context;

        public LocationService(ILocationRepository locationRepository, IStorageRepository storageRepository, MapAIContext context)
        {
            _locationRepository = locationRepository;
            _storageRepository = storageRepository;
            _context = context;
        }

        public async Task<LocationResponse> GetLocationByIdAsync(string id)
        {
            var location = await _locationRepository.GetByIdAsync(id);
            if (location == null) throw new KeyNotFoundException("Location not found.");

            return await MapWithCommunityAsync(location);
        }

        public async Task<LocationResponse> GetLocationByTitleAsync(string title)
        {
            var locations = await _locationRepository.SearchByTitleAsync(title);
            
            // Sắp xếp theo độ liên quan và lấy cái đầu tiên
            var location = locations
                .OrderByDescending(l => CalculateRelevanceScore(l, title))
                .FirstOrDefault();
            
            if (location == null) throw new KeyNotFoundException("Location with this title not found.");

            return await MapWithCommunityAsync(location);
        }

        public async Task<LocationResponse> GetLocationByDetailsAsync(string title, double lat, double lng)
        {
            // 1. CHIẾN LƯỢC ƯU TIÊN 1: Khớp tọa độ trong phạm vi lân cận (200m)
            // Hỗ trợ map click bị lệch tâm hoặc địa điểm có kích thước lớn
            var nearbyCoords = await _locationRepository.GetByCoordinatesAsync(lat, lng, 0.002);
            if (nearbyCoords.Any())
            {
                // Nếu có nhiều điểm gần đó, ưu tiên điểm có tên khớp nhất
                var bestCoordMatch = nearbyCoords
                    .OrderByDescending(l => CalculateRelevanceScore(l, title))
                    .First();
                
                // Chỉ return nếu điểm số không quá tệ (khớp ít nhất một vài từ quan trọng)
                if (CalculateRelevanceScore(bestCoordMatch, title) > 15)
                    return await MapWithCommunityAsync(bestCoordMatch);
            }

            // 2. CHIẾN LƯỢC ƯU TIÊN 2: Khớp tên tuyệt đối
            var locations = await _locationRepository.SearchByTitleAsync(title);
            var exactTitleMatch = locations.FirstOrDefault(l => l.Title.Equals(title, StringComparison.OrdinalIgnoreCase));
            if (exactTitleMatch != null) return await MapWithCommunityAsync(exactTitleMatch);

            // 3. CHIẾN LƯỢC ƯU TIÊN 3: Phân tích mờ kết hợp khoảng cách (Lên đến 1km)
            const double maxSquaredDistance = 0.0001; // Khoảng 1km (0.01 độ)
            const int minAcceptableScore = 30; // Điểm số tối thiểu để chấp nhận kết quả mờ

            var bestCandidate = locations
                .Select(l => new { 
                    Location = l, 
                    Distance = Math.Pow(l.Latitude - lat, 2) + Math.Pow(l.Longitude - lng, 2),
                    Score = CalculateRelevanceScore(l, title)
                })
                .Where(x => x.Distance <= maxSquaredDistance || x.Score >= 60) // Phải gần (1km) HOẶC khớp tên cực tốt
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Distance)
                .FirstOrDefault();

            if (bestCandidate == null || (bestCandidate.Score < minAcceptableScore && bestCandidate.Distance > 0.000001)) 
                throw new KeyNotFoundException("Location with these details not found.");

            return await MapWithCommunityAsync(bestCandidate.Location);
        }

        public async Task<IEnumerable<LocationResponse>> GetAllLocationsAsync(string? title = null)
        {
            IEnumerable<LocationEntity> locations;
            if (string.IsNullOrWhiteSpace(title))
            {
                locations = await _locationRepository.GetAllAsync();
            }
            else
            {
                var searchResults = await _locationRepository.SearchByTitleAsync(title);
                locations = searchResults.OrderByDescending(l => CalculateRelevanceScore(l, title));
            }
            return await MapManyWithCommunityAsync(locations);
        }

        private static int CalculateRelevanceScore(LocationEntity entity, string query)
        {
            int score = 0;
            var normalizedTitle = entity.Title.ToLower();
            var normalizedTags = (entity.Tags ?? "").ToLower();
            var normalizedQuery = query.ToLower();

            // 1. Khớp hoàn toàn Title (Ưu tiên cao nhất)
            if (normalizedTitle == normalizedQuery) score += 100;
            
            // 2. Title bắt đầu bằng chuỗi tìm kiếm
            else if (normalizedTitle.StartsWith(normalizedQuery)) score += 50;
            
            // 3. Title chứa chuỗi tìm kiếm
            else if (normalizedTitle.Contains(normalizedQuery)) score += 20;

            // 4. Khớp trong Tags (Xử lý các tên gọi thay thế)
            if (normalizedTags.Contains(normalizedQuery))
            {
                score += 40;
                // Nếu khớp chính xác một tag trong chuỗi tags (giả sử phân cách bằng dấu phẩy)
                var tagsArray = normalizedTags.Split(',').Select(t => t.Trim());
                if (tagsArray.Any(t => t == normalizedQuery)) score += 30;
            }

            // 5. Khớp từng từ đơn (Xử lý trường hợp đảo từ hoặc dư từ)
            var queryWords = normalizedQuery.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            int matchedWords = queryWords.Count(w => normalizedTitle.Contains(w) || normalizedTags.Contains(w));
            score += matchedWords * 5;

            return score;
        }

        public async Task<LocationResponse> CreateLocationAsync(CreateLocationRequest request)
        {
            var location = new LocationEntity
            {
                Title = request.Title,
                PlaceId = request.PlaceId,
                Address = request.Address,
                Description = request.Description,
                Latitude = request.Latitude,
                Longitude = request.Longitude,
                Thumbnail = request.Thumbnail,
                PhotosJson = request.Images != null ? JsonSerializer.Serialize(request.Images) : null,
                GoogleMapsUrl = request.GoogleMapsUrl,
                Website = request.Website,
                PhoneNumber = request.PhoneNumber,
                Rating = request.Rating,
                TotalReviews = request.TotalReviews,
                Category = request.Category,
                Tags = request.Tags
            };

            var created = await _locationRepository.AddAsync(location);
            return await MapWithCommunityAsync(created);
        }

        public async Task<LocationResponse> UpdateLocationAsync(string id, UpdateLocationRequest request)
        {
            var location = await _locationRepository.GetByIdAsync(id);
            if (location == null) throw new KeyNotFoundException("Location not found.");

            if (request.Title != null) location.Title = request.Title;
            if (request.Address != null) location.Address = request.Address;
            if (request.Description != null) location.Description = request.Description;
            if (request.Latitude.HasValue) location.Latitude = request.Latitude.Value;
            if (request.Longitude.HasValue) location.Longitude = request.Longitude.Value;
            if (request.Thumbnail != null) location.Thumbnail = request.Thumbnail;
            if (request.Website != null) location.Website = request.Website;
            if (request.PhoneNumber != null) location.PhoneNumber = request.PhoneNumber;
            if (request.Category != null) location.Category = request.Category;
            if (request.Tags != null) location.Tags = request.Tags;
            if (request.Images != null) location.PhotosJson = JsonSerializer.Serialize(request.Images);
            
            location.UpdatedAt = DateTimeOffset.UtcNow;

            await _locationRepository.UpdateAsync(location);
            return await MapWithCommunityAsync(location);
        }

        public async Task DeleteLocationAsync(string id)
        {
            if (!await _locationRepository.ExistsAsync(id))
                throw new KeyNotFoundException("Location not found.");

            await _locationRepository.DeleteAsync(id);
        }

        public async Task<string> UploadThumbnailAsync(Stream imageStream, string fileName, string contentType)
        {
            var newFileName = $"location_{Guid.NewGuid():N}{System.IO.Path.GetExtension(fileName).ToLowerInvariant()}";
            return await _storageRepository.UploadFileAsync(imageStream, newFileName, contentType, "location");
        }

        private async Task<LocationResponse> MapWithCommunityAsync(LocationEntity entity) =>
            (await MapManyWithCommunityAsync([entity])).Single();

        private async Task<List<LocationResponse>> MapManyWithCommunityAsync(IEnumerable<LocationEntity> entities)
        {
            var locations = entities.ToList();
            var ids = locations.Select(l => l.Id).ToArray();
            var summaries = await _context.LocationReviews.AsNoTracking().Where(r => ids.Contains(r.LocationId))
                .GroupBy(r => r.LocationId).Select(g => new { Id = g.Key, Count = g.Count(), Average = g.Average(r => r.Rating) })
                .ToDictionaryAsync(s => s.Id);
            return locations.Select(location =>
            {
                var response = MapToResponse(location);
                if (summaries.TryGetValue(location.Id, out var summary))
                {
                    response.CommunityReviewCount = summary.Count;
                    response.CommunityRating = Math.Round(summary.Average, 1);
                }
                return response;
            }).ToList();
        }

        private static LocationResponse MapToResponse(LocationEntity entity)
        {
            List<string>? images = null;
            if (!string.IsNullOrEmpty(entity.PhotosJson))
            {
                try
                {
                    images = JsonSerializer.Deserialize<List<string>>(entity.PhotosJson);
                }
                catch
                {
                    // Fallback or ignore parse errors
                }
            }

            return new LocationResponse
            {
                Id = entity.Id,
                IsUserContribution = entity.IsUserContribution,
                Title = entity.Title,
                PlaceId = entity.PlaceId,
                Address = entity.Address,
                Description = entity.Description,
                Latitude = entity.Latitude,
                Longitude = entity.Longitude,
                Thumbnail = entity.Thumbnail,
                Images = images,
                GoogleMapsUrl = entity.GoogleMapsUrl,
                Website = entity.Website,
                PhoneNumber = entity.PhoneNumber,
                Rating = entity.Rating,
                TotalReviews = entity.TotalReviews,
                Category = entity.Category,
                Tags = entity.Tags
            };
        }
    }
}
