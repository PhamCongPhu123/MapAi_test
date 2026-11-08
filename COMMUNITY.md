# Địa điểm cộng đồng và đánh giá MapAI

Tính năng dùng chung cho website và ứng dụng Capacitor. Địa điểm do người dùng thêm được lưu trong PostgreSQL của MapAI, không sửa trực tiếp dữ liệu OpenStreetMap.

## Cách sử dụng

1. Người dùng đăng nhập, mở **Bản đồ → + Thêm địa điểm**.
2. Điền tên, danh mục, địa chỉ, mô tả nếu có. Chọn **Dùng vị trí hiện tại**, nhập tọa độ hoặc **Chọn trên bản đồ** rồi kéo bản đồ để đặt ghim.
3. Chọn **Gửi địa điểm chờ duyệt**. Địa điểm ở trạng thái chờ duyệt, chưa xuất hiện công khai.
4. Người gửi xem trạng thái tại **Đóng góp của tôi**. Nếu bị từ chối, lý do được hiển thị tại đây; người dùng có thể kiểm tra thông tin và gửi lại một đóng góp mới.
5. Quản trị viên vào **Admin → Duyệt địa điểm**, xem thông tin/vị trí, chọn duyệt hoặc từ chối. Từ chối bắt buộc có lý do. Một quyết định đã xử lý không bị ghi đè bởi quyết định đến sau.
6. Địa điểm đã duyệt xuất hiện bằng chấm tím trong lớp MapAI. Mở lại bản đồ hoặc bấm **Làm mới** để tải các địa điểm vừa được duyệt. Tìm kiếm cũng gồm địa điểm trong dữ liệu MapAI, ngay cả khi nguồn tìm kiếm bên ngoài không có kết quả.
7. Chạm địa điểm hoặc chọn từ tìm kiếm/Khám phá để mở chi tiết. Trong **Đánh giá cộng đồng MapAI**, chọn 1–5 sao và viết nhận xét nếu muốn. Người dùng có thể sửa hoặc xóa đánh giá của mình.

Nếu địa điểm trên bản đồ nền chưa có bản ghi MapAI, mở chi tiết sẽ gợi ý gửi địa điểm để duyệt trước. Đánh giá chỉ được ghi cho các địa điểm đã có trong MapAI và đã duyệt.

## Quy tắc dữ liệu

- Mỗi tài khoản có tối đa một đánh giá trên mỗi địa điểm, được ràng buộc bằng unique index trong PostgreSQL. Chỉnh sửa cập nhật bản cũ, không làm tăng số lượt đánh giá.
- Backend lấy danh tính từ JWT đã xác thực, không tin `userId`, `status`, điểm hoặc số lượt đánh giá do client gửi kèm yêu cầu đóng góp.
- Chỉ admin được duyệt. Người khác không xem được đóng góp đang chờ hoặc bị từ chối qua API địa điểm/tìm kiếm; người gửi chỉ xem được danh sách của mình.
- Điểm cộng đồng được tính từ các đánh giá hiện có. Điểm/lượt đánh giá nhập từ nguồn cũ được giữ riêng, không bị trộn hoặc ghi đè. Trang chi tiết ghi rõ nguồn; Khám phá ưu tiên điểm cộng đồng nếu đã có đánh giá.
- Nhận xét tối đa 2.000 ký tự; lý do duyệt/từ chối tối đa 500 ký tự. Kiểm tra tên, danh mục, địa chỉ và khoảng tọa độ ở server.
- Kiểm tra trùng tên không phân biệt hoa/thường và tọa độ gần nhau trước khi nhận đóng góp. Admin vẫn cần kiểm tra trùng thực tế khi duyệt.
- Không thêm ảnh giả hoặc giờ mở cửa giả cho địa điểm mới. Luồng này chưa hỗ trợ đính kèm ảnh hoặc chỉnh sửa thông tin của địa điểm đã duyệt.

## Cập nhật backend và cơ sở dữ liệu

Cần .NET 9 và PostgreSQL. Từ thư mục `MapAI_BE-main/`, cấu hình kết nối như backend hiện có qua `ConnectionStrings__DefaultConnection` hoặc cấu hình cục bộ, rồi chạy:

