# Đồng bộ dữ liệu MapAI giữa online và offline

Triển khai dựa trên tài liệu `mapai.md` do người dùng cung cấp. Website/PWA và Capacitor dùng chung luồng đồng bộ, không đổi giao diện hoặc nhà cung cấp OpenFreeMap.

## Phân loại dữ liệu

| Dữ liệu | Cơ chế |
| --- | --- |
| Yêu thích | Hai chiều qua tài khoản: ghi thiết bị trước, đẩy thay đổi, kéo danh sách của tài khoản |
| Hồ sơ cơ bản | Máy chủ → cache định danh đã xác thực; không chỉnh sửa hồ sơ khi offline |
| Địa điểm công khai | Máy chủ → cache công khai có phiên bản SHA-256; chỉ địa điểm được duyệt, không chứa thông tin người đóng góp |
| Đóng góp, ảnh và đánh giá | Bản nháp/hàng đợi bền vững theo tài khoản; tự gửi khi có mạng |
| Lịch sử, GPS, A*, tuyến gần nhất, dung lượng và giả lập | Cục bộ; lịch sử tối đa 50 mục |
| Quản trị, xác thực, Gemini | Online; không xếp hàng các quyết định quản trị hoặc yêu cầu Gemini |

Đồng bộ đi qua backend .NET và PostgreSQL hiện có. Nếu database được đặt tại Supabase, các bảng đồng bộ nằm trong PostgreSQL của Supabase. Không thêm hệ đăng nhập Supabase song song, không đưa service-role key vào ứng dụng.

## Backend: bước cần làm khi lấy code mới

Có migration mới `AddAccountSync`, tạo `AccountFavorites` và `SyncReceipts`. Không xóa hoặc tạo lại database đang dùng. Tại thư mục gốc repository, với chuỗi kết nối đúng database của bạn:

```powershell
dotnet tool restore --tool-manifest MapAI_BE-main/.config/dotnet-tools.json
dotnet ef database update --project MapAI_BE-main/src/MapAI.Infrastructure --startup-project MapAI_BE-main/src/MapAI.API
```

Khi dùng database cloud, đặt `ConnectionStrings__DefaultConnection` trong môi trường chạy lệnh migration. Backend triển khai phải chạy mã mới; chỉ cập nhật frontend sẽ không tạo được endpoint đồng bộ. Sau đó build lại APK với API HTTPS trong `.env.mobile.local`:

```powershell
cd MapAI_FE-feature-map-api
npm ci
npm run mobile:sync -- android
npm run android:open
```

Bản `mobile:sync:offline` không có backend URL, nên chỉ lưu cục bộ. Muốn trình diễn đồng bộ đa thiết bị phải cấu hình API, có tài khoản đã xác thực và dùng bản đầy đủ.

## Yêu thích và tài khoản

- Khách được lưu ngay trên máy; không bị ép đăng nhập. Đăng nhập thành công sẽ gộp các mục Khách còn được lưu vào tài khoản, rồi xóa phân vùng Khách đã chuyển. Không chuyển dữ liệu riêng của tài khoản khác.
- Mỗi tài khoản có phân vùng yêu thích, bản nháp, hàng đợi riêng. Đăng xuất không xóa các thay đổi chưa gửi của tài khoản; đăng nhập lại đúng tài khoản để gửi tiếp.
- Cache hồ sơ chỉ gồm ID, tên, avatar, vai trò và email. Cache cần token cùng ID, hết hạn chậm nhất sau 7 ngày và không vượt hạn access token; refresh token thành công cập nhật hạn cache. Cache là định danh offline, không cấp quyền truy cập API.
- Hết hạn cache khi offline: chuyển sang Khách. Các mục riêng của tài khoản vẫn được giữ tách biệt. Mục Khách mới được gộp ở lần đăng nhập hợp lệ tiếp theo.
- Đăng nhập, đổi mật khẩu, cấp quyền và kiểm duyệt vẫn do máy chủ quyết định. Mạng lỗi/HTTP 5xx không tự xóa token hoặc hàng đợi. Máy chủ từ chối phiên xác thực thì cần đăng nhập lại.
- Khóa địa điểm ổn định theo nguồn: `seed:<id>` cho gói có sẵn, `mapai:<id>` cho database và `osm:<id hoặc tọa độ+tên>` cho nguồn bên ngoài. Không dùng tên hiển thị làm khóa duy nhất.
- Snapshot riêng của địa điểm đã lưu cho phép xem tên/địa chỉ/mô tả khi offline, kể cả ngoài gói. Huy hiệu phân biệt **Sẵn sàng offline** và **Chỉ xem thông tin**. Xóa gói bản đồ không xóa snapshot yêu thích.

