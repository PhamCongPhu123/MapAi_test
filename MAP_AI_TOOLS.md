# AI điều khiển bản đồ

Các chức năng mới được nối từ `MapController` → `MapService` → hành động AI → frontend MapLibre, dùng chung cho web và Capacitor. Không cần migration mới cho thay đổi này. Nguồn địa điểm MapAI vẫn cần schema của [tính năng cộng đồng](COMMUNITY.md).

## Câu lệnh có thể thử trong chat

- **Tìm cây xăng gần nhất**.
- **Tôi muốn tìm cây xăng gần nhất trong bán kính 2 km**.
- **Chỉ đường đến cây xăng gần nhất đi bộ**.
- **ATM gần tôi**, **nhà thuốc gần nhất**, **bãi đỗ xe gần nhất**, **trạm sạc gần nhất**.
- **Tìm quán cafe quanh Cầu Rồng trong bán kính 2 km**.
- Sau khi tìm được một kết quả hoặc chọn thẻ kết quả: **Chỉ đường đến đó**.
- **Phóng to bản đồ**, **thu nhỏ**, **về vị trí của tôi**, **quay về hướng Bắc**.
- **Xóa kết quả tìm kiếm**, **xóa tuyến đường**.

Lệnh ngắn, rõ ràng có router cục bộ nên hoạt động mà không cần gọi Gemini. Câu phức tạp vẫn dùng Gemini để phân loại ý định và trích xuất tham số. Bản đồ được điều khiển bằng các action có tên và tham số xác định, không chạy JavaScript do mô hình sinh ra.

## API mới trong `MapController.cs`

Tiền tố `/api/v1/map`:

| Hàm | HTTP | Chức năng |
| --- | --- | --- |
| `Categories` | `GET /categories` | Các loại địa điểm được hỗ trợ |
| `FindPlaces` | `GET /places?lat=...&lng=...&category=fuel&radius=5000&limit=10` | Tìm và xếp hạng các địa điểm trong bán kính |
| `FindNearest` | `GET /nearest?lat=...&lng=...&category=fuel&radius=5000` | Lấy một kết quả gần nhất trong dữ liệu tìm được |
| `DirectionToNearest` | `POST /nearest/direction` | Tìm kết quả gần nhất rồi tính tuyến đến kết quả đó |

Ví dụ gọi trực tiếp:

```http
GET /api/v1/map/nearest?lat=16.06&lng=108.22&category=fuel&radius=5000
```

```json
{
  "lat": 16.06,
  "lng": 108.22,
  "category": "fuel",
  "radius": 5000,
  "mode": "foot"
}
```

Body trên dành cho `POST /api/v1/map/nearest/direction`. `mode` nhận `driving`, `bicycle`, `foot`. Bán kính từ 100–20.000 m, mặc định 5.000 m; giới hạn danh sách từ 1–50. Thiếu tọa độ hoặc tham số không hợp lệ trả 400.

Danh mục: `fuel`, `atm`, `pharmacy`, `hospital`, `cafe`, `restaurant`, `parking`, `charging_station`. Backend cũng hiểu một số tên Việt/Anh như “cây xăng”, “gas station”. Form đóng góp địa điểm đã có thêm các danh mục tiện ích này.

## Cách xác định gần nhất

1. Lấy địa điểm MapAI đã duyệt, cộng với OpenStreetMap qua Overpass.
2. Tra đúng tag của loại địa điểm, ví dụ cây xăng là `amenity=fuel`, trạm sạc là `amenity=charging_station`.
3. Tính khoảng cách Haversine từ tâm tìm kiếm, lọc đúng bán kính, gộp bản ghi trùng rồi sắp tăng dần. Chỉ giới hạn số kết quả sau khi sắp xếp. Giữ ID MapAI để mở được chi tiết và đánh giá của địa điểm nội bộ.
4. Khi yêu cầu chỉ đường, tính tuyến OSRM đến địa điểm đã chọn. Frontend dùng luôn tuyến trả về và đúng phương tiện, tránh tự tính lại bằng chế độ khác.

