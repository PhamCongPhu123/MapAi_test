# MapAI — bản đồ tự chuyển online/offline

Ứng dụng có **một màn hình `/map`**, dùng chung MapLibre, style **OpenFreeMap Liberty**, thanh tìm kiếm, chi tiết địa điểm, bảng chỉ đường và khung trợ lý. Có mạng thì dùng các dịch vụ online; mất mạng hoặc bật giả lập thì chuyển sang gói Đà Nẵng trên thiết bị. Bản đồ không được dựng lại khi đổi mạng. `/offline` và `/map/online` là liên kết tương thích, chuyển về `/map` và giữ tham số tọa độ.

Xem bản đồ không cần đăng nhập. Đóng góp, đánh giá và quản lý tài khoản cần mạng và tài khoản phù hợp. Dữ liệu yêu thích/lịch sử cục bộ chưa đồng bộ tài khoản. Phản hồi API có thông tin tài khoản không được cache offline.

Android/iOS đóng gói dữ liệu cùng ứng dụng để dùng ngay lần mở đầu không có mạng. Bản demo mobile không cấu hình backend dùng dữ liệu cục bộ; bản mobile có `VITE_API_BASE_URL` tự chuyển hai chế độ theo kết nối. Xem [Capacitor](../MOBILE.md) và [Clean Architecture 3 lớp](../../ARCHITECTURE.md).

## Chạy và trình diễn trên web

Cần Node.js **22.12 trở lên** và npm. Trong `MapAI_FE-feature-map-api`:

```bash
npm ci
npm run build
npm run preview -- --host 0.0.0.0
```

1. Mở `/map` khi có mạng, chờ huy hiệu **Đà Nẵng sẵn sàng**. Trên màn hình nhỏ, nhấn **Dữ liệu** để kiểm tra gói và giao diện đã được lưu.
2. Tìm địa điểm bằng API, mở chi tiết hoặc trò chuyện với trợ lý online.
3. Ngắt mạng thật hoặc dùng DevTools → Network → Offline. Màn hình giữ nguyên bố cục, chuyển trạng thái **Offline** và dùng dữ liệu cục bộ.
4. Thử tìm `mi quang`, mở **Mì Quảng Bà Mua**, lưu yêu thích; chọn **Dẫn đường → Cầu Rồng** rồi đổi đi bộ/xe máy.
5. Thử hỏi `Tìm quán ăn tối ngon`, chọn khu vực và mở địa điểm gợi ý. Tải lại hoặc mở tab mới để kiểm chứng PWA.
6. Kết nối lại để trở về dịch vụ online trên cùng màn hình.

Nút **Giả lập Offline** trong cửa sổ **Dữ liệu** cho phép demo chuyển chế độ và được giữ sau khi tải lại. Để kiểm tra việc khởi động PWA thật sự không cần mạng, vẫn phải ngắt mạng trình duyệt/thiết bị.

`npm run dev` không bật Service Worker. Demo tải lại khi mất mạng cần bản build/preview hoặc triển khai HTTPS. Service Worker được phép trên localhost; HTTP qua IP LAN thường không được hỗ trợ. Điện thoại dùng website HTTPS đã mở online một lần trên chính thiết bị đó, hoặc APK Capacitor đã đóng gói sẵn. Dữ liệu không tự chuyển giữa thiết bị hay trình duyệt.

Nếu đã cài phiên bản cũ, dùng **Cập nhật giao diện và tải lại** khi có thông báo. Gói bản đồ cũ không mang nguồn OpenFreeMap sẽ được thay bằng gói mới khi có mạng. Không xóa toàn bộ site data trước buổi demo vì sẽ mất cả Service Worker và dữ liệu cá nhân.

## Các chức năng dùng chung

