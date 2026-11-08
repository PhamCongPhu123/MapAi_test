# MapAI Authentication Integration Guide

This document describes the authentication flow and API specifications for the MapAI project. The Backend (BE) follows a secure, session-aware JWT architecture with support for Refresh Tokens.

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
  "dateOfBirth": "2000-01-01T00:00:00Z",
  "role": 0 // 0: User, 1: Admin
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
The BE returns standard `ProblemDetails`. Your FE should handle these specific cases:
- **401 (Unauthorized):** Token expired or session revoked (Role changed, Logout).
- **400 (Bad Request):** Validation errors (e.g., "Email already exists", "Invalid credentials").
- **500 (Server Error):** Check `detail` field for the exact error message.

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
