using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using MapAI.Application.Interfaces;
using MapAI.Application.Exceptions;
using MapAI.Domain.Models.Location;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MapAI.API.Controllers;

[ApiController]
[Route("api/v1/location")]
public class CommunityLocationController(ICommunityLocationService service) : ControllerBase
{
    [Authorize(Policy = "UserOnly"), HttpPost("contributions")]
    public Task<IActionResult> Submit(SubmitLocationRequest request) => Handle(async () =>
        StatusCode(201, await service.SubmitAsync(User.FindFirstValue("id")!, request)));

    [Authorize(Policy = "UserOnly"), HttpGet("contributions/mine")]
    public Task<IActionResult> Mine([Range(1, 100000)] int page = 1, [Range(1, 50)] int pageSize = 10) => Handle(async () =>
        Ok(await service.GetContributionsAsync(User.FindFirstValue("id")!, page, pageSize)));

    [Authorize(Policy = "AdminOnly"), HttpGet("contributions/pending")]
    public Task<IActionResult> Pending([Range(1, 100000)] int page = 1, [Range(1, 50)] int pageSize = 10) => Handle(async () =>
        Ok(await service.GetContributionsAsync(null, page, pageSize)));

    [Authorize(Policy = "AdminOnly"), HttpPut("contributions/{id}/moderation")]
    public Task<IActionResult> Moderate(string id, ModerateLocationRequest request) => Handle(async () =>
    {
        await service.ModerateAsync(id, User.FindFirstValue("id")!, request);
        return NoContent();
    });

    [HttpGet("{id}/reviews")]
    public Task<IActionResult> Reviews(string id, [Range(1, 100000)] int page = 1, [Range(1, 50)] int pageSize = 10) => Handle(async () =>
        Ok(await service.GetReviewsAsync(id, User.FindFirstValue("id"), page, pageSize)));

    [Authorize(Policy = "UserOnly"), HttpPut("{id}/reviews/me")]
    public Task<IActionResult> SaveReview(string id, SaveLocationReviewRequest request) => Handle(async () =>
        Ok(await service.SaveReviewAsync(id, User.FindFirstValue("id")!, request)));

    [Authorize(Policy = "UserOnly"), HttpDelete("{id}/reviews/me")]
    public Task<IActionResult> DeleteReview(string id) => Handle(async () =>
    {
        await service.DeleteReviewAsync(id, User.FindFirstValue("id")!);
        return NoContent();
    });

    private async Task<IActionResult> Handle(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (KeyNotFoundException e) { return NotFound(new { message = e.Message }); }
        catch (ArgumentException e) { return BadRequest(new { message = e.Message }); }
        catch (CommunityConflictException e) { return Conflict(new { message = e.Message }); }
        catch (DbUpdateException e) when (e.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Conflict(new { message = "Đánh giá vừa được cập nhật ở nơi khác. Hãy tải lại và thử lại." });
        }
    }
}