| Chức năng | Khi online | Khi offline |
| --- | --- | --- |
| Lớp nền | OpenFreeMap Liberty, tile/font/sprite từ OpenFreeMap | Cùng layer/style Liberty, tile OpenFreeMap trong PMTiles và font/sprite cục bộ |
| Tìm kiếm, danh mục | API địa điểm và tìm kiếm bản đồ | Fuse.js, tên/địa chỉ/tags tiếng Việt trong gói |
| Chi tiết | Dữ liệu cộng đồng và dịch vụ online | 28 POI tuyển chọn, ảnh minh họa, giờ/giá tham khảo |
| Chỉ đường | Dịch vụ tuyến online | A* trên graph đường OSM trong Web Worker; đi bộ và xe máy |
| Trợ lý | Dịch vụ AI online | Nhận diện nhu cầu/khu vực và chấm điểm từ khóa, hỏi lại khi thiếu khu vực |
| Định vị | GPS thiết bị | GPS thiết bị nếu có tín hiệu; luôn có mốc/chọn điểm trên bản đồ |
| Quản lý dữ liệu | Tải/đồng bộ gói, kiểm tra SHA-256, ưu tiên giữ dữ liệu | Xem phiên bản/dung lượng, giả lập, xóa gói; app native có thể cài lại từ dữ liệu đóng gói |
| Yêu thích/lịch sử | Lưu cục bộ các địa điểm trong gói | Cùng IndexedDB, giữ qua tải lại và xóa/cài lại gói |

Dữ liệu cài đặt được thay trong transaction nguyên tử: một tài sản sai checksum không phá gói đang dùng. Workbox lưu giao diện và tài sản tĩnh; Dexie lưu gói và dữ liệu cá nhân. Không chuyển sang MapTiler, HOT, raster OpenStreetMap hay bản đồ demo khi OpenFreeMap gặp lỗi; thông báo có nút thử lại cùng nguồn.

## Phạm vi và giới hạn dữ liệu

- Khung `[108.14, 15.97, 108.33, 16.16]` theo `[tây, nam, đông, bắc]`, gồm vùng trung tâm và 28 POI. Chưa bao phủ toàn thành phố hành chính, Bà Nà, toàn bán đảo Sơn Trà hay Hội An.
- **157 tile vector OpenFreeMap**, zoom 0–14; camera offline giới hạn trong vùng, zoom từ 9 và cho phép overzoom. Các lớp đường, nước, công trình và nhãn dùng cùng style Liberty với online. PMTiles khoảng **4,14 MiB**; cả gói gồm font/sprite, ảnh, POI và graph khoảng **18,68 MiB**. Manifest ghi kích thước chính xác từng phiên bản.
- Tile được trích từ bản OpenFreeMap `20261101_080013_pt`; graph chỉ đường OSM có ngày **26/05/2026**, 56.768 nút và 63.456 cạnh. Vì hai nguồn có thời điểm cập nhật khác nhau, đường trên lớp nền và graph có thể khác chi tiết.
- Graph xuất phát từ dữ liệu đường cho phương tiện cơ giới, chưa có đầy đủ lối đi bộ. Xe máy tuân thủ hướng/quyền truy cập đã lưu và tránh cao tốc. Chưa xét hạn chế rẽ hay giao thông trực tiếp.
- Hai đầu tuyến nối tới đường gần trong cùng mạng liên thông, tối đa **350 m** mỗi đầu; đoạn nối có nét đứt và ghi rõ chưa có dữ liệu lối đi. Không vẽ đường thẳng thay tuyến khi không tìm được đường.
- Thời gian ước tính theo 4,5 km/h đi bộ và 25 km/h xe máy; đoạn nối tính như đi bộ. Tuyến là tham khảo.
- Ảnh POI là minh họa cục bộ; giá/giờ không phải thông tin trực tiếp. Trợ lý cục bộ không phải mô hình ngôn ngữ đa năng và không xác nhận quán đang mở.
- GPS cần thiết bị, quyền và tín hiệu; có thể thất bại dù bản đồ đã lưu. Có thể dùng các mốc hoặc chọn điểm trên bản đồ.
- Trình duyệt có thể thu hồi dữ liệu khi thiếu dung lượng. **Ưu tiên giữ dữ liệu** yêu cầu Storage API và tùy trình duyệt chấp nhận. Xóa site data sẽ xóa cả yêu thích/lịch sử.

## Kiểm tra

```bash
npm test
npm run lint
npm run build
npm run test:e2e
npm run test:e2e:offline
npm run mobile:sync:offline
npm run test:native:offline
```