```bash
dotnet tool restore
dotnet ef database update --project src/MapAI.Domain --startup-project src/MapAI.API
dotnet run --project src/MapAI.API --launch-profile http --urls http://0.0.0.0:5028
```

Migration `AddCommunityPlacesAndReviews` bổ sung trạng thái duyệt và người gửi cho địa điểm, tạo bảng `LocationReviews`, các khóa ngoại, unique index và ràng buộc số sao. Địa điểm cũ mặc định được duyệt, dữ liệu cũ được giữ nguyên. API không tự chạy migration khi khởi động.

Lệnh trên giả định database đang được quản lý bằng lịch sử EF migrations của repo. Nếu database được tạo thủ công ngoài EF và không có lịch sử tương ứng, cần đối chiếu/baseline schema trước, không chạy lại migration tạo bảng ban đầu lên các bảng đã tồn tại. Việc kiểm thử trong cloud chỉ áp dụng migration vào database thử nghiệm cục bộ; chưa cập nhật database Supabase thực tế của bạn.

Frontend: `npm ci`, sau đó chạy web như thường lệ hoặc làm theo [MOBILE.md](MapAI_FE-feature-map-api/MOBILE.md) để sync và build Android. Bản frontend mới cần backend và schema mới để dùng hai chức năng này.

## API mới

Tất cả đường dẫn dưới đây có tiền tố `/api/v1/location`.

| Method | Đường dẫn | Quyền |
| --- | --- | --- |
| POST | `/contributions` | Đã đăng nhập |
| GET | `/contributions/mine?page=1&pageSize=10` | Đóng góp của chính người đăng nhập |
| GET | `/contributions/pending?page=1&pageSize=10` | Admin |
| PUT | `/contributions/{id}/moderation` | Admin, body `{ "status": 0 hoặc 2, "note": "..." }` |
| GET | `/{id}/reviews?page=1&pageSize=10` | Công khai; có `myReview` nếu xác thực được người dùng |
| PUT | `/{id}/reviews/me` | Đã đăng nhập, body `{ "rating": 1..5, "comment": "..." }` |
| DELETE | `/{id}/reviews/me` | Chỉ xóa đánh giá của người đăng nhập |

Trạng thái: `0 = đã duyệt`, `1 = chờ duyệt`, `2 = từ chối`. Page size từ 1 đến 50. API công khai địa điểm hiện có đã được lọc chỉ còn địa điểm được duyệt; phản hồi thêm `communityRating`, `communityReviewCount`, `isUserContribution`.

## Kiểm thử

Frontend, từ `MapAI_FE-feature-map-api/`:

```bash
npm run lint
npm run build
npx playwright install chromium
npm run test:mobile:e2e
```

Kiểm tra UI dùng API/bản đồ giả lập để kiểm tra gửi đóng góp, GPS/chọn ghim, trạng thái chờ duyệt, tìm kiếm, đánh giá và thao tác admin trên điện thoại/desktop.

Kiểm tra HTTP backend thực, JWT thực và migrations trên PostgreSQL thực, từ `MapAI_BE-main/`:

```bash
# PostgreSQL 15+ có ICU; tài khoản local có quyền CREATE DATABASE.
MAPAI_TEST_CONNECTION='Host=127.0.0.1;Port=5432;Database=postgres;Username=YOUR_LOCAL_TEST_USER' dotnet run --project tests/MapAI.CommunityTests
```

Trên PowerShell, gán `$env:MAPAI_TEST_CONNECTION` trước rồi chạy `dotnet run --project tests/MapAI.CommunityTests`. Chỉ đưa thông tin kết nối vào biến môi trường cục bộ, không ghi mật khẩu vào mã nguồn.

Runner chỉ nhận host loopback, tạo một database `mapai_community_<GUID>` riêng, áp dụng migrations, seed tài khoản giả, chạy API con và xóa database do nó tạo khi kết thúc. Không dùng database ứng dụng làm test fixture. Các kiểm tra bao gồm: xác thực/phân quyền, không lộ địa điểm chờ duyệt, chống giả mạo người gửi, trùng tên tiếng Việt, duyệt/từ chối, sửa/xóa đánh giá, giới hạn dữ liệu, tổng hợp điểm, xử lý đồng thời và giữ nguyên điểm nguồn cũ.
