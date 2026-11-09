# MapAI Authentication Integration Guide

This document describes the authentication flow and API specifications for the MapAI project. The Backend (BE) follows a secure, session-aware JWT architecture with support for Refresh Tokens.

## Đăng ký và đăng nhập trên máy tính / điện thoại

Người dùng **không cần quản trị viên duyệt tài khoản**. Luồng email/mật khẩu là: đăng ký → mở liên kết xác thực trong email → đăng nhập. Việc admin duyệt chỉ áp dụng cho địa điểm cộng đồng.

- Tài khoản đăng ký công khai luôn có vai trò `User`; API bỏ qua mọi trường `role` do client gửi. Enum trong database là `Admin = 0`, `User = 1`.
- Nếu chưa xác thực, trang đăng nhập hiển thị lý do và nút **Gửi lại email xác thực**. Chờ ít nhất 60 giây giữa hai lần gửi. Liên kết mới có hiệu lực 5 phút và thay thế liên kết trước đó; kiểm tra cả Spam.
- Tài khoản cũ đang chờ xác thực vẫn dùng được nút gửi lại, không cần đăng ký lại hoặc sửa `IsActive` bằng SQL. Tài khoản bị vô hiệu hóa không thể mở khóa qua gửi lại email.
- Với liên kết đã hết hạn, quay về đăng nhập, nhập email/mật khẩu rồi bấm đăng nhập để hiện hướng dẫn gửi lại.
- Khi gửi email thất bại, tài khoản có thể đã được tạo. API trả `VERIFICATION_EMAIL_UNAVAILABLE`; frontend chuyển sang hướng dẫn gửi lại thay vì yêu cầu đăng ký một tài khoản trùng email.
- Backend dùng bảng `Users` và `AccountTokens` của ứng dụng, không dùng Supabase Auth để đăng nhập.

Backend cần `FrontendUrl` trỏ đến đúng địa chỉ website đang chạy. Ví dụ trước khi chạy backend trong PowerShell:

```powershell
$env:FrontendUrl = "http://localhost:5173"
dotnet run --project .\src\MapAI.API --launch-profile http --urls http://0.0.0.0:5028
```

Khi mở thư trên điện thoại thật, `localhost` là điện thoại đó. Có thể mở liên kết trên máy tính đang chạy website để xác thực trước, rồi đăng nhập trên app; hoặc cấu hình `FrontendUrl` thành địa chỉ website mà điện thoại truy cập được.

Nếu không nhận được thư hoặc API báo không gửi được email, kiểm tra các khóa `MailSetting:Host`, `Port`, `Mail`, `Password` ở cấu hình backend; cấu hình gửi thư hiện dùng SMTP STARTTLS. Dùng biến môi trường hoặc .NET User Secrets cho mật khẩu, không đưa mật khẩu vào chat hay Git. Kiểm thử tự động bên dưới thay dịch vụ gửi mail bằng hộp thư trong bộ nhớ, không xác nhận SMTP thực tế.

Bản sửa không yêu cầu migration mới. Với tài khoản tạo từ form đăng ký cũ, cần rà soát vai trò: form cũ đã gửi nhầm `role = 0` (Admin). Bản sửa ngăn đăng ký mới nhận quyền này; không tự hạ quyền hàng loạt tài khoản có sẵn vì không thể phân biệt admin hợp lệ với tài khoản tạo nhầm.

## 1. Authentication Strategy
- **Primary Auth:** Stateless JWT (Access Token) + Stateful Session (Refresh Token).
- **Security:** Access Tokens should be short-lived (e.g., 15-60 mins), and Refresh Tokens should be long-lived (e.g., 30 days).
- **Revocation:** The BE validates the presence of a valid Refresh Token in the database on every authorized request. Deleting the Refresh Token (Logout) immediately invalidates all active Access Tokens for that session.
- **Models:** All Request/Response models are located in `MapAI.Domain/Models/Auth`.

---

## 2. API Endpoints Reference

### Base URL: `{{backend_url}}/api/v1/auth`

