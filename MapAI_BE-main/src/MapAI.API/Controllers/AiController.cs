using MapAI.Application.Interfaces;
using MapAI.Domain.Models.Ai;
using MapAI.Domain.Exceptions;
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
                if (string.IsNullOrWhiteSpace(request.UserInput))
                {
                    return BadRequest(new { code = "AI_INPUT_REQUIRED", message = "Vui lòng nhập tin nhắn cho MapAI." });
                }

                var result = await _aiService.AskMapAIAsync(request);
                return Ok(result);
            }
            catch (AiProviderException ex)
            {
                return StatusCode(ex.StatusCode, new { code = ex.Code, message = ex.Message });
            }
            catch (Exception)
            {
                return StatusCode(500, new { code = "AI_UNAVAILABLE", message = "MapAI chưa xử lý được yêu cầu này. Vui lòng thử lại sau." });
            }
        }
    }
}