Phản hồi có `distanceBasis: "straight_line"`, `distanceMeters`, `source`, `locationId` nếu thuộc MapAI và `warnings`. Khoảng cách hiển thị là đường thẳng; chiều dài và thời gian đi theo tuyến nằm trong dữ liệu route. Kết quả phụ thuộc dữ liệu hiện có và bán kính tìm kiếm, không bảo đảm liệt kê mọi cơ sở ngoài thực tế.

Nếu một nguồn bị lỗi, trả các kết quả từ nguồn còn lại cùng cảnh báo dữ liệu chưa đầy đủ. Nếu cả hai nguồn lỗi, trả 503. Overpass timeout hoặc phản hồi không đầy đủ được xử lý như lỗi nguồn, tránh báo nhầm không có địa điểm.

## Vị trí và ngữ cảnh chat

- Tìm gần người dùng luôn lấy vị trí mới qua plugin native hoặc geolocation trình duyệt. Khi bị từ chối, không lấy tọa độ cũ trong session hay mặc định tâm Đà Nẵng làm vị trí của người dùng.
- Tìm quanh một địa điểm có tên dùng tọa độ geocoder trả về. Nếu không xác định được tên trung tâm thì yêu cầu làm rõ.
- “Chỉ đường đến đó” dùng kết quả thật vừa được chọn qua `selectedLocation` trong `AiRequest`. Nếu chưa có kết quả cụ thể, yêu cầu người dùng chọn trước.
- Lịch sử gửi lên backend dùng `{ "role": "model" hoặc "user", "text": "..." }`, tương ứng `ChatMessage`. Popup kết quả tìm kiếm mới dùng DOM/text để hiển thị tên địa điểm an toàn.

Các action mới: `NEAREST_SEARCH`, `SEARCH_POIS`, `ROUTE_TO_NEAREST`, `ZOOM_IN`, `ZOOM_OUT`, `LOCATE_USER`, `RESET_NORTH`, `CLEAR_RESULTS`, `CLEAR_ROUTE`. Giữ tương thích các action `FLY_TO`, `SET_DIRECTION`, `SWITCH_VIEW` hiện có.

## Cấu hình kết nối

Backend cần truy cập HTTPS đến `overpass-api.de`, `nominatim.openstreetmap.org`, `routing.openstreetmap.de`; các yêu cầu AI nâng cao cần `generativelanguage.googleapis.com` và `GeminiConfig:ApiKey`. Giữ API key trên backend, không đưa vào biến `VITE_*`.

Môi trường cloud hiện hạn chế các tên miền này. Các bài kiểm tra dùng provider/model giả lập; chưa kiểm thử trực tiếp kết quả Overpass, định tuyến OSRM và suy luận Gemini trên dịch vụ thật. Khi chạy backend trên máy cá nhân, kiểm tra kết nối các dịch vụ trên để dùng dữ liệu thật.

## Kiểm thử và thêm chức năng sau này

Từ `MapAI_BE-main/`:

```bash
dotnet run --project tests/MapAI.MapToolsTests
```

Runner kiểm tra xếp khoảng cách, bộ lọc đã duyệt, gộp trùng, giới hạn tọa độ/bán kính, lỗi nguồn, tuyến/phương tiện, router tiếng Việt, câu lệnh theo kết quả đã chọn và truy vấn Overpass. Không cần database hay API key cho runner này.

Từ `MapAI_FE-feature-map-api/`:

```bash
npm run test:map-actions
npm run test:mobile:e2e
npm run lint
npm run build
```

E2E kiểm tra GPS mới/từ chối quyền, tìm gần nhất, tìm quanh trung tâm khác, chỉ đường theo kết quả, mode đi bộ, cảnh báo thiếu dữ liệu và popup an toàn trên màn hình điện thoại/desktop. Xem `COMMUNITY.md` để chạy thêm bộ kiểm tra HTTP/PostgreSQL.

Để thêm một thao tác AI: bổ sung intent/schema trong `AiPrompt`, kiểu action trong `AiService`, handler có tham số được kiểm tra trong `executeMapAction.js`, rồi nối với API hoặc phương thức MapLibre tương ứng. Thêm danh mục POI mới trong `MapPlaceCategories`, whitelist frontend và kiểm tra đi kèm. Các lời gọi từ AI không thay thế bước kiểm tra dữ liệu ở API.
