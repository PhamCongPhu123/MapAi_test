# Tài liệu Kỹ thuật Dự án MapAI Backend - Toàn tập

Tài liệu này cung cấp cái nhìn chi tiết nhất về kiến trúc, cấu hình, logic xử lý nghiệp vụ và hướng dẫn tích hợp (Mapping) cho hệ thống MapAI.

---

## Phần 1: Kiến trúc Hệ thống (Detailed Clean Architecture)

Dự án tuân thủ nghiêm ngặt mô hình **Clean Architecture**, đảm bảo tính độc lập và dễ mở rộng:

1.  **MapAI.API (Lớp hiển thị & Điều hướng)**
    *   **Controllers**: Xử lý HTTP Request, định nghĩa Route và bóc tách dữ liệu từ Body/Query.
    *   **Program.cs**: Cấu hình Dependency Injection (DI), xác thực JWT Bearer, CORS (cho phép mọi nguồn), và các Authorization Policies (`AdminOnly`, `UserOnly`).
    *   **Middleware**: Xử lý lỗi tập trung (`GlobalExceptionHandler`) và ghi log yêu cầu.

2.  **MapAI.Application (Lớp Nghiệp vụ chính)**
    *   **Interfaces**: Định nghĩa hợp đồng cho các dịch vụ.
    *   **Services**: Thực thi logic nghiệp vụ (ví dụ: tính toán điểm relevancy, điều phối AI và Map data).
    *   **Mapping logic**: Chuyển đổi dữ liệu từ Entity sang Response (ví dụ: parse `PhotosJson` thành `List<string> Images`).

3.  **MapAI.Domain (Lớp Lõi)**
    *   **Entities**: Các bảng trong Database (User, Location, AccountToken).
    *   **Models (DTOs)**: Định nghĩa cấu trúc dữ liệu trao đổi (Request/Response).
    *   **Enums**: Định nghĩa hằng số cho Role (Admin=0, User=1) và TokenType.

4.  **MapAI.Infrastructure (Lớp Hạ tầng & Tích hợp)**
    *   **Repositories**: Truy vấn trực tiếp vào PostgreSQL qua Entity Framework Core.
    *   **External Services**:
        *   **GeminiRepository**: Gọi API Google AI để phân loại ý định (Router).
        *   **OsmRepository**: Tích hợp Nominatim (Search), Overpass (Nearby), và OSRM (Direction).
        *   **StorageRepository**: Tương tác với Supabase Storage qua HttpClient (Hỗ trợ upload/delete theo bucket).

5.  **MapAI.Common (Lớp Tiện ích)**
    *   **Helpers**: `HashHelper` (SHA256 cho mật khẩu và token), `GlobalExceptionHandler`.
    *   **Configs**: Các lớp Map dữ liệu từ `appsettings.json`.

---

## Phần 2: Cấu hình và Biến môi trường (Environment Details)

Các tham số trong `appsettings.json` ảnh hưởng trực tiếp đến vận hành:

| Tham số | Ý nghĩa & Định dạng | Lưu ý |
| :--- | :--- | :--- |
| `DefaultConnection` | Chuỗi kết nối PostgreSQL (Supabase) | Chứa ID, Password và thông tin Pooler. |
| `Jwt:Secret` | Chuỗi ký tự dài (Base64/String) | Dùng để ký và xác thực tính toàn vẹn của Token. |
| `Supabase:Url` | Link project Supabase | Dùng làm gốc để tạo URL ảnh public. |
| `MailSetting` | Host, Port, Email, App Password | Dùng SMTP Gmail để gửi mail xác thực/reset pass. |
| `Foursquare:ApiKey` | Khóa API Foursquare | Hạn mức gọi API phụ thuộc vào key này (Dùng làm dự phòng). |
| `GeminiConfig` | API Key & Model (gemini-2.0-flash) | Quyết định tốc độ và độ thông minh của Chatbot. |

---

## Phần 3: Tham chiếu API và Hướng dẫn Tích hợp (FE Reference)

### 1. Quản lý Địa điểm (Location Management) - [Quyền: AdminOnly]

*   **Tải lên hình ảnh (Upload)**: `POST /api/v1/location/upload-thumbnail`
    *   **Mô tả**: Tải file ảnh lên bucket `location`. Phải gọi API này để lấy URL trước khi tạo/cập nhật địa điểm.
    *   **Request**: `multipart/form-data` chứa trường `file`.
    *   **Response**: `{ "url": "string" }`.
*   **Tạo mới địa điểm (Create)**: `POST /api/v1/location`
    *   **Mô tả**: Lưu thông tin địa điểm vào DB.
    *   **Body (JSON)**: Gửi kèm `thumbnail` (URL ảnh chính) và `images` (Mảng URL ảnh chi tiết).
