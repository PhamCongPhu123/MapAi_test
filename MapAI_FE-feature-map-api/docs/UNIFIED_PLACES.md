# Tìm kiếm và ChatAI đa nguồn MapAI + OpenStreetMap

Áp dụng chung cho Web/PWA và ứng dụng Capacitor, giữ nguyên bản đồ OpenFreeMap Liberty ở cả hai chế độ. Phạm vi lazy sync theo yêu cầu: **chỉ lưu yêu thích hoặc gửi đánh giá** mới tạo tham chiếu OSM trong database. Xem chi tiết, tìm kiếm, hỏi ChatAI và chỉ đường chỉ đọc/lưu đệm trên thiết bị.

## Luồng dữ liệu và kiến trúc 3 lớp

- **Presentation:** thanh tìm kiếm với chip Tất cả / Gợi ý MapAI / Bản đồ mở OSM; huy hiệu nguồn, biểu tượng tiện ích; thẻ trong chat có nút mở bản đồ và chỉ đường; cùng bảng chi tiết/yêu thích/đánh giá.
- **Application/Domain:** `UnifiedPlace`, chuẩn hóa tiếng Việt, định danh, gộp nguồn; `UnifiedPlaceService`, `AccountSyncService` và các use case tìm kiếm/ChatAI. Không phụ thuộc EF, HTTP, IndexedDB hay React.
- **Infrastructure:** PostgreSQL/EF, adapter Photon/Overpass/Nominatim, bộ nhớ đệm công khai, IndexedDB, gói OpenFreeMap và đồ thị A*.

`GET /api/v1/map/unified-search?q=...` truy vấn MapAI và OSM **song song**, trả `places`, `sourceStatus`, `warnings`. Nếu một nguồn lỗi, vẫn trả nguồn còn lại với cảnh báo; cả hai lỗi trả 503. Các lệnh ChatAI tìm địa điểm đi qua cùng dịch vụ. Lệnh tiện ích rõ ràng không cần gọi Gemini; các câu hỏi kiến thức vẫn dùng Gemini. Các lệnh “gần nhất” tiếp tục yêu cầu GPS mới. Ngoại tuyến, tiện ích gần bạn được lọc trong bán kính 5 km; không dùng vị trí cũ từ lịch sử chat để khẳng định nơi gần nhất.

Mỗi địa điểm có `canonicalId` (`mapai:<id>` hoặc `osm:<node|way|relation>:<id>`), `sourceType`, `normalizedName`, `categoryMapping`, tọa độ và metadata nguồn. `mapaiId` là liên kết tới UUID nội bộ, không thay thế canonical OSM. Khóa yêu thích `seed:*` cũ được giữ tương thích. Hai nguồn có tên tương đồng **>80%** và khoảng cách **<50 m** được gộp; dùng thông tin MapAI và tọa độ OSM. Huy hiệu xanh “Đã đồng bộ” chỉ xuất hiện khi có liên kết database được máy chủ xác nhận.

Photon phục vụ tìm tên; Overpass phục vụ danh mục bằng bộ lọc cố định trong vùng Đà Nẵng. Cả hai bổ sung nhau cho tìm tiện ích có tên. Nominatim chỉ lookup ID khi người dùng chủ động lưu/đánh giá, giới hạn một yêu cầu/giây và có cache; không dùng cho autocomplete. Không đưa câu người dùng vào mã Overpass.

## Lazy sync và chống trùng

Yêu thích/đánh giá được ghi IndexedDB trước, gắn tài khoản và UUID thao tác. Khi có mạng, backend kiểm tra định danh OSM từ dữ liệu nhà cung cấp, tìm bản tham chiếu đã có hoặc liên kết địa điểm MapAI tương ứng. Không tin tên/tọa độ/UUID MapAI do client tự gửi để xuất bản dữ liệu công khai.

`OsmPlaceReferences` có khóa canonical và ràng buộc duy nhất loại/ID OSM. Khóa transaction PostgreSQL ngăn hai tài khoản tạo hai bản tham chiếu đồng thời. Ghi tham chiếu, yêu thích/đánh giá và biên nhận đồng bộ dùng cùng transaction. Retry giữ nguyên UUID, trả cùng kết quả. Địa điểm đã bị ẩn không được tạo lại qua OSM. Xóa yêu thích không tạo bản tham chiếu mới. Nội dung yêu thích và đánh giá vẫn thuộc từng tài khoản.

## Gói ngoại tuyến và lưu đệm

Gói `2026.11.16.1` có **1.486** tiện ích OSM thật, trong bounds `[108.14, 15.97, 108.33, 16.16]`:

| Nhóm | Số điểm |
| --- | ---: |
| Xe buýt/nền đón khách | 642 |
| Trường học | 201 |
| Đại học/cao đẳng | 32 |
| Bệnh viện | 39 |
| Cơ sở y tế | 7 |
| Nhà thuốc | 75 |
| Cây xăng | 76 |
| ATM | 329 |
| Ngân hàng | 85 |

Nguồn, ngày trích xuất và giấy phép ODbL nằm trong `public/offline/osm-pois.json` và `OSM_POIS_LICENSE.txt`. Các điểm không có tên giữ nhãn phân loại; không tự đặt tên địa điểm. Tọa độ way/relation là tâm bounding box. Gói có các điểm tên Việt Hàn theo dữ liệu gốc OSM, gồm `osm:node:11363578173` (Viet Han (to Hoi An)).

