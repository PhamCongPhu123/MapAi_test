using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Ai;
using Microsoft.AspNetCore.Mvc;

namespace MapAI.API.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class AiController : ControllerBase
    {
        private readonly IAiService _aiService;

        public AiController(IAiService aiService)
        {
            _aiService = aiService;
        }

        [HttpPost("ask")]
        public async Task<IActionResult> Ask([FromBody] AiRequest request)
        {
            try 
            {
                if (string.IsNullOrEmpty(request.UserInput))
                {
                    return BadRequest(new { message = "User input is required." });
                }

                var result = await _aiService.AskMapAIAsync(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "An error occurred while processing your request with MapAI.", error = ex.Message });
            }
        }
    }
}