## Quy tắc chống mất dữ liệu

Ghi yêu thích và thao tác cần gửi trong cùng transaction IndexedDB. Một lần đổi trạng thái tạo một UUID mới. Khi gửi thành công, chỉ xóa hàng đợi nếu UUID vẫn khớp; xác nhận cũ không xóa thay đổi mới vừa thực hiện.

Bỏ lưu tạo tombstone và thời điểm gửi sớm nhất sau 4 giây. Snackbar **Hoàn tác** phục hồi trạng thái trước khi hết thời gian. Hạn chờ được lưu xuống database, không chỉ nằm trong timer, nên tải lại không làm mất yêu cầu xóa. Thao tác Khách chỉ tác động phân vùng Khách.

Máy chủ khóa theo tài khoản và ghi thay đổi cùng biên nhận UUID trong một transaction. Gửi lại cùng UUID/nội dung trả lại biên nhận trước đó; dùng cùng UUID cho nội dung khác trả 409. Đóng góp chỉ tạo một bản ghi chờ duyệt dù phản hồi mạng bị mất. Endpoint đóng góp online cũng hỗ trợ header `Idempotency-Key` để có thể gửi tiếp cùng thao tác qua hàng đợi.

Xung đột cùng địa điểm giữa hai thiết bị được giải quyết theo **thao tác được máy chủ chấp nhận sau cùng**, không dựa vào đồng hồ của điện thoại. Khi kéo dữ liệu, thay đổi cục bộ chưa được xác nhận luôn được giữ ưu tiên. Tombstone được gửi về để thiết bị khác không khôi phục nhầm mục đã bỏ lưu.

Ứng dụng gửi khi nối mạng, đăng nhập, trở lại foreground và kiểm tra định kỳ 30 giây khi đang mở. Lỗi tạm thời dùng thời gian chờ tăng dần, tối đa 5 phút; dữ liệu vẫn ở thiết bị. Hệ điều hành có thể dừng ứng dụng trong nền: khi mở lại, hàng đợi tiếp tục chạy. Không hứa chạy nền liên tục khi app đã bị đóng.

## Đóng góp và đánh giá

Đăng nhập online một lần trước khi soạn để xác định tài khoản. Đóng góp offline có thể chứa ảnh Blob trong IndexedDB; khi gửi, upload ảnh trước rồi lưu URL nhận được trước khi gửi nội dung. Retry sau khi mất phản hồi không upload lại ảnh đã được lưu URL.

Bản nháp đóng góp và đánh giá được lưu theo tài khoản. Sau khi bấm gửi lúc offline, nội dung chuyển vào hàng đợi, tồn tại qua tải lại/mở lại app. Các đóng góp vẫn phải được admin duyệt trên server; offline không được tự đánh dấu đã duyệt. Đánh giá cần ID địa điểm MapAI, không gửi đánh giá cho POI mẫu chưa tồn tại trên server.

Tab **Chờ gửi** trong **Đã lưu / Gần đây** hiển thị nội dung và lỗi. Lỗi 4xx cần xử lý được giữ lại, không tự gửi liên tục; có thể sửa nội dung bị từ chối, thử lại hoặc bỏ khỏi hàng đợi. Việc bỏ khỏi hàng đợi chỉ xóa yêu cầu trên máy, không thu hồi bản ghi mà máy chủ đã nhận trước khi mất phản hồi.

