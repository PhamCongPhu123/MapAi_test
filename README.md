# MapAI — online, offline và mobile

Nhánh tích hợp: **`work-unified`**. Hai nhánh `work-online` và `work-offline` được giữ để đối chiếu; chỉ cần checkout nhánh tích hợp để tiếp tục phát triển.

```bash
git checkout work-unified
cd MapAI_FE-feature-map-api
npm ci
npm run dev
```

- `/map`: chức năng online và tự chuyển sang bản đồ cục bộ khi mất mạng.
- `/offline`: bản đồ Đà Nẵng, 28 địa điểm, tìm kiếm, chỉ đường, yêu thích và trợ lý cục bộ, không cần đăng nhập.
- Android/iOS: cùng mã nguồn React, đóng gói bằng Capacitor 8. Bản demo offline không cần chạy backend; bản online cần cấu hình API thực tế.

Tạo bản Android demo có sẵn dữ liệu:

```bash
cd MapAI_FE-feature-map-api
npm run mobile:sync:offline
cd android
./gradlew assembleDebug
```

Windows dùng `gradlew.bat assembleDebug`. Yêu cầu JDK 21 có compiler và Android SDK; APK ở `android/app/build/outputs/apk/debug/app-debug.apk`.

Xem [hướng dẫn điện thoại](MapAI_FE-feature-map-api/MOBILE.md), [offline/PWA](MapAI_FE-feature-map-api/docs/OFFLINE.md), [Clean Architecture 3 lớp](ARCHITECTURE.md) và [cấu hình backend](MapAI_BE-main/AUTH_INTEGRATION.md).
