# MapAI — một bản đồ, tự chuyển online/offline

Nhánh tích hợp: **`work-unified`**. Website, Android và iOS dùng chung React/Capacitor và một màn hình `/map`.

```bash
git checkout work-unified
cd MapAI_FE-feature-map-api
npm ci
npm run dev
```

Khi có mạng, ứng dụng dùng tìm kiếm, dữ liệu, chỉ đường và trợ lý online. Khi mất mạng, cùng màn hình chuyển sang POI, A* và trợ lý cục bộ. Các thao tác cần tài khoản/server vẫn được kiểm tra quyền và bị khóa khi offline. Các URL cũ `/offline`, `/map/online` chuyển về `/map` và giữ query/hash.

Cả hai chế độ dùng **OpenFreeMap Liberty**. Online lấy tài nguyên từ OpenFreeMap; offline dùng bản trích xuất thật gồm 157 tile đã lưu trong PMTiles, cùng style, sprite và glyph. Gói Đà Nẵng chứa 28 địa điểm và mạng đường OSM để tính tuyến, khoảng 19 MiB. Không chuyển sang MapTiler hoặc raster OpenStreetMap.

Bản đồ công khai ở cả hai chế độ; đăng nhập được yêu cầu khi gửi đóng góp/đánh giá hoặc mở hồ sơ/quản trị. Chỉ có kết nối mạng chưa đủ để dùng API: cần cấu hình backend theo hướng dẫn.

## Demo offline trên web

```bash
npm run build
npm run preview -- --port 4173
```

Mở `/map`, chờ gói sẵn sàng rồi ngắt mạng hoặc bật **Giả lập Offline** trong **Dữ liệu**. Web cần lần chuẩn bị đầu online và HTTPS/localhost để mở lại offline.

## Demo Android

```bash
npm run mobile:sync:offline
cd android
./gradlew assembleDebug
```

Windows dùng `gradlew.bat assembleDebug`. Bản demo này không có URL API và tự sử dụng dữ liệu cục bộ; mở lần đầu ở chế độ máy bay được. Muốn demo online và tự chuyển offline trong một APK, cấu hình URL API và dùng `mobile:sync:dev`.

Xem [mobile](MapAI_FE-feature-map-api/MOBILE.md), [offline/OpenFreeMap](MapAI_FE-feature-map-api/docs/OFFLINE.md), [kiến trúc 3 lớp](ARCHITECTURE.md) và [backend/xác thực](MapAI_BE-main/AUTH_INTEGRATION.md).
