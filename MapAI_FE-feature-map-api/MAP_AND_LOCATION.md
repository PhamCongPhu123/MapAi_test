# Bản đồ và định vị MapAI

## Bản đồ đường phố

Ứng dụng mặc định dùng **OpenFreeMap Liberty** (`https://tiles.openfreemap.org/styles/liberty`), là bản đồ vector từ dữ liệu OpenStreetMap, không cần đăng ký hoặc API key. Nguồn này cung cấp đường phố, nhãn và dữ liệu công trình mà OpenStreetMap đã ghi nhận. Tâm khởi tạo vẫn ở Đà Nẵng `[108.22, 16.06]`.

Khi một nguồn bị lỗi hoặc không nhận được tile đầu tiên sau 12 giây, ứng dụng tự thử nguồn tiếp theo:

1. MapTiler streets-v2, nếu đã cấu hình key công khai hợp lệ.
2. OpenFreeMap Liberty.
3. Raster **HOT / OpenStreetMap France**: `https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png`.
4. Raster OpenStreetMap: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`.

Có Internet không bảo đảm mọi máy chủ tile đều truy cập được. Lỗi 403, 429, kết nối, hoặc request treo của một nguồn không làm ứng dụng lặp vô hạn trên nguồn đó: mỗi nguồn chỉ được thử tự động một lần trong một chu kỳ. Nếu tất cả đều lỗi, thông báo liệt kê tên nguồn/mã HTTP khi có, không đổ lỗi chung rằng máy mất Internet. Lỗi đến muộn từ nguồn đã bỏ qua không được làm hỏng nguồn mới.

Ô **Nguồn bản đồ** ở góc dưới phải cho phép đổi nguồn trực tiếp. Khi gặp lỗi, ô này chuyển vào hộp thông báo để vẫn thao tác được. Nút **Thử tải lại bản đồ** bắt đầu chu kỳ thử lại từ nguồn đang chọn. Camera, các marker GPS/địa điểm, điểm xuất phát/đích đến và tuyến đường được giữ khi đổi lớp nền.

Raster hiển thị công trình ở dạng 2D; chế độ 3D lúc này thay đổi góc camera. Địa hình MapTiler chỉ được thêm khi đang dùng nguồn MapTiler có key, không gọi nhầm endpoint địa hình trả phí khi đã chuyển sang OpenFreeMap/raster. Tất cả nguồn đều cần Internet và giữ attribution phù hợp. Không tải trước hàng loạt hoặc đóng gói các tile OpenStreetMap để dùng offline.

Nguồn demo MapLibre trước đây chỉ có ranh giới quốc gia đơn giản hóa, không đủ dữ liệu đường phố ở Đà Nẵng. Ứng dụng không dùng nguồn demo đó.

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

Kiểm thử UI dùng style/tile trung tính làm fixture và các vị trí định sẵn để kiểm tra renderer, thứ tự tọa độ, permission/timeout, chuyển nguồn, mã lỗi, retry và khôi phục lớp địa điểm/tuyến đường. Fixture không đại diện cho dữ liệu bản đồ ngoài Internet hoặc tín hiệu GPS của máy thật.

Kiểm tra thêm nhánh lỗi MapTiler (key giả chỉ dùng trong kiểm thử):

```powershell
$env:MAPAI_TEST_MAPTILER_KEY = "test-only"
npm run test:mobile:e2e -- tests/e2e/map-display.spec.js --grep "MapTiler failure"
Remove-Item Env:MAPAI_TEST_MAPTILER_KEY
```

Môi trường cloud hiện tại chặn các máy chủ bản đồ ngoài danh sách cho phép (`CONNECT 403`), nên các bài kiểm thử dùng fixture. Trong phiên xử lý lỗi, người dùng đã xác nhận trên Windows rằng OpenFreeMap trả được style JSON và OpenStreetMap France trả được ảnh đường phố. Các bài kiểm thử không đo được độ chính xác GPS thực tế của máy người dùng.
