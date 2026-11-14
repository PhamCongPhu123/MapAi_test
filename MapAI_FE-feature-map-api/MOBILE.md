# Chạy MapAI trên Android và iOS bằng Capacitor

Nhánh `work-unified` dùng chung React/Vite cho website và Capacitor. Bản đồ online và offline nằm trong cùng ứng dụng; backend .NET chạy độc lập để cung cấp tài khoản, dữ liệu live và Gemini. Bản đồ offline, tìm kiếm, chỉ đường A* và trợ lý cục bộ dùng gói Đà Nẵng có sẵn, không cần backend.

Kiến trúc tuân theo [3 lớp giao diện — nghiệp vụ — dữ liệu](../ARCHITECTURE.md). `/map` dùng cùng giao diện và MapLibre canvas cho cả hai chế độ; nguồn tìm kiếm, chi tiết, tuyến và trợ lý tự đổi theo mạng. `/offline` và `/map/online` là alias chuyển về `/map`. Bản đồ đọc công khai; thao tác ghi dữ liệu vẫn cần tài khoản.

## Đã tích hợp

- Capacitor 8, project `android/` và `ios/`, tên MapAI, application ID `vn.mapai.app`.
- Định vị bằng plugin native trên điện thoại, geolocation của trình duyệt trên web; chỉ xin quyền khi người dùng bấm định vị. Cho phép vị trí gần đúng trên Android.
- Điều hướng dưới cùng trên màn hình nhỏ; bản đồ toàn màn hình, chat AI dạng bảng mở/đóng, panel chỉ đường và chi tiết địa điểm vừa chiều rộng điện thoại.
- Vùng an toàn quanh tai thỏ/thanh hệ thống, bàn phím, thanh trạng thái, Back của Android (đóng panel trước, rồi quay lại, thu nhỏ app khi ở trang chủ).
- Giữ luồng đăng nhập email/mật khẩu và API hiện tại, dùng chung cấu hình API cho cả upload ảnh.
- Nhận liên kết `mapai://auth/verify-email?...` và `mapai://auth/reset-password?...` khi app đã cài. Chỉ hai đường dẫn này được chấp nhận.

## 1. Công cụ trên máy của bạn

- Node.js >= 22.12, npm. Chạy `npm ci` trong thư mục frontend này.
- Android: **JDK 21 đầy đủ, có `javac`** (JRE không đủ), Android Studio, Android SDK Platform 36 và Build Tools 35.0.0 theo Android Gradle Plugin. Cài qua SDK Manager của Android Studio. Chọn emulator hoặc bật USB debugging trên điện thoại Android 7+.
- iOS: cần macOS và Xcode tương thích Capacitor 8; project dùng Swift Package Manager, deployment target iOS 15. Không build IPA bằng Windows/Linux.

Các lệnh dưới đây chạy trong `MapAI_FE-feature-map-api/`, trừ khi có ghi khác. Giữ `android/` và `ios/` trong Git; dependency, asset web đã copy, SDK và build output được bỏ qua. App đang dùng icon mặc định từ template; thay icon và cấu hình ký bản release trước khi phát hành.

## Demo offline trên Android, không cần backend

```bash
npm ci
npm run mobile:sync:offline
cd android
./gradlew assembleDebug
```

Windows dùng `.\gradlew.bat assembleDebug`. Cài `android/app/build/outputs/apk/debug/app-debug.apk` lên điện thoại bằng Android Studio, chuyển file APK hoặc `adb install -r app/build/outputs/apk/debug/app-debug.apk` từ thư mục `android/`.

Bản này mở thẳng `/map`, tự dùng nguồn cục bộ vì không có URL backend. Giao diện, font, bản đồ PMTiles, ảnh và dữ liệu đường nằm trong APK; có thể bật chế độ máy bay **trước lần mở đầu**. Không cần Vite hoặc máy tính sau khi cài. Thử tìm “mi quang”, mở chi tiết, lưu yêu thích và chọn Cầu Rồng làm điểm xuất phát để tính đường. GPS cần cấp quyền và có thể mất thời gian bắt tín hiệu; luôn có chọn mốc/chạm bản đồ.