*   **Cập nhật địa điểm (Update)**: `PUT /api/v1/location/{id}`
    *   **Mô tả**: Chỉnh sửa thông tin. Lưu ý: Mảng `images` gửi lên sẽ ghi đè hoàn toàn danh sách cũ.
*   **Xóa địa điểm (Delete)**: `DELETE /api/v1/location/{id}`
    *   **Mô tả**: Xóa vĩnh viễn bản ghi khỏi DB.

### 2. Quản lý Người dùng & Hệ thống (System Admin) - [Quyền: AdminOnly]

*   **Danh sách User**: `GET /api/v1/admin/users`
    *   **Response**: Mảng các đối tượng User (Id, Email, FullName, Role, IsActive, AvatarUrl).
*   **Xóa User**: `DELETE /api/v1/admin/users/{userId}`
    *   **Mô tả**: Xóa sạch dữ liệu User, bao gồm việc xóa file avatar vật lý trên Supabase và thu hồi mọi Refresh Token liên quan.
*   **Khóa/Mở tài khoản**: `PATCH /api/v1/admin/users/{userId}/toggle-status`
    *   **Mô tả**: Thay đổi trạng thái `IsActive`. Nếu `IsActive = false`, User sẽ bị đá ra khỏi hệ thống ngay lập tức (vô hiệu hóa JWT).
*   **Thay đổi quyền**: `PATCH /api/v1/admin/users/{userId}/role?role={0|1}`
    *   **Tham số**: `role=0` (Admin), `role=1` (User).

### 3. Tương tác AI và Bản đồ (AI & Map Integration) - [Quyền: User/Admin]

*   **Hỏi đáp AI (Chat)**: `POST /api/v1/Ai/ask`
    *   **Mô tả**: Nhận câu hỏi tự nhiên từ người dùng.
    *   **FE Mapping**: Phản hồi chứa `Message` (text) và `Action`. Nếu `Action` có kiểu `FLY_TO` hoặc `SET_DIRECTION`, FE sử dụng tọa độ đi kèm để điều khiển bản đồ MapLibre.
*   **Tìm kiếm lân cận**: `GET /api/v1/map/nearby?lat={...}&lng={...}&query={...}&radius={...}`
    *   **Mô tả**: Trả về danh sách POI (Point of Interest) xung quanh.
    *   **FE Mapping**: Hiển thị các Marker trên bản đồ dựa vào tọa độ trả về.
*   **Tìm đường (Direction)**: `POST /api/v1/map/direction`
    *   **Body**: `{ "startLat", "startLng", "endLat", "endLng", "mode": "car|bike|foot" }`.
    *   **Response**: Đối tượng lộ trình (geometry, distance, duration).

### 4. Xác thực và Hồ sơ cá nhân (Auth & Profile)

*   **Google Login**: `POST /api/v1/auth/google-login`
    *   **Body**: `{ "idToken": "string" }` (Token lấy từ thư viện Google trên FE).
*   **Lấy thông tin cá nhân**: `GET /api/v1/user/infor`
    *   **Mô tả**: Trả về Profile chi tiết dựa trên Token hiện tại.
*   **Cập nhật Avatar**: `POST /api/v1/user/update-avatar`
    *   **Mô tả**: Tải ảnh lên bucket `avatars`. Hệ thống tự động xóa ảnh cũ trên Supabase để tiết kiệm dung lượng.

---

## Phần 4: Logic Xử lý Nghiệp vụ chuyên sâu

### 1. Logic Phân phối Hình ảnh (Image Storage)
Hệ thống phân tách rõ ràng qua 2 Buckets:
*   `avatars`: Chứa ảnh hồ sơ người dùng.
*   `location`: Chứa ảnh các địa điểm du lịch, nhà hàng.
*   **Tự động dọn dẹp**: Khi người dùng cập nhật ảnh mới hoặc xóa địa điểm, hệ thống tự động gọi API xóa file cũ trên Supabase để tránh rác dữ liệu.

### 2. Logic Tìm kiếm & Relevancy (Location Search)
Khi gọi `GET /api/v1/location?title=...`, hệ thống tính điểm:
*   Khớp 100% tên: 100 điểm.
*   Khớp mảng Tags: 70 điểm.
*   Tên chứa từ khóa: 20 điểm.
*   **Kết quả**: Luôn trả về danh sách đã được sắp xếp theo điểm số từ cao xuống thấp.

### 3. Logic AI Router (Intelligence)
Sử dụng `ROUTER_SYSTEM_PROMPT` để ép AI trả về JSON có cấu trúc:
*   `Category`: `place_detail` | `action_map` | `error`.
*   `ActionType`: `FlyTo` | `Direction` | `Nearby` | `SwitchView`.
*   **Location Picker**: Nếu tìm kiếm trả về nhiều kết quả, một tầng AI khác sẽ đọc danh sách đó và chọn ra vị trí phù hợp nhất với ngữ cảnh chat của người dùng.