Kiểm thử logic bao gồm tìm kiếm/AI, chuyển dịch vụ theo chế độ, A* so với thuật toán tham chiếu, đường một chiều, ngoài vùng, graph đứt đoạn, SHA-256, đọc PMTiles và 224 cặp tuyến từ 4 mốc tới 28 địa điểm với hai phương tiện. Kiểm thử trình duyệt dùng tile OpenFreeMap đã đóng gói làm fixture để không phụ thuộc mạng bên ngoài.

Các luồng production/PWA kiểm tra ngắt mạng thật, tải lại/tab mới, cùng canvas qua chuyển mạng, kích thước giao diện, kết quả API đến muộn, yêu thích/lịch sử, AI, GPS bị từ chối, chọn mốc/chọn bản đồ, chỉ đường và cập nhật gói lỗi. Kiểm thử mobile cold start phục vụ bundle đóng gói, chặn mọi request bên ngoài và Service Worker. Đây là kiểm thử WebView bằng Chromium; vẫn cần cài APK lên điện thoại để kiểm tra quyền/hành vi thiết bị thật.

Playwright mặc định dùng `/usr/bin/chromium`. Máy khác đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE` tới trình duyệt đã cài. Không cần backend thật cho các bài UI fixture.

## Nguồn và tái tạo gói

Gói trong `public/offline` đã được lưu cùng source, nên `npm ci` và build không cần tải lại dữ liệu bản đồ. Tài sản lấy từ OpenFreeMap, OpenMapTiles và OpenStreetMap; giấy phép style/font được kèm tại `public/offline/OPENFREEMAP_LICENSES.txt`. Plus Jakarta Sans có giấy phép ở `public/licenses/Plus-Jakarta-Sans-SIL-OFL.txt`.

Tạo lại tile/style/font/sprite từ nguồn OpenFreeMap:

```bash
npm run offline:tiles
npm test
npm run build
```

Script `scripts/build-openfreemap-package.mjs` tải style Liberty và TileJSON qua HTTPS, trích tile trong bounds, ghi PMTiles v3 và đọc kiểm chứng bằng thư viện `pmtiles`. Script lấy các dải glyph cần cho nhãn trong vùng, sprite 1x/2x và ảnh Natural Earth, rồi cập nhật kích thước/SHA-256 của toàn gói. Máy chạy script cần truy cập `tiles.openfreemap.org`, `assets.openfreemap.com` và GitHub để lấy giấy phép. Có cache tải xuống ở thư mục tạm. Script `build-offline-tiles.mjs` cũ chỉ còn phục vụ tham khảo, không phải lệnh tạo gói hiện hành.

Graph đường: **© OpenStreetMap contributors**, ODbL 1.0, bản Overpass cache công khai từ repository `slidendive/danang-routing`, commit `70d56994b4611679c31642839ded6543f8cc9807`, thư mục `cache`. Chỉ dùng dữ liệu OSM, không sao chép mã ứng dụng của repository đó. Muốn tái tạo graph/POI (Python 3 + Pillow):

```bash
git clone https://github.com/slidendive/danang-routing.git /tmp/mapai-osm-source
git -C /tmp/mapai-osm-source checkout 70d56994b4611679c31642839ded6543f8cc9807
python scripts/prepare-offline-data.py /tmp/mapai-osm-source/cache
python scripts/prepare-offline-places.py
npm run offline:tiles
npm test
```

`prepare-offline-data.py` ghi graph, dữ liệu nền cũ và ảnh; file `roads.geojson.local` không còn là nguồn tạo lớp nền hiện hành. Sau khi thay bất kỳ tài sản nào, chạy lại script OpenFreeMap, cập nhật `version`/`sourceDate` phù hợp và kiểm tra manifest trước khi phát hành. Người dùng cập nhật gói bằng nút đồng bộ.

- Nguồn graph: <https://github.com/slidendive/danang-routing/tree/70d56994b4611679c31642839ded6543f8cc9807/cache>
- OpenFreeMap: <https://openfreemap.org/>
- Ghi công OSM: <https://www.openstreetmap.org/copyright>
- ODbL: <https://opendatacommons.org/licenses/odbl/1-0/>

Web cần phục vụ cùng origin tại đường dẫn gốc, SPA fallback về `index.html` và HTTPS để PWA/GPS hoạt động. Dockerfile dùng Node 22 + `npm ci`, sau đó Nginx phục vụ build.
