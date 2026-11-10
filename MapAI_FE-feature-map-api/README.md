# MapAI - Trải Nghiệm Bản Đồ Thông Minh Thế Hệ Mới

📱 **Ứng dụng Android/iOS:** Frontend đã tích hợp Capacitor. Xem [hướng dẫn chạy trên điện thoại](MOBILE.md), gồm cấu hình backend trên máy tính, Android Emulator, tạo APK và các giới hạn hiện tại.

📍 **Địa điểm và đánh giá cộng đồng:** Xem [cách gửi địa điểm, admin duyệt và cập nhật database](../COMMUNITY.md).

🤖 **AI điều khiển bản đồ:** Xem [API tìm gần nhất, chỉ đường và các lệnh bản đồ](../MAP_AI_TOOLS.md).

🔑 **Cấu hình ChatAI:** Khi Gemini báo khóa không hợp lệ, xem [cách tạo khóa riêng, lưu bằng .NET User Secrets và chạy lại backend](../MapAI_BE-main/AI_CHAT_SETUP.md).

🔐 **Đăng ký/đăng nhập:** Người dùng tự xác thực email, không cần admin duyệt. Xem [cách xác thực, gửi lại email và cấu hình gửi thư](../MapAI_BE-main/AUTH_INTEGRATION.md).

🗺️ **Bản đồ đường phố và GPS:** Bản đồ OpenFreeMap không cần API key, có nguồn đường phố dự phòng và ô chọn nguồn. Xem [cách bật định vị trên Windows và kiểm tra bản đồ](MAP_AND_LOCATION.md).

Chào mừng bạn đến với **MapAI** — trải nghiệm bản đồ thông minh kết hợp giữa thế giới 3D sống động và khả năng hỗ trợ bằng AI. Với MapAI, việc khám phá thành phố, đặc biệt là Đà Nẵng, trở nên dễ dàng, chính xác và đầy cảm hứng hơn.
aaaa
---

## 🚀 Tính Năng Chính

### 1. Bản Đồ Tương Tác 3D (MapLibre GL)
*   **Hiển thị Vector & Terrain:** Tích hợp dữ liệu địa hình 3D sinh động từ MapTiler.
*   **Tương tác POV:** Chế độ Focus Mode cho phép dẫn đường góc nhìn thứ nhất với camera tự động xoay.
*   **Place Details:** Hiển thị thông tin chi tiết địa điểm (ảnh, rating, mô tả) qua giao diện Glassmorphism hiện đại.

### 2. Trợ Lý AI MapAI Assistant (Gemini)
*   **Hội thoại thông minh:** Trò chuyện trực tiếp để tìm kiếm thông tin du lịch, món ăn, và lịch trình.
*   **AI Action Parser:** Tự động điều khiển bản đồ (`flyTo`, `drawRoute`) dựa trên yêu cầu của người dùng trong ô chat.

### 3. Hệ Thống Quản Trị Toàn Diện (Admin Center)
*   **Dashboard Thống kê:** Theo dõi sức khỏe hệ thống, biểu đồ tăng trưởng người dùng và cơ cấu địa điểm.
*   **Quản lý Người dùng:** Phân quyền (Admin/User), khóa/mở khóa tài khoản và xóa người dùng.
*   **Quản lý Địa điểm (POI):** Thêm, sửa, xóa các điểm trên bản đồ với tọa độ chính xác và tải ảnh trực tiếp.

### 4. Xác Thực & Bảo Mật
*   **Google OAuth & Email/Password:** Đăng nhập linh hoạt và an toàn.
*   **Xác thực Email:** Quy trình đăng ký đi kèm xác nhận email để đảm bảo bảo mật.
*   **Phân quyền (RBAC):** Bảo vệ các route Admin và User một cách chặt chẽ.

---

## 🛠 Công Nghệ Sử Dụng

- **Frontend:** React 19, Vite 8, Tailwind CSS v4.
- **Bản Đồ:** MapLibre GL, OSRM (Routing), Nominatim (Search).
- **Trí Tuệ Nhân Tạo:** Gemini AI Assistant.
- **Backend/Storage:** Tích hợp Supabase cho Authentication, Database và Storage.
- **Hiệu Ứng:** Framer Motion (Animation), Lucide React (Icons).

---

## 📂 Cấu Trúc Thư Mục

- `src/components/`: Các UI component dùng chung và logic bản đồ.
- `src/pages/`: Các trang chính (Home, Map, Admin Dashboard, Profile...).
- `src/services/`: Logic gọi API và xử lý dữ liệu (auth, admin, location, ai).
- `src/context/`: Quản lý trạng thái toàn cục (Toast, Auth).
- `src/hooks/`: Custom hooks để tái sử dụng logic.

---

## 💻 Hướng Dẫn Chạy Dự Án

1. **Cài đặt dependencies**:
   ```bash
   npm install
   ```

2. **Cấu hình môi trường**:
   Tạo file `.env` dựa trên các biến cần thiết (VITE_API_BASE_URL, VITE_MAPTILER_KEY...).

3. **Chạy Development**:
   ```bash
   npm run dev
   ```

4. **Build Production**:
   ```bash
   npm run build
   ```

---
*© 2026 MapAI Team - Khám phá Đà Nẵng theo cách của bạn.*
