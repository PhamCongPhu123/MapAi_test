using System.Security.Claims;
using MapAI.Application.Interfaces;
using MapAI.Domain.Exceptions;
using MapAI.Domain.Models.Sync;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MapAI.API.Controllers;
[ApiController, Route("api/v1/sync")]
public sealed class SyncController(IAccountSyncService service) : ControllerBase
{
    [Authorize(Policy = "UserOnly"), HttpGet("favorites")]
    public async Task<IActionResult> Favorites() { Response.Headers.CacheControl = "no-store"; return Ok(await service.FavoritesAsync(User.FindFirstValue("id")!)); }
    [Authorize(Policy = "UserOnly"), HttpPost("operations"), RequestSizeLimit(32768)]
    public async Task<IActionResult> Apply(SyncOperation operation)
    {
        try { return Ok(await service.ApplyAsync(User.FindFirstValue("id")!, operation)); }
        catch (KeyNotFoundException e) { return NotFound(new { message = e.Message }); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
        catch (CommunityConflictException e) { return Conflict(new { message = e.Message }); }
    }
    [AllowAnonymous, HttpGet("catalog")]
    public async Task<IActionResult> Catalog([FromQuery] string? version)
    {
        var catalog = await service.CatalogAsync();
        Response.Headers.CacheControl = "no-store";
        return version == catalog.Version ? NoContent() : Ok(catalog);
    }
}
