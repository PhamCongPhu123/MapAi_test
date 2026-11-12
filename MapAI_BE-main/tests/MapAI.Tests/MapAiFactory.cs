using MapAI.Common.Helpers;
using MapAI.Domain.Entities;
using MapAI.Domain.Enums;
using MapAI.Domain.Models.Foursquare;
using MapAI.Domain.Models.Osm;
using MapAI.Application.Interfaces;
using MapAI.Infrastructure.Interfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Moq;

namespace MapAI.Tests;

// Exercise the real HTTP pipeline and application services without sending real email,
// uploading to a production bucket, or needing a shared database.
public sealed class MapAiFactory : WebApplicationFactory<Program>
{
    private const string SigningKey = "mapai-integration-test-signing-key-at-least-32-bytes";
    public UserEntity Account { get; } = new()
    {
        Id = "test-user", Email = "user@example.test", FullName = "Test User", PhoneNumber = "",
        IsActive = true, Role = EUser.User, PasswordHash = HashHelper.Hash("old-password")
    };
    public List<AccountTokenEntity> Tokens { get; } = new();
    public List<LocationEntity> Locations { get; } = new();
    public string? EmailBody { get; private set; }
    public byte[]? UploadedBytes { get; private set; }
    public bool FailEmail { get; set; }
    public bool FailUpload { get; set; }
    public bool FailPlaces { get; set; }
    public bool FailExternalPlaces { get; set; }
    public List<FoursquareNearbyResult> ExternalPlaces { get; } = new();
    public List<FoursquareNearbyResult> FoursquarePlaces { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=unused;Username=test",
            ["Jwt:Secret"] = SigningKey,
            ["FrontendUrl"] = "http://localhost:5173/"
        }));
        builder.ConfigureTestServices(services =>
        {
            // Minimal hosting reads the validation key before the fixture's config override.
            // Keep real JWT validation enabled and align it with the fixture's signing key.
            services.PostConfigure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
                options.TokenValidationParameters.IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey)));
            var users = new Mock<IUserRepository>();
            users.Setup(x => x.GetByEmailAsync(It.IsAny<string>())).ReturnsAsync((string email) => email == Account.Email ? Account : null);
            users.Setup(x => x.GetByIdOrEmailAsync(It.IsAny<string>())).ReturnsAsync((string value) => value == Account.Id || value == Account.Email ? Account : null);
            users.Setup(x => x.GetByIdAsync(It.IsAny<string>())).ReturnsAsync((string id) => id == Account.Id ? Account : null);
            users.Setup(x => x.UpdateAsync(It.IsAny<UserEntity>())).ReturnsAsync(true);
            Replace(services, users.Object);

            var tokens = new Mock<IAccountTokenRepository>();
            tokens.Setup(x => x.GetByUserAndType(It.IsAny<string>(), It.IsAny<ETokenType>()))
                .ReturnsAsync((string id, ETokenType type) => Tokens.FirstOrDefault(t => t.UserId == id && t.Type == type));
            tokens.Setup(x => x.AddAsync(It.IsAny<AccountTokenEntity>())).Callback<AccountTokenEntity>(Tokens.Add).Returns(Task.CompletedTask);
            tokens.Setup(x => x.DeleteAsync(It.IsAny<string>())).Callback<string>(id => Tokens.RemoveAll(t => t.Id == id)).Returns(Task.CompletedTask);
            tokens.Setup(x => x.DeleteByUserAndType(It.IsAny<string>(), It.IsAny<ETokenType>()))
                .Callback<string, ETokenType>((id, type) => Tokens.RemoveAll(t => t.UserId == id && t.Type == type)).Returns(Task.CompletedTask);
            tokens.Setup(x => x.CompletePasswordResetAsync(It.IsAny<AccountTokenEntity>(), It.IsAny<string>()))
                .ReturnsAsync((AccountTokenEntity token, string passwordHash) =>
                {
                    var current = Tokens.Find(t => t.Id == token.Id && t.UserId == Account.Id && t.Type == ETokenType.PasswordReset
                        && t.TokenHash == token.TokenHash && !t.IsDeleted && t.ExpiresAt > DateTimeOffset.UtcNow);
                    if (current == null) return false;
                    Account.PasswordHash = passwordHash;
                    Tokens.RemoveAll(t => t.UserId == token.UserId && (t.Type == ETokenType.PasswordReset || t.Type == ETokenType.RefreshToken));
                    return true;
                });
            Replace(services, tokens.Object);

            var email = new Mock<IEmailRepository>();
            email.Setup(x => x.SendEmailAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns((string _, string _, string body) =>
                {
                    if (FailEmail) throw new IOException("Simulated SMTP outage");
                    EmailBody = body;
                    return Task.CompletedTask;
                });
            Replace(services, email.Object);

            var storage = new Mock<IStorageRepository>();
            storage.Setup(x => x.UploadFileAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>()))
                .Returns(async (Stream stream, string name, string _, string bucket) =>
                {
                    if (FailUpload) throw new IOException("Simulated storage outage");
                    using var content = new MemoryStream();
                    await stream.CopyToAsync(content);
                    UploadedBytes = content.ToArray();
                    return $"https://images.example.test/{bucket}/{name}";
                });
            Replace(services, storage.Object);

            var locations = new Mock<ILocationRepository>();
            locations.Setup(x => x.AddAsync(It.IsAny<LocationEntity>())).ReturnsAsync((LocationEntity entity) => { Locations.Add(entity); return entity; });
            locations.Setup(x => x.GetAllAsync()).ReturnsAsync(() => Locations);
            locations.Setup(x => x.GetByCoordinatesAsync(It.IsAny<double>(), It.IsAny<double>(), It.IsAny<double>()))
                .ReturnsAsync(() => FailPlaces ? throw new IOException("Simulated database outage") : Locations);
            locations.Setup(x => x.GetByIdAsync(It.IsAny<string>())).ReturnsAsync((string id) => Locations.FirstOrDefault(l => l.Id == id));
            Replace(services, locations.Object);

            var osm = new Mock<IOsmRepository>();
            osm.Setup(x => x.SearchCityWideOverpassAsync(It.IsAny<string>()))
                .ReturnsAsync(() => FailExternalPlaces ? throw new HttpRequestException("Simulated OSM outage") : ExternalPlaces);
            osm.Setup(x => x.SearchNearbyOverpassAsync(It.IsAny<double>(), It.IsAny<double>(), It.IsAny<string>(), It.IsAny<int>()))
                .ReturnsAsync(() => FailExternalPlaces ? throw new HttpRequestException("Simulated OSM outage") : ExternalPlaces);
            osm.Setup(x => x.SearchCategoryNearbyAsync(It.IsAny<double>(), It.IsAny<double>(), It.IsAny<string>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(() => FailExternalPlaces ? throw new HttpRequestException("Simulated OSM outage") : ExternalPlaces.Select(p => new MapPlaceResult
                {
                    Id = p.FsqId, Name = p.Name, Lat = p.Lat, Lng = p.Lng, Source = "openstreetmap", Category = "fuel"
                }).ToList());
            Replace(services, osm.Object);
            var foursquare = new Mock<IFoursquareService>();
            foursquare.Setup(x => x.GetNearbyPlacesAsync(It.IsAny<FoursquareSearchRequest>()))
                .ReturnsAsync(() => FailExternalPlaces ? throw new HttpRequestException("Simulated Foursquare outage") : FoursquarePlaces);
            Replace(services, foursquare.Object);
        });
    }

    private static void Replace<T>(IServiceCollection services, T instance) where T : class
    {
        services.RemoveAll<T>();
        services.AddSingleton(instance);
    }
}