`mobile:sync:offline` bỏ URL backend; nút online sẽ hướng dẫn cấu hình. Để demo cả hai chế độ trong một APK, dùng `mobile:sync:dev` bên dưới với backend đang chạy. Gói offline vẫn có sẵn trong bản đầy đủ, kể cả khi API lỗi. Nếu chỉ server lỗi mà thiết bị vẫn có mạng, chọn **Giả lập Offline** trong cửa sổ **Dữ liệu** để thử nguồn cục bộ; ngắt mạng thật để kiểm tra chuyển tự động.

Bản native build vào `dist-native/`, tách với website PWA `dist/`, và không đăng ký Service Worker. Sau mỗi thay đổi source phải sync/build lại. Sync gói demo sang iOS trên Mac: `npm run mobile:sync:offline -- ios`.

## 2. Chạy backend trên máy tính (chưa cần deploy)

Trong `MapAI_BE-main/`:

```bash
dotnet run --project src/MapAI.API/MapAI.API.csproj --launch-profile http --urls http://0.0.0.0:5028
```

Mở Swagger trên máy tính ở cổng 5028, rồi kiểm tra API thực tế `/api/v1/location`. Backend phải kết nối được PostgreSQL. Backend hiện có CORS cho phép origin khác nên frontend Capacitor có thể gọi API bằng `fetch` như website. Chỉ dùng cấu hình HTTP này cho phát triển trong mạng tin cậy.

Chọn địa chỉ API:

| Thiết bị chạy app | `VITE_API_BASE_URL` |
| --- | --- |
| Android Emulator của Android Studio | `http://10.0.2.2:5028/api/v1` |
| Điện thoại Android cùng Wi-Fi | `http://<IP-Wi-Fi-máy-tính>:5028/api/v1` |
| Bản production / iOS | Địa chỉ API HTTPS có chứng chỉ hợp lệ |

Ví dụ IP máy tính là `192.168.1.10`, dùng `http://192.168.1.10:5028/api/v1`. Cho phép cổng 5028 trong firewall của máy tính trên mạng riêng, và kiểm tra Swagger từ trình duyệt điện thoại trước. `localhost`/`127.0.0.1` trong app trỏ đến chính điện thoại, không phải máy chạy backend. Cổng 5028 là cổng chỉ định bằng lệnh trên; profile gốc của repo mặc định là 5281 nếu bạn không truyền `--urls`.

## 3. Chạy Android

Sao chép `.env.mobile-development.example` thành `.env.mobile-development.local` và chọn URL phù hợp ở trên. Trên macOS/Linux có thể dùng:

```bash
cp .env.mobile-development.example .env.mobile-development.local
npm run mobile:sync:dev
npm run android:open
```

Trên Windows sao chép file bằng Explorer hoặc `Copy-Item` trong PowerShell. Trong Android Studio, đợi Gradle Sync, chọn emulator/điện thoại rồi bấm **Run**. Không cần chạy Vite khi mở app: nội dung React đã nằm trong APK.

Để tạo APK debug:

```bash
cd android
./gradlew assembleDebug
```

Windows dùng `.\gradlew.bat assembleDebug`. APK nằm tại `android/app/build/outputs/apk/debug/app-debug.apk`. Có thể cài bằng Android Studio hoặc `adb install -r app/build/outputs/apk/debug/app-debug.apk` khi đang đứng trong `android/`.

Sau mỗi lần sửa React, CSS, biến môi trường hoặc plugin, chạy lại `npm run mobile:sync:dev` trong thư mục frontend rồi Run/build lại. Biến `VITE_*` được chèn lúc build, đổi file `.env` không tự đổi app đã cài.

## 4. Production và iOS

Sao chép `.env.mobile.example` thành `.env.mobile.local`, điền URL backend HTTPS thực tế, rồi chạy:

```bash
npm run mobile:sync -- android
# Hoặc trên máy Mac:
npm run mobile:sync -- ios
npm run ios:open
```

Chọn signing team và thiết bị trong Xcode. Script kiểm tra URL API, build Vite, rồi sync đúng platform; sẽ dừng nếu thiếu URL, dùng localhost hoặc dùng HTTP cho production/iOS. Không cần tạo lại project bằng `cap add`.

