using MapAI.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MapAI.Application.Interfaces;
using MapAI.Application.Services;
using MapAI.Common.Helpers;
using MapAI.Common.Configs;
using MapAI.Domain.Enums;
using MapAI.Domain.Entities;
using MapAI.Domain.Ports;
using MapAI.Infrastructure.Repositories;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});

// Kestrel
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 100 * 1024 * 1024;
});

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var dataSourceBuilder = new Npgsql.NpgsqlDataSourceBuilder(connectionString);
dataSourceBuilder.EnableDynamicJson();
var dataSource = dataSourceBuilder.Build();

builder.Services.AddDbContext<MapAIContext>(options =>
    options.UseNpgsql(dataSource));

// Configs
builder.Services.Configure<MailSetting>(builder.Configuration.GetSection("MailSetting"));

// DI Repositories (Đăng ký 1 lần duy nhất)
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IAccountTokenRepository, AccountTokenRepository>();
builder.Services.AddScoped<ILocationRepository, LocationRepository>();
builder.Services.AddScoped<ICommunityLocationRepository, CommunityLocationRepository>();
builder.Services.AddScoped<IGoogleIdentityRepository, GoogleIdentityRepository>();
builder.Services.AddScoped<IAiRepository, GeminiRepository>();
builder.Services.AddScoped<IOsmRepository, OsmRepository>();
builder.Services.AddScoped<IFoursquareRepository, FoursquareRepository>();
builder.Services.AddScoped<IJwtRepository, JwtRepository>();
builder.Services.AddScoped<IEmailRepository, EmailRepository>();
builder.Services.AddScoped<IStorageRepository, StorageRepository>();

// DI Services
builder.Services.AddHttpClient();
builder.Services.AddScoped<ITokenStoreService, TokenStoreService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ILocationService, LocationService>();
builder.Services.AddScoped<ICommunityLocationService, CommunityLocationService>();
builder.Services.AddScoped<IMapService, MapService>();
builder.Services.AddScoped<IFoursquareService, FoursquareService>();
builder.Services.AddScoped<IAiService, AiService>();

// Authentication & JWT
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? "default_secret_key_change_me_in_production";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var userId = context.Principal!.FindFirst("id")?.Value;
            if (string.IsNullOrEmpty(userId))
            {
                context.Fail("Missing user id");
                return;
            }
            
            var roleInToken = context.Principal!.FindFirst(ClaimTypes.Role)?.Value;
            var userRepository = context.HttpContext.RequestServices.GetRequiredService<IUserRepository>();
            var user = await userRepository.GetByIdAsync(userId);
            
            if (user == null || !user.IsActive)
            {
                context.Fail("User is inactive or deleted");
                return;
            }

            var credentialVersion = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(user.PasswordHash)));
            if (context.Principal.FindFirst("credential_version")?.Value != credentialVersion)
            {
                context.Fail("Credentials changed. Please login again.");
                return;
            }
            
            if (user.Role.ToString() != roleInToken)
            {
                context.Fail("Your role has been updated. Please login again.");
                return;
            }

            var tokenStore = context.HttpContext.RequestServices.GetRequiredService<ITokenStoreService>();
            var session = await tokenStore.GetSessionAsync(userId);
            
            if (session == null)
            {
                context.Fail("Session revoked. Please login again.");
                return;
            }
        }
    };
});

// Authorization
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole(EUser.Admin.ToString()));
    options.AddPolicy("UserOnly", policy => policy.RequireRole(EUser.User.ToString(), EUser.Admin.ToString()));
});

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("password-recovery", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
});

// Exception Handling
builder.Services.AddExceptionHandler<MapAI.API.Middleware.GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.MapControllers();

app.Run();

public partial class Program { }
