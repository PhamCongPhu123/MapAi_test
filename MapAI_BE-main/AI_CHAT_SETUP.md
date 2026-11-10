# Cấu hình Gemini cho ChatAI

Nếu `POST /api/v1/ai/ask` trả `API_KEY_INVALID` hoặc `API key not valid`, Google đang từ chối API key của backend. Bật GPS không sửa được lỗi này. GPS chỉ phục vụ các thao tác cần vị trí, như tìm cây xăng gần bạn.

Backend không còn chứa khóa Gemini mặc định trong các file `appsettings*.json`. Bạn cần tạo khóa hợp lệ cho dự án của mình tại [Google AI Studio](https://aistudio.google.com/api-keys). Không gửi khóa vào chat, commit lên Git hoặc đặt trong biến frontend `VITE_*`.

## Lưu khóa trên Windows

Dừng backend đang chạy bằng `Ctrl+C`. Mở PowerShell tại thư mục backend rồi chạy:

```powershell
cd D:\Da_nen_tang_fimalproject\MapAI_BE-main

# Xóa biến trong cửa sổ này nếu từng cấu hình khóa cũ qua environment.
# Environment có độ ưu tiên cao hơn User Secrets.
Remove-Item Env:GeminiConfig__ApiKey -ErrorAction SilentlyContinue

# Nhập ẩn khóa mới, tránh ghi khóa vào lịch sử lệnh PowerShell.
$geminiKey = ([System.Net.NetworkCredential]::new("", (Read-Host "Dán API key Gemini mới" -AsSecureString))).Password
dotnet user-secrets set "GeminiConfig:ApiKey" $geminiKey --project .\src\MapAI.API
Remove-Variable geminiKey

$env:FrontendUrl = "http://localhost:5175"
dotnet run --project .\src\MapAI.API --launch-profile http --urls http://0.0.0.0:5028
```

API đã có `UserSecretsId`; launch profile `http` bật môi trường `Development` để .NET tự đọc User Secrets. Khóa được lưu ngoài repository, chỉ dùng trên máy/tài khoản Windows đã cấu hình. Không cần chạy migration database. User Secrets phục vụ phát triển cục bộ; khi deploy, cấu hình `GeminiConfig__ApiKey` bằng secret của nơi chạy backend.

Model mặc định là `gemini-2.5-flash`. Nếu Google báo model không khả dụng với dự án của bạn, chọn model hỗ trợ `generateContent` và structured output trong AI Studio rồi lưu riêng bằng:

```powershell
dotnet user-secrets set "GeminiConfig:Model" "TEN_MODEL_DUOC_HO_TRO" --project .\src\MapAI.API
```

## Kiểm tra trên ứng dụng

Giữ backend chạy. Mở terminal frontend khác:

```powershell
cd D:\Da_nen_tang_fimalproject\MapAI_FE-feature-map-api
npm run dev -- --port 5175 --strictPort
```

Mở `http://localhost:5175/map` và gửi **“Giới thiệu về Cầu Rồng”**. Câu này gọi Gemini nên giúp kiểm tra khóa mới. Nếu vẫn lỗi, xem mã lỗi bên dưới; không gửi API key hoặc token khi báo lỗi.

Các lệnh rõ ràng như **“Phóng to bản đồ”**, **“Vị trí của tôi”**, **“Tìm cây xăng gần nhất”** được xử lý qua router cục bộ, vẫn dùng được khi chưa cấu hình Gemini. Chúng không chứng minh khóa đã hợp lệ. Tìm/chỉ đường vẫn cần quyền định vị và kết nối đến nguồn địa điểm/định tuyến tương ứng.

## Các lỗi được phân biệt

| Mã từ `/api/v1/ai/ask` | HTTP | Cách xử lý |
| --- | --- | --- |
| `AI_NOT_CONFIGURED` | 503 | Lưu khóa bằng User Secrets rồi khởi động lại backend. |
| `AI_KEY_INVALID` | 503 | Tạo/cấu hình khóa hợp lệ; kiểm tra biến environment không ghi đè bằng khóa cũ. |
| `AI_ACCESS_DENIED` | 503 | Kiểm tra quyền dịch vụ và giới hạn API key của dự án Google. |
| `AI_MODEL_UNAVAILABLE` | 503 | Cấu hình model được dự án hỗ trợ. |
| `AI_RATE_LIMITED` | 429 | Kiểm tra quota hoặc chờ theo giới hạn dịch vụ. |
| `AI_CONNECTION_FAILED` | 503 | Kiểm tra kết nối từ máy chạy backend tới `generativelanguage.googleapis.com`. |
| `AI_TIMEOUT` | 504 | Thử lại; mỗi lần gọi Gemini có thời gian chờ mặc định 30 giây. |
| `AI_INVALID_RESPONSE` / `AI_REQUEST_REJECTED` | 502 | Kiểm tra model hỗ trợ schema; thử lại hoặc kiểm tra backend. |
| `AI_RESPONSE_BLOCKED` | 422 | Diễn đạt lại yêu cầu. |

Frontend cũng phân biệt trường hợp không kết nối được máy chủ MapAI với lỗi Gemini. API chỉ trả thông báo và mã lỗi an toàn; không trả nguyên nội dung lỗi Google. Không tự thử lại khóa sai hoặc quota đã hết. Chỉ thử lại tối đa một lần khi lỗi mạng hoặc Google trả 5xx. Phản hồi lỗi không được đưa vào ngữ cảnh hội thoại tiếp theo.

## Kiểm thử

```powershell
# Trong MapAI_BE-main
dotnet run --project tests/MapAI.AiChatTests
dotnet run --project tests/MapAI.MapToolsTests

# Trong MapAI_FE-feature-map-api
npm run test:ai-errors
npm run test:mobile:e2e
```

Các kiểm thử AI thay thế HTTP đến Google bằng phản hồi giả lập, gồm đúng lỗi `API_KEY_INVALID`, quota, model, timeout, phục hồi dịch vụ và hội thoại thành công. Không dùng khóa thật, không phát sinh lượt gọi Google và không cần database. Kiểm thử trình duyệt chạy ở kích thước điện thoại và desktop.

Môi trường cloud hiện chặn kết nối đến Google Gemini nên chưa thể xác nhận hội thoại với dịch vụ thật tại đây. Cần kiểm tra trên máy bạn sau khi nhập khóa mới.
