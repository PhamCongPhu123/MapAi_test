# Ảnh địa điểm và quên mật khẩu

## Thêm địa điểm dành cho user

Trên nhánh `work`, mở **+ Thêm địa điểm** ở trang Bản đồ. Hộp thoại **Thêm địa điểm còn thiếu** có hai khung độc lập: **Mô tả địa điểm** (nhập chữ) và **Ảnh địa điểm** (chọn tệp, xem trước). Mô tả được gửi trong `description`, ảnh trong `thumbnail`; có thể gửi kèm một trong hai hoặc bỏ trống cả hai. Không có trang hay chức năng thêm địa điểm riêng.

- Ảnh JPG, PNG, GIF hoặc WebP, tối đa 5 MB; có xem trước, đổi ảnh và xóa ảnh trước khi gửi.
- Ảnh chỉ tải lên khi lưu. Nếu tải ảnh thất bại, form giữ nguyên dữ liệu và không tạo địa điểm thiếu ảnh. Nếu ảnh đã tải nhưng lưu địa điểm thất bại, bấm thử lại sẽ dùng lại URL đã tải.
- Có thể nhập tọa độ, dùng vị trí hiện tại hoặc chọn trên bản đồ như trước. Khi chuyển sang chọn vị trí trên bản đồ, ảnh đã chọn và nội dung form vẫn được giữ lại. Geolocation cần localhost hoặc HTTPS và quyền truy cập vị trí.
- `POST /api/v1/location/upload-thumbnail` nhận multipart với trường `file`, cho phép user/admin đã đăng nhập, kiểm tra dung lượng, MIME và chữ ký định dạng tệp.
- `POST /api/v1/location/contributions` tiếp tục dùng luồng đóng góp sẵn có, bổ sung trường `thumbnail`. Địa điểm luôn được lưu ở trạng thái **Chờ duyệt**; user không thể tự duyệt bằng cách gửi `status=Approved`.
- User xem ảnh trong **Đóng góp của tôi**. Admin xem ảnh tại **Duyệt địa điểm cộng đồng** trước khi duyệt hoặc từ chối. Chỉ địa điểm đã được admin duyệt mới có trong tìm kiếm, chi tiết và bản đồ công khai. Ảnh được giữ nguyên sau khi duyệt.
- Ảnh dùng cấu hình Supabase sẵn có: `Supabase__Url`, `Supabase__ServiceRoleKey`; bucket **location** phải tồn tại, backend được phép ghi và URL ảnh công khai phải đọc được. Không đưa service-role key vào frontend.

## Quên mật khẩu

Tại trang Đăng nhập, chọn **Quên mật khẩu?**, nhập email và mở liên kết nhận được để đặt mật khẩu mới.

- Liên kết có hiệu lực 60 phút. Gửi yêu cầu mới sẽ thay thế liên kết cũ. Sau khi đặt lại, liên kết không thể dùng lại.
- Việc đổi mật khẩu, sử dụng liên kết và thu hồi refresh token được xử lý trong cùng một transaction. Hai yêu cầu đồng thời dùng cùng liên kết chỉ có một yêu cầu được chấp nhận.
- Mật khẩu tối thiểu 6 ký tự, tối đa 72 byte UTF-8 theo giới hạn BCrypt. Form xác nhận hai mật khẩu phải trùng nhau.
- API kiểm tra dữ liệu, trả thông báo chung cho email chưa đăng ký và giới hạn yêu cầu gửi email theo IP: 5 lần/phút.
- Token đặt lại không được ghi ra console. Sau khi đổi mật khẩu, refresh token bị thu hồi, frontend xóa phiên cũ và access token cũ không còn hợp lệ kể cả sau khi đăng nhập lại. Nút **Đăng nhập ngay** dùng điều hướng trong ứng dụng để hỗ trợ web/mobile.
- Access token mới có thêm dấu phiên bản thông tin đăng nhập. Sau khi cập nhật backend, người dùng đang giữ token cũ cần đăng nhập lại.

Backend cần cấu hình SMTP hợp lệ: `MailSetting__Host`, `MailSetting__Port`, `MailSetting__Mail`, `MailSetting__Password`, `MailSetting__DisplayName`. Cơ chế SMTP hiện có sử dụng STARTTLS và xác thực tài khoản. Giữ thông tin bí mật ở biến môi trường hoặc user secrets.

Đặt `FrontendUrl` đúng địa chỉ frontend để liên kết trong email mở đúng trang. Ví dụ khi Vite chạy cổng 5175, trong PowerShell chạy backend:

```powershell
$env:FrontendUrl = "http://localhost:5175"
dotnet run --project .\MapAI.API.csproj --launch-profile http --urls "http://0.0.0.0:5028"
```

Trong PowerShell khác, tại thư mục frontend:

```powershell
$env:VITE_API_BASE_URL = "http://localhost:5028/api/v1"
npm run dev -- --port 5175 --strictPort
```

Ô ảnh dùng schema hiện có của nhánh `work`; không cần migration mới ngoài migration cộng đồng đã có trên nhánh này. Không chạy lại migration khởi tạo vào database đang có dữ liệu chỉ để cập nhật ô ảnh.

## Kiểm thử

Tại `MapAI_BE-main`:

```powershell
dotnet test .\tests\MapAI.Tests\MapAI.Tests.csproj
```

Các kiểm thử đi qua HTTP pipeline, xác thực JWT, controller và application service thật; thay repository database/email/storage bằng dữ liệu trong bộ nhớ. Không gửi email thật hay tải ảnh lên bucket thật.

Tại `MapAI_FE-feature-map-api`:

```powershell
npm ci
npx playwright install chromium
npx playwright test tests/e2e/community.spec.js tests/e2e/password-recovery.spec.js
npm run build
```

Playwright khởi động Vite và giả lập API để kiểm thử ảnh ngay trong modal, giữ ảnh khi chọn vị trí, xem trước/xóa ảnh, kiểm tra file, thử lại sau lỗi, gửi chờ duyệt và admin xem ảnh khi duyệt trên desktop/mobile. Bộ kiểm thử PostgreSQL sẵn có tại `MapAI_BE-main/tests/MapAI.CommunityTests` được bổ sung xác nhận ảnh không làm bỏ qua kiểm duyệt và vẫn còn sau khi duyệt. Các kiểm thử quên mật khẩu được giữ lại. Nếu dùng Chromium hệ thống trên Linux, đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE` thành đường dẫn chương trình.

Kiểm thử SMTP và Supabase thực tế cần chạy riêng sau khi đã cấu hình các dịch vụ trên máy triển khai.
