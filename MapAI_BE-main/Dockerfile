# Use the official .NET SDK image to build the app
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

# Copy the solution file and project files to matching relative paths
COPY src/MapAI.sln ./
COPY src/MapAI.API/MapAI.API.csproj MapAI.API/
COPY src/MapAI.Application/MapAI.Application.csproj MapAI.Application/
COPY src/MapAI.Infrastructure/MapAI.Infrastructure.csproj MapAI.Infrastructure/
COPY src/MapAI.Domain/MapAI.Domain.csproj MapAI.Domain/
COPY src/MapAI.Common/MapAI.Common.csproj MapAI.Common/

# Restore dependencies
RUN dotnet restore

# Copy the remaining source code
COPY src/ .

# Build and publish the API project
WORKDIR /app/MapAI.API
RUN dotnet publish -c Release -o /app/publish

# Use the official ASP.NET Core runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

# Expose the port the app runs on
EXPOSE 8080
EXPOSE 8081

ENTRYPOINT ["dotnet", "MapAI.API.dll"]