## Cập nhật dữ liệu công khai

`GET /api/v1/sync/catalog` trả phiên bản, SHA-256 và chuỗi JSON chứa snapshot công khai. Phiên bản là hash nội dung, nên duyệt/sửa/xóa địa điểm làm phiên bản thay đổi. Nếu gửi `?version=<hash>` còn hiện hành, server trả 204.

Client tính SHA-256 trên đúng chuỗi UTF-8, kiểm tra cấu trúc/tọa độ rồi thay cache trong transaction. Nội dung hỏng giữ nguyên cache cũ. Các địa điểm trong bounds được ghép vào nguồn tìm kiếm/bản đồ/trợ lý cục bộ. Địa điểm ngoài bounds không làm mở rộng giả phạm vi A* hay bản đồ đã tải.

Tự kiểm tra tối đa mỗi 15 phút khi nền tảng xác nhận **Wi-Fi**. Trình duyệt không báo loại kết nối đáng tin cậy sẽ không suy đoán Wi-Fi từ `effectiveType`; dùng **Dữ liệu → Cập nhật địa điểm cộng đồng** để tải thủ công, kể cả 4G/5G.

Đây là cập nhật gói **địa điểm công khai**. PMTiles OpenFreeMap, sprite, font và graph đường vẫn là gói nền được đóng gói/phát hành cùng ứng dụng, có manifest SHA-256 và cài nguyên tử như trước. Việc duyệt một quán không tự tạo lại tile hoặc graph đường. Xóa gói nền giữ yêu thích, bản nháp, hàng đợi và lịch sử; cài lại sẽ ghép cache địa điểm công khai đang có.

## API và kiến trúc

| Endpoint | Xác thực | Mục đích |
| --- | --- | --- |
| `GET /api/v1/sync/favorites` | JWT | Danh sách riêng của tài khoản, gồm tombstone |
| `POST /api/v1/sync/operations` | JWT | Nhận thao tác có UUID: favorite, contribution, review, review-delete |
| `GET /api/v1/sync/catalog` | Công khai | Snapshot địa điểm đã duyệt có hash/phiên bản |

Controller không đọc EF trực tiếp. `IAccountSyncService` quyết định nghiệp vụ; `IAccountSyncRepository` cung cấp transaction/biên nhận và lưu trữ. Client tương ứng có `sync/application` (logic thuần + ports), `sync/infrastructure` (IndexedDB/HTTP/session) và `sync/presentation` (React). Composition root nối các adapter. Không cache phản hồi API tài khoản trong Service Worker; chỉ lưu snapshot được chỉ định, theo đúng owner.

## Kiểm thử và kịch bản demo

```bash
npm test
npm run lint
npm run build
npm run test:e2e:sync
npm run test:e2e:offline
npm run test:e2e
```

Backend integration dùng database PostgreSQL tạm trên loopback, không migrate/seed database của người dùng:

```bash
# MAPAI_TEST_CONNECTION phải trỏ tới PostgreSQL local có quyền CREATE DATABASE.
dotnet run --project MapAI_BE-main/tests/MapAI.CommunityTests
```

Demo với hai thiết bị/trình duyệt đăng nhập cùng tài khoản: lưu offline trên thiết bị A, mở lại vẫn thấy mục chờ; kết nối lại để đồng bộ; thiết bị B cập nhật và thấy mục đó. Bỏ lưu, thử hoàn tác 4 giây rồi bỏ lưu thật; B nhận tombstone. Đăng xuất và đăng nhập tài khoản khác để xác nhận dữ liệu được cách ly. Thử thêm địa điểm offline kèm ảnh, mở lại và kết nối để gửi; admin duyệt online rồi cập nhật gói địa điểm để tìm được địa điểm khi offline.