Android chỉ cho phép HTTP trong manifest debug. Lệnh development dùng local origin HTTP để tránh lỗi mixed content khi gọi backend trên máy tính. Lệnh production chuyển về HTTPS và tắt mixed content; Gradle từ chối build release nếu asset vẫn đang dùng cấu hình development. Luôn chạy `mobile:sync` trước khi tạo APK/AAB release và tự cấu hình signing. Không bật bỏ qua kiểm tra chứng chỉ TLS để dùng chứng chỉ localhost.

## 5. Phần cần cấu hình riêng

- **Google login:** `@react-oauth/google` là SDK web. Mobile hiện dùng email/mật khẩu và ẩn nút Google web để tránh luồng OAuth không hỗ trợ WebView. Để bật Google native cần thêm plugin đăng nhập native, OAuth client Android/iOS và Web Client ID khớp `Google:ClientId` của backend; Android cần package ID và SHA của chứng chỉ ký. Chưa cấu hình hoặc kiểm thử Google native trong thay đổi này. Website vẫn dùng Google khi có `VITE_GOOGLE_CLIENT_ID`.
- **Bản đồ:** cả hai chế độ dùng OpenFreeMap Liberty. Gói nhúng chứa tile OpenFreeMap thật, sprite và glyph, khoảng 19 MiB cùng POI/graph Đà Nẵng. Không cần MapTiler key. Khi đổi mạng, style giữ nguyên và chỉ thay URL nguồn; offline giới hạn trong vùng đã tải. `VITE_MAPTILER_KEY` cũ không còn chọn nguồn khác. Xem [offline/OpenFreeMap](docs/OFFLINE.md).
- **AI, email, PostgreSQL, Supabase:** giữ trên backend. Không chép password, Gemini key, JWT secret hoặc Supabase service role vào frontend. Mọi biến `VITE_*` đều đọc được từ APK/IPA.
- **Email xác thực / quên mật khẩu:** app đã nhận custom scheme như ví dụ dưới; backend hiện vẫn gửi link website theo `FrontendUrl`. Cần thay đổi luồng gửi/chuyển tiếp link hoặc cấu hình Universal Links/App Links riêng nếu muốn email mở app tự động. Không đổi `FrontendUrl` thành custom scheme một cách trực tiếp vì backend đang ghép đường dẫn web.

```text
mapai://auth/verify-email?userId=...&token=...
mapai://auth/reset-password?userId=...&token=...
```

## 6. Kiểm tra

```bash
npm run build
npm run test:mobile
npm run test:mobile:e2e
npm run test:architecture
npm run test:e2e:offline
npm run test:native:offline
npm run lint
```

Lần đầu chạy E2E trên máy mới: `npx playwright install chromium`. Nếu đã có Chromium hệ thống, đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE` bằng đường dẫn executable của nó. E2E kiểm tra giao diện ở kích thước điện thoại và desktop, dùng API/bản đồ giả lập; không thay thế kiểm thử trên thiết bị và backend thực.

Trước `test:native:offline`, chạy `npm run mobile:sync:offline`. Bài này phục vụ file từ `dist-native` bằng transport giả lập bộ nhớ thiết bị, tắt mạng và Service Worker ngay từ đầu, rồi kiểm tra tìm kiếm, tuyến đường, Back và mở lại. Bài kiểm tra không chạy Android emulator.

Trên điện thoại, kiểm tra: đăng nhập email, khởi động lại app, mở bản đồ, cấp/từ chối quyền vị trí, mở/đóng chat và bàn phím, xoay màn hình, Back của Android, upload ảnh và gọi API thực tế. Nếu API địa điểm trả 500 do cơ sở dữ liệu thì phải sửa kết nối backend; đóng gói Capacitor không sửa được lỗi này.

Lint toàn repo đã sửa hết 6 lỗi; vẫn còn 4 cảnh báo về dependency của `useEffect` cần xem xét riêng. Build frontend vẫn cảnh báo bundle bản đồ lớn. Việc đồng bộ project iOS trên Linux không xác nhận build/khởi chạy trên iPhone.
