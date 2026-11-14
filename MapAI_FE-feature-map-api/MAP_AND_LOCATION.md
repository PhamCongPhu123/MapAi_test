# Bản đồ và định vị MapAI

## Một bản đồ OpenFreeMap cho cả hai chế độ

Màn hình **`/map`** dùng MapLibre và **OpenFreeMap Liberty**, không cần API key. Có mạng: tải tile/font/sprite OpenFreeMap và dùng các chức năng online. Mất mạng: đọc bản trích OpenFreeMap trong PMTiles đã lưu, font/sprite cục bộ và các chức năng của gói Đà Nẵng. Cùng canvas, định nghĩa layer, thanh công cụ, chi tiết, chỉ đường và trợ lý được giữ qua chuyển mạng. `/offline` và `/map/online` chuyển về `/map`.

Lớp nền có đường phố, nhãn và công trình từ OpenStreetMap. Tâm khởi tạo là Đà Nẵng `[108.22, 16.06]`. Gói offline giới hạn vùng `[108.14, 15.97, 108.33, 16.16]`, có 157 tile zoom 0–14, camera từ zoom 9 và cho phép overzoom. Toàn gói khoảng 19 MB; xem [phạm vi và cách demo offline](docs/OFFLINE.md).

Khi OpenFreeMap lỗi hoặc chưa nhận được tile sau 15 giây, ứng dụng hiện cảnh báo và nút **Thử tải lại bản đồ**. Nút này tải lại cùng nguồn OpenFreeMap; không chuyển nhà cung cấp. Camera, marker GPS/địa điểm và tuyến được giữ khi áp dụng lại style. Ô **Nguồn bản đồ** luôn hiển thị OpenFreeMap. Chế độ 3D thay đổi góc nhìn của bản đồ.

Môi trường chạy cần truy cập `tiles.openfreemap.org` và `assets.openfreemap.com` khi online hoặc lúc tạo gói. PWA cần mở online một lần và chờ dữ liệu/giao diện sẵn sàng; ứng dụng Capacitor đóng gói sẵn tài sản để mở lần đầu không có mạng.

## Tọa độ địa điểm

- API dùng `latitude` (vĩ độ) và `longitude` (kinh độ).
- GeoJSON/MapLibre dùng `[longitude, latitude]`, ví dụ Cầu Rồng: `[108.2275, 16.0612]`.
- Ứng dụng kiểm tra giới hạn tọa độ và bỏ các điểm không hợp lệ thay vì để chúng làm hỏng cả lớp địa điểm. Không tự hoán đổi tọa độ hoặc dịch các địa điểm trong database theo đường bờ biển của bản demo.
- Khung bản đồ và chat nhận kích thước ban đầu ngay khi dựng, tránh thay đổi chiều rộng lúc camera đang bay đến địa điểm làm lệch tâm. Chọn POI dùng tọa độ của feature điểm, thay vì tọa độ con trỏ nằm lệch cạnh nhãn.
- Hội thoại AI chỉ cuộn trong khung tin nhắn, không cuộn toàn trang đến khung chat đang ẩn dưới màn hình. Bản đồ và thẻ địa điểm giữ trong viewport khi mở trên điện thoại hoặc xoay màn hình.

Nếu một địa điểm cụ thể vẫn sai sau khi bản đồ đường phố đã tải, kiểm tra riêng `latitude`/`longitude` của địa điểm đó ở database/admin. Bản sửa không thay hàng loạt dữ liệu địa điểm hoặc tạo migration.

## Định vị trên máy tính Windows

Trình duyệt thường dùng dịch vụ vị trí của Windows/Wi-Fi; kết quả không nhất thiết chính xác như GPS điện thoại.

1. Windows 11: **Settings → Privacy & security → Location**. Bật **Location services** và **Let desktop apps access your location** nếu có.
2. Mở `http://localhost:5173` hoặc website HTTPS. Nhấn biểu tượng bên trái địa chỉ → quyền trang web → **Location: Allow**, rồi tải lại trang.
3. Bấm **Vị trí của tôi** trên bản đồ. Nút hiển thị đang chờ và không gửi nhiều yêu cầu cùng lúc. Bấm lại sau khi có vị trí sẽ lấy vị trí mới.
4. Nếu định vị chính xác cao bị timeout/không khả dụng, ứng dụng thử lại bằng chế độ định vị mạng. Cả hai lần đều yêu cầu vị trí mới (`maximumAge: 0`). Nếu vẫn lỗi, cảnh báo nêu cách bật quyền/dịch vụ và có nút thử lại; không dùng tọa độ giả hoặc tiếp tục hiển thị vị trí cũ như kết quả mới.

Không thể bật quyền vị trí của Windows/trình duyệt từ mã JavaScript khi người dùng/hệ điều hành chặn nó. Trên trình duyệt điện thoại, HTTP qua IP Wi-Fi không phải secure context; dùng HTTPS hoặc app Capacitor. `localhost` là ngoại lệ được trình duyệt hỗ trợ.

## Android/iOS

App native dùng Capacitor Geolocation, kiểm tra và xin quyền khi người dùng bấm định vị. Android cho phép quyền vị trí gần đúng: app dùng chế độ cân bằng khi chỉ có coarse permission. Thiết bị phải bật Location/GPS; Android Emulator cần đặt vị trí trong **Extended controls → Location**. Sau thay đổi frontend, chạy `npm run mobile:sync:dev` rồi build/chạy lại app debug.

## Kiểm thử

```powershell
npm run test:map-display
npm run test:mobile
npm run test:mobile:e2e
```

Kiểm thử UI dùng tile vector từ gói OpenFreeMap và các vị trí cố định để kiểm tra renderer, thứ tự tọa độ, permission/timeout, thông báo lỗi, thử lại cùng nguồn và phục hồi địa điểm/tuyến. Kiểm thử offline còn kiểm tra cùng canvas qua chuyển mạng, tải lại và bản mobile khởi động không có Internet. Fixture không đo độ chính xác GPS trên thiết bị thật hoặc tính sẵn sàng của dịch vụ ngoài Internet.
