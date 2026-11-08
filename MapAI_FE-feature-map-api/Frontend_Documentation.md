# Tài liệu Kỹ thuật Dự án MapAI Frontend - Chi tiết Giao diện & Chức năng

Tài liệu này tập trung vào mô tả chi tiết tất cả các trang (Pages) trong hệ thống MapAI, các tính năng đi kèm và logic xử lý giao diện.

---

## 3. Chi tiết Giao diện các Trang (Page Details)

Hệ thống được chia thành 3 nhóm trang chính: **Nhóm Công cộng & Xác thực**, **Nhóm Người dùng (User)** và **Nhóm Quản trị (Admin)**.

### 3.1. Nhóm Công cộng & Xác thực (Public & Auth Pages)

#### 1. Trang Chủ (Home.jsx)
*   **Mục đích**: Giới thiệu nền tảng và điều hướng người dùng.
*   **Chức năng**:
    *   Hiển thị các tính năng cốt lõi của MapAI (Neural Navigation, AI Assistant).
    *   **Auto-Redirect**: Tự động nhận diện Role. Nếu Admin truy cập trang chủ, hệ thống sẽ chuyển hướng ngay lập tức về `/admin/dashboard`.
    *   Nút CTA (Call to action) dẫn đến trang Đăng ký/Bản đồ.

#### 2. Trang Đăng nhập (Login.jsx)
*   **Chức năng**: 
    *   Xác thực qua Email/Password.
    *   **Google OAuth**: Đăng nhập nhanh bằng tài khoản Google.
    *   **Ghi nhớ đăng nhập**: Lưu trạng thái phiên làm việc.
    *   **Xử lý chuyển hướng**: Sau khi login, Admin về Dashboard, User về trang trước đó hoặc trang Bản đồ.

#### 3. Trang Đăng ký (Register.jsx)
*   **Chức năng**: 
    *   Tạo tài khoản mới với các trường: Full Name, Email, Password.
    *   Ràng buộc mật khẩu (độ dài, độ phức tạp).
    *   Chuyển hướng sang trang yêu cầu Xác thực Email sau khi đăng ký thành công.

#### 4. Quên & Đặt lại mật khẩu (ForgotPassword.jsx & ResetPassword.jsx)
*   **Chức năng**:
    *   `ForgotPassword`: Nhập email để hệ thống gửi mã xác thực.
    *   `ResetPassword`: Trang nhận Token từ URL, cho phép nhập mật khẩu mới. Có cơ chế tự động sửa lỗi Token (fix dấu `+`) và đếm ngược redirect về Login.

---

### 3.2. Nhóm Người dùng (User Pages)

#### 5. Trang Bản đồ Tương tác (MapPage.jsx) - *Trang chủ đạo*
*   **Mục đích**: Giao diện chính để tìm kiếm và sử dụng AI.
*   **Các thành phần chức năng**:
    *   **Bản đồ Vector (MapLibre)**: Hiển thị nền bản đồ 3D, điều khiển Zoom/Rotate.
    *   **Neural AI Assistant (ChatPanel)**: Ô chat với trợ lý ảo Gemini. Hiển thị lịch sử trò chuyện và các gợi ý thông minh.
    *   **Search Bar**: Tìm kiếm địa điểm nhanh theo từ khóa.
    *   **Directions Panel**: Hiển thị chỉ đường (Car, Bike, Foot) với thông tin khoảng cách/thời gian.
    *   **Place Detail Panel**: Hiển thị thông tin chi tiết địa điểm (Mô tả, Ảnh, SĐT, Website) khi click vào Marker.

#### 6. Trang Khám phá (Explore.jsx)
*   **Chức năng**:
    *   Hiển thị các địa điểm nổi bật theo danh mục (Nhà hàng, Khách sạn, Cảnh đẹp).
    *   Bộ lọc nhanh địa điểm xung quanh.
    *   Chế độ Grid View/List View cho các địa danh.

#### 7. Trang Hồ sơ cá nhân (Profile.jsx)
*   **Chức năng**:
    *   Hiển thị thông tin chi tiết người dùng.
    *   **Update Info**: Chỉnh sửa họ tên, tiểu sử.
    *   **Avatar Studio**: Upload ảnh đại diện mới, hỗ trợ Crop và Preview thời gian thực. Tích hợp trực tiếp với Supabase Storage.

---

### 3.3. Nhóm Quản trị (Admin Pages)

#### 8. Layout Quản trị (AdminLayout.jsx)
*   **Mục đích**: Cung cấp Sidebar điều hướng và khung giao diện Control Center.
*   **Chức năng**:
    *   Sidebar thu gọn/mở rộng linh hoạt.
    *   Hiển thị thông tin Admin đang đăng nhập.
    *   Navigation: Dashboard, User Management, Location Management.

#### 9. Dashboard Thống kê (Dashboard.jsx)
*   **Chức năng**:
    *   **Stat Cards**: Tổng số User, User đang hoạt động, Địa điểm mới, Sức khỏe hệ thống.
    *   **Engagement Chart**: Biểu đồ vùng (Area Chart) theo dõi lượng người dùng trong tuần.
    *   **Diversity Pie**: Biểu đồ tròn phân tích cơ cấu loại địa điểm.
    *   **System Core Health**: Thanh tiến trình (Progress Bar) hiển thị hiệu năng CPU/API/Storage.
    *   **Recent Events**: Danh sách các hành động quan trọng vừa diễn ra trong hệ thống.

#### 10. Quản lý Người dùng (UserManagement.jsx)
*   **Chức năng**:
    *   **Data Table High-tech**: Hiển thị danh sách user với avatar và role label.
    *   **Search Engine**: Tìm kiếm user theo tên hoặc email.
    *   **Authorization Control**: Thay đổi Role (Admin <-> User) với popup xác nhận.
    *   **Security Lock**: Khóa/Mở khóa tài khoản ngay lập tức.
    *   **Account Termination**: Xóa vĩnh viễn user (bao gồm cả tài nguyên Supabase) qua Confirmation Modal.

#### 11. Quản lý Địa điểm (LocationManagement.jsx)
*   **Chức năng**:
    *   **Geospatial Inventory**: Danh sách tất cả tọa độ POI trong database.
    *   **Asset Registration (Add)**: Form tạo mới địa điểm với tọa độ chính xác.
    *   **Thumbnail Uploader**: Tải ảnh địa điểm lên server, nhận URL preview.
    *   **Edit Module**: Cập nhật thông tin chi tiết, tọa độ, tags và các liên kết Google Maps.
    *   **Deletion**: Xóa địa điểm khỏi hệ thống với popup cảnh báo bảo mật.

---

## 4. Các luồng xử lý chính (Core Workflows) - *Bổ sung*

1.  **Luồng AI -> Map Action**: 
    `Chat Input` -> `Back-end AI Processing` -> `FE Action Parser` -> `Map.flyTo()` hoặc `drawRoute()`.
2.  **Luồng Xác thực 2 lớp**: 
    `Register` -> `Send Verification Email` -> `Click Link` -> `Verify Page` -> `Success Notification`.
3.  **Luồng Quản trị Dữ liệu**:
    `Admin Action` -> `Confirmation Modal` -> `API Request` -> `Toast Response` -> `Data Re-sync`.
