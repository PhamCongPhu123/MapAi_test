# Bản đồ và định vị MapAI

## Bản đồ đường phố

Không cần MapTiler key để xem đường phố, tên đường và các công trình được OpenStreetMap ghi nhận. Khi `VITE_MAPTILER_KEY` trống hoặc là placeholder, ứng dụng dùng raster tiles `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, giữ attribution OpenStreetMap. Bản đồ demo MapLibre trước đây chỉ chứa ranh giới quốc gia với đường bờ biển đơn giản hóa; phóng to Đà Nẵng sẽ không có đường phố và có thể làm các điểm trên đất liền trông như ở ngoài biển.

Nếu cấu hình MapTiler key hợp lệ, ứng dụng dùng streets-v2. Khi lớp này lỗi, ứng dụng chuyển sang raster OpenStreetMap. Thay style hoặc thử tải lại phải khôi phục lớp địa điểm MapAI và tuyến đường đang có. Lỗi tải tile có cảnh báo và nút thử lại, không hiển thị bản đồ demo như thể đã tải bản đồ đường phố thành công.

Raster hiển thị dữ liệu công trình ở dạng 2D; chế độ 3D lúc này thay đổi góc camera. Địa hình 3D của MapTiler cần key/quyền sử dụng phù hợp. Cả hai nguồn đều cần Internet; mức độ chi tiết phụ thuộc dữ liệu nhà cung cấp ở từng vùng. Không tải trước hàng loạt hay đóng gói các tile OpenStreetMap để dùng offline.

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

Kiểm thử UI mặc định dùng raster tile trung tính làm fixture và các vị trí định sẵn để kiểm tra renderer, thứ tự tọa độ, permission/timeout, retry và khôi phục lớp địa điểm. Fixture không đại diện cho dữ liệu bản đồ ngoài Internet hoặc tín hiệu GPS của máy thật.

Kiểm tra thêm nhánh lỗi MapTiler (key giả chỉ dùng trong kiểm thử):

```powershell
$env:MAPAI_TEST_MAPTILER_KEY = "test-only"
npm run test:mobile:e2e -- tests/e2e/map-display.spec.js --grep "MapTiler failure"
Remove-Item Env:MAPAI_TEST_MAPTILER_KEY
```

Trong môi trường cloud hiện tại, kết nối đến `tile.openstreetmap.org` bị proxy chặn (`CONNECT 403`), nên chưa xác nhận được ảnh tile trực tiếp từ nhà cung cấp tại đây. Các bài kiểm thử dùng fixture, không kiểm chứng được quyền định vị hay độ chính xác thực tế trên Windows của người dùng.