| Endpoint | Method | Request Body | Description |
| :--- | :--- | :--- | :--- |
| `/login` | `POST` | `LoginRequest` | Returns Access & Refresh tokens. |
| `/register` | `POST` | `RegisterRequest` | Creates inactive user & sends verification email. |
| `/refresh` | `POST` | `RefreshRequest` | Exchanges an old Refresh Token for a new pair. |
| `/logout` | `POST` | `None` (Authorized) | Deletes the session from DB & invalidates tokens. |
| `/me` | `GET` | `None` (Authorized) | Returns current user info (ID, Email, Role). |
| `/verify-email`| `GET` | `?userId=&token=` | Activates the user account. |
| `/resend-verification` | `POST` | `{ "email": "user@example.com" }` | Sends a new verification link to an account awaiting verification. Generic success for active, unknown or disabled emails. |
| `/forgot-password`| `POST` | `ForgotPasswordRequest` | Sends a reset link to the user's email. |
| `/reset-password`| `POST` | `ResetPasswordRequest` | Updates the password using a reset token. |
| `/google-login`| `POST` | `GoogleLoginRequest`| Authenticates via Google IdToken. |

---

## 3. Request/Response Models (JSON)

### LoginRequest
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### LoginResponse
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "long-random-string",
  "isRegistered": true
}
```

### RegisterRequest
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "fullName": "John Doe",
  "phoneNumber": "0987654321",
  "dateOfBirth": "2000-01-01T00:00:00Z"
}
```

---

## 4. Frontend Implementation Roadmap

### Phase 1: Storage & Security
1.  **Storage:** After `/login`, store `accessToken`, `refreshToken`, and `userId` (from decoded JWT or `/me`) in `localStorage` or `sessionStorage`.
2.  **Authorization Header:** Every authorized request MUST include the header: `Authorization: Bearer <accessToken>`.

### Phase 2: Axios Interceptors (Recommended)
Implement two interceptors in your API client:

- **Request Interceptor:** Automatically attaches the `accessToken` from storage to every outgoing request.
- **Response Interceptor:** 
    - Listen for `401 Unauthorized` errors.
    - If a `401` occurs, pause the request, call `/refresh` using the stored `refreshToken` and `userId`.
    - If `/refresh` succeeds: Save new tokens and retry the failed request.
    - If `/refresh` fails: Clear storage and redirect to `/login`.

### Phase 3: Error Handling
Expected auth failures return `{ "code": "...", "message": "..." }`. Model validation uses `ProblemDetails` with `errors`. Clients accept `message`, `detail` and validation `errors`.

| Status | Code | Meaning |
| :--- | :--- | :--- |
| 401 | `INVALID_CREDENTIALS` | Incorrect email or password. |
| 401 | `SESSION_EXPIRED` | Refresh token expired, revoked or user inactive. |
| 403 | `EMAIL_NOT_VERIFIED` | Verify email or resend the link; no admin approval required. |
| 403 | `ACCOUNT_DISABLED` | Account is disabled, not awaiting verification. |
| 409 | `EMAIL_EXISTS` | Email already registered. |
| 400 | `VERIFICATION_EXPIRED` / `VERIFICATION_INVALID` | Resend verification from login. |
| 429 | `VERIFICATION_COOLDOWN` | Wait 60 seconds before resending. |
| 503 | `VERIFICATION_EMAIL_UNAVAILABLE` | Account awaits verification; mail delivery failed. |
| 500 | `AUTH_UNAVAILABLE` | Unexpected server failure; response does not expose internal errors. |

---

## 5. Google Login Flow
1.  Frontend uses Google SDK to obtain an `idToken`.
2.  Send `idToken` to `/google-login`.
3.  The BE will automatically create a user if they don't exist.
4.  Check `isRegistered` in the response to decide if you need to redirect the user to a "Complete Profile" page.

---

## 6. Roles & Authorization
The JWT contains a `role` claim. Use this to hide/show UI elements (e.g., Admin Dashboard).
- `User`: Standard access.
- `Admin`: Full access including system settings.

## 7. Regression checks

Authentication integration checks create a disposable database on a **loopback PostgreSQL server** with CREATE DATABASE permission. They test the real HTTP controllers, BCrypt, JWT middleware, session revocation and database, replacing only email delivery. They never migrate the configured Supabase database or send external mail.

```powershell
# From MapAI_BE-main; replace the local test connection for your PostgreSQL setup.
$env:MAPAI_TEST_CONNECTION = "Host=127.0.0.1;Port=5432;Username=local_test_user;Database=postgres"
dotnet run --project .\tests\MapAI.AuthTests
```

Frontend checks (from the frontend folder, with Playwright Chromium installed):

```powershell
npx playwright test tests/e2e/auth.spec.js
```

These UI checks simulate API replies to verify error messages, registration, resend and a single-use verification link under React StrictMode on phone and desktop layouts.