IndexedDB v3 thêm `osmPois` (gói) và `osmCache` (kết quả công khai mới tra cứu từ ô tìm kiếm/ChatAI). Cache kết quả giữ tối đa 1.000 điểm trong 7 ngày; yêu thích có snapshot riêng, không mất theo TTL. Cache không bao gồm bản đồ/ảnh đầy đủ của mọi kết quả. Cập nhật gói kiểm SHA-256 rồi thay nguyên tử, giữ gói cũ nếu thất bại. Bản cũ chưa có chỉ mục sẽ nâng cấp khi có mạng hoặc có tài nguyên đóng gói trong app.

**Giới hạn:** tìm thấy điểm trong cache không bảo đảm có đường A*. Định tuyến offline vẫn cần gói đường trong bounds đã tải, chỉ hỗ trợ đi bộ và xe máy ước tính. Điểm ngoài vùng được xem thông tin; không giả vờ có tuyến đường. Offline ChatAI là bộ xử lý cục bộ, không chạy Gemini. Bản đồ luôn lấy từ OpenFreeMap; dữ liệu POI OSM là lớp tìm kiếm riêng.

## Cập nhật code và database trên Windows

Từ thư mục repository đang dùng (không dùng bản frontend sao chép ở ngoài `MapAi_test`):

```powershell
cd D:\Da_nen_tang_fimalproject\MapAi_test
git switch work-unified
git pull --ff-only origin work-unified
cd .\MapAI_BE-main
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet tool restore
dotnet tool run dotnet-ef database update --project .\src\MapAI.Infrastructure --startup-project .\src\MapAI.API
dotnet run --project .\src\MapAI.API --launch-profile http --urls http://0.0.0.0:5028
```

Dùng database/chuỗi kết nối hiện có; **không xóa hoặc tạo lại database**. Migration mới `20261116082546_AddUnifiedOsmPlaces` thêm bảng tham chiếu và chỉ mục tên không dấu, tự backfill dữ liệu cũ, không yêu cầu cài extension. Phải chạy lệnh trong `MapAI_BE-main` để .NET tìm thấy local tool manifest. Cập nhật cả backend lẫn frontend.

Trong terminal khác:

```powershell
cd D:\Da_nen_tang_fimalproject\MapAi_test\MapAI_FE-feature-map-api
npm ci
npm run dev -- --port 5175 --strictPort
```

Kiểm tra offline web bằng bản production để có service worker:

```powershell
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

APK: cấu hình API HTTPS trong `.env.mobile.local`, rồi `npm run mobile:sync` và build Android theo [MOBILE.md](../MOBILE.md). `npm run mobile:sync:offline` tạo bản demo gói offline không có backend; AI Gemini và đồng bộ tài khoản cần bản có API. Không đưa khóa Gemini/SMTP vào frontend/APK.

## Demo và kiểm chứng

1. Online: tìm `bến xe buýt Việt Hàn`; lọc nguồn; mở chi tiết. Database chưa phát sinh tham chiếu nếu chưa lưu/đánh giá.
2. Lưu yêu thích hoặc gửi đánh giá sau khi đăng nhập. Khi máy chủ xác nhận, huy hiệu đổi “OSM · Đã đồng bộ”.
3. Đợi trạng thái gói Đà Nẵng sẵn sàng, ngắt mạng và tải lại ứng dụng. Tìm `ben xe buyt viet han` hoặc một điểm vừa tra cứu.
4. Chat: `Chỉ đường đến bến xe buýt Việt Hàn`. Chọn điểm xuất phát trong gói để tính A*; đối chiếu phạm vi tuyến và thông báo ước tính.
5. Thêm yêu thích/đánh giá lúc offline, kết nối lại và kiểm tra một tham chiếu, một yêu thích/đánh giá cho cùng thao tác.

```sh
npm test
npm run lint
npm run build
npm run test:e2e:places
npm run test:e2e:sync
npm run test:e2e:offline
```

Backend: đặt `MAPAI_TEST_CONNECTION` trỏ PostgreSQL loopback có quyền tạo database tạm, chạy `dotnet run --project tests/MapAI.UnifiedPlacesTests` trong `MapAI_BE-main`. Test tự tạo/xóa database riêng, kiểm migration/backfill, API hợp nhất, ChatAI không gọi Gemini, lazy favorite/review, retry, hai tài khoản đồng thời và dữ liệu đã bị ẩn.

Tạo lại chỉ mục: `npm run offline:pois` (cần Internet và curl); ưu tiên Overpass, dự phòng OSM Map API với 16 ô nhỏ có giới hạn. Có thể truyền `MAPAI_OSM_POI_SOURCE` là đường dẫn một extract JSON gốc. Bật `MAPAI_OSM_REFRESH=1` để tải lại thay vì dùng cache trích xuất trong thư mục tạm. Không cần chạy khi cài app; file gói đã có trong repository. Khi dựng lại bản đồ OpenFreeMap, script giữ metadata chỉ mục OSM và tính lại hash tài nguyên.
