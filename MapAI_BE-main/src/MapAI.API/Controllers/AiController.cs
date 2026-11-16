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
                    return BadRequest(new { code = "AI_INPUT_REQUIRED", message = request.Language == "en-US" ? "Please enter a message for MapAI." : "Vui lòng nhập tin nhắn cho MapAI." });
                }

                var result = await _aiService.AskMapAIAsync(request);
                return Ok(result);
            }
            catch (HttpRequestException) { return StatusCode(503, new { code = "PLACE_SEARCH_UNAVAILABLE", message = request.Language == "en-US" ? "Place search is unavailable. Please try again later." : "Nguồn tìm kiếm địa điểm đang gián đoạn. Hãy thử lại sau." }); }
            catch (AiProviderException ex)
            {
                return StatusCode(ex.StatusCode, new { code = ex.Code, message = request.Language == "en-US" ? "The AI service is unavailable. Check the server configuration or try again later." : ex.Message });
            }
            catch (Exception)
            {
                return StatusCode(500, new { code = "AI_UNAVAILABLE", message = request.Language == "en-US" ? "MapAI could not process your request. Please try again." : "MapAI chưa xử lý được yêu cầu này. Vui lòng thử lại sau." });
            }
        }
    }
}
