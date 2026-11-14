# MapAI Offline — triển khai và trình diễn

Luồng khám phá offline mở tại **`/offline`**, không cần đăng nhập, API key hay backend. **`/map`** (alias `/map/online`) mở bản online khi có mạng và tự hiện bản offline khi mất mạng. Các trang quản trị, hồ sơ và tài khoản vẫn là tính năng online; không cache phản hồi API có thông tin tài khoản.

Android/iOS đóng gói dữ liệu sẵn trong ứng dụng, dùng được ngay lần mở đầu khi mất mạng. Xem [hướng dẫn Capacitor](../MOBILE.md) và [Clean Architecture 3 lớp](../../ARCHITECTURE.md). Phần PWA bên dưới áp dụng cho trình duyệt.

## Chạy thử đúng bản PWA

Yêu cầu Node.js **22.12 trở lên** và npm. Trong `MapAI_FE-feature-map-api`:

```bash
npm ci
npm run build
npm run preview -- --host 0.0.0.0
```

Mở `/offline` trên trình duyệt, chờ huy hiệu **Online • Đà Nẵng sẵn sàng**. Lần đầu phải có mạng để lưu giao diện và gói dữ liệu; sau đó có thể tải lại trang và mở tab mới khi mất mạng. Nút **Giả lập Offline** nằm trong cửa sổ mở bằng huy hiệu trạng thái hoặc nút dữ liệu. Giả lập áp dụng cho luồng khám phá cục bộ; kiểm chứng PWA bằng DevTools → Network → Offline hoặc ngắt mạng thật.

`npm run dev` dùng để sửa giao diện, **không bật Service Worker**. Muốn demo mở lại trang offline phải dùng bản build/preview hoặc bản triển khai qua **HTTPS**. Trình duyệt cho phép Service Worker trên localhost; truy cập IP LAN qua HTTP thường không được. Nếu dùng điện thoại, triển khai HTTPS rồi mở online một lần trên chính điện thoại đó. Dữ liệu không tự chuyển giữa thiết bị/trình duyệt.

Nếu từng cài phiên bản cũ, mở cửa sổ dữ liệu và chọn **Cập nhật giao diện và tải lại** khi xuất hiện thông báo. Đóng các tab của phiên bản cũ nếu cần. Không xóa toàn bộ site data trước khi demo: thao tác đó xóa cả Service Worker lẫn IndexedDB.

## Đối chiếu thiết kế F0–F5

| Yêu cầu | Phần triển khai |
| --- | --- |
| F0.1: tải trước | Workbox precache giao diện, font, glyph, PMTiles, POI, ảnh và graph; Dexie lưu gói để chạy cục bộ. Tự cài khi lần đầu vào bản đồ có mạng. |
| F0.2: trạng thái mạng | Sự kiện `online`/`offline`, huy hiệu xanh/hổ phách, giả lập được giữ sau khi tải lại. Chỉ báo sẵn sàng khi có cả dữ liệu và Service Worker. |
| F0.3: quản lý gói | Hiện phiên bản, dung lượng gói và toàn ứng dụng, thời điểm tải; đồng bộ, ưu tiên giữ dữ liệu, xóa gói. SHA-256 cho từng tài sản; transaction nguyên tử giữ nguyên gói cũ nếu tải lỗi. |
| F0.4: dữ liệu cá nhân | Favorites, lịch sử 50 địa điểm gần nhất và tuyến tính gần nhất trong IndexedDB. Xóa gói không xóa yêu thích/lịch sử. Chưa đồng bộ tài khoản. |
| F1: bản đồ | MapLibre đọc PMTiles trực tiếp từ Blob trong IndexedDB; glyph cục bộ, không gọi MapTiler hay CDN. Ghim theo danh mục, nhấn xem chi tiết, lọc khu vực/loại hình. |
| F2: tìm kiếm | Fuse.js đánh chỉ mục tên, tags, địa chỉ; chuẩn hóa tiếng Việt, hỗ trợ không dấu và lỗi nhẹ. Khoảng cách đường chim bay cập nhật theo tâm bản đồ. |
| F3: chi tiết | Giờ/giá tham khảo, mô tả, địa chỉ, ảnh WebP minh họa, SVG dự phòng, yêu thích, xem vị trí và chỉ đường. |
| F4: định vị/tuyến | GPS thật hoặc mốc/chạm bản đồ; A* chạy trong Web Worker trên graph OSM. Có đi bộ/xe máy, km/phút và các bước rẽ. |
| F5: trợ lý | Bộ nhận diện nhu cầu/khu vực và chấm điểm từ khóa tiếng Việt cục bộ. Hỏi lại khu vực, tối đa 3 địa điểm, mở thẳng bản đồ; không gọi Gemini. |
| UI/fallback | Đồng bộ với bản online: nền slate tối, bảng kính mờ, nhấn xanh dương/indigo, desktop chia bản đồ/chat 70/30 và thu gọn chat để xem toàn bản đồ. Thẻ chi tiết nổi và bảng chỉ đường cùng phong cách online. Mobile giữ bottom sheet 18/48/90%, kéo hoặc dùng nút/phím; trợ lý dạng overlay có focus trap và Escape. Có thông báo thiếu gói/không tìm được/ngoài vùng/GPS lỗi. |

## Phạm vi dữ liệu và giới hạn rõ ràng

- Gói hiện tại **28 địa điểm tuyển chọn**, không phải toàn bộ danh bạ doanh nghiệp hoặc dữ liệu live từ backend.
- Khung hỗ trợ `[108.14, 15.97, 108.33, 16.16]` theo `[tây, nam, đông, bắc]`, bao phủ trung tâm và các điểm trong gói. Chưa bao phủ toàn thành phố hành chính, Bà Nà, toàn bán đảo Sơn Trà hay Hội An.
- PMTiles có 273 tiles vector ở zoom 9–15 (có thể overzoom). Graph có 56.768 nút, 63.456 cạnh. Gói khoảng **4,09 MiB**, nhẹ hơn mức 15–25 MB ước tính trong thiết kế nhờ phạm vi và lớp dữ liệu gọn.
- Bản đồ đường là dữ liệu OSM thật. Vùng nước/cây xanh trong `geography.json` được giản lược để định hướng thị giác; không dùng cho thuật toán tuyến. Chưa có nhà/địa hình 3D offline.
- Graph lấy từ bản trích xuất đường cho phương tiện cơ giới, không bao gồm đầy đủ lối đi bộ. Đi bộ được phép đi ngược đường một chiều; xe máy tuân theo cờ hướng và quyền truy cập được lưu. Không dùng đường cao tốc cho xe máy. Chưa xét hạn chế rẽ, điều kiện trực tiếp hay giao thông.
- Hai đầu tuyến được nối tới đường gần trong cùng mạng liên thông, tối đa **350 m** mỗi đầu. Các đoạn nối được vẽ nét đứt và ghi rõ chưa có dữ liệu lối đi. Không vẽ một đường thẳng thay cho tuyến khi không tìm được đường.
- Thời gian ước tính theo 4,5 km/h đi bộ và 25 km/h xe máy; đoạn nối tính như đi bộ. Đây là tuyến tham khảo, không thay thế biển báo thực địa.
- Giá/giờ và tọa độ POI là dữ liệu tham khảo tuyển chọn. Ảnh là **minh họa cục bộ**, không phải ảnh thật của quán. Trợ lý cục bộ không phải mô hình ngôn ngữ đa năng, không xác nhận quán đang mở.
- GPS web phụ thuộc thiết bị, quyền và môi trường; không đảm bảo định vị được trên laptop/mất tín hiệu. Luôn có phương án chọn mốc hoặc bản đồ.
- Trình duyệt có thể thu hồi dữ liệu khi thiếu dung lượng. Nút ưu tiên giữ dữ liệu dùng Storage API; việc chấp nhận tùy trình duyệt. Gói phải tải lại nếu người dùng xóa site data.

## Kiểm tra

```bash
npm test
npm run lint:offline
npm run build
npm run test:e2e:offline
```

Unit tests kiểm tra tìm kiếm, nhận diện nhu cầu, làm rõ khu vực, A* so với một thuật toán tham chiếu độc lập, đường một chiều, ngoài vùng, graph đứt đoạn, SHA-256, đọc PMTiles và **224 cặp tuyến** từ 4 mốc tới 28 địa điểm với 2 phương tiện. Browser tests chạy bản production có Service Worker trên viewport desktop/mobile: offline thật, tải lại/mở tab, lưu yêu thích/lịch sử, AI, chọn điểm xuất phát, chỉ đường, trạng thái trống, giả lập, xóa/cài lại và cập nhật lỗi không phá gói cũ.

Playwright mặc định dùng Chromium tại `/usr/bin/chromium`. Nếu máy khác, đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE` tới trình duyệt đã cài. Test chỉ dùng server preview cục bộ, không cần backend. Test gói lỗi chặn Service Worker có chủ đích để chủ động trả một file sai checksum; các test offline thật vẫn bật Service Worker.

`npm run lint` kiểm tra toàn dự án; hiện còn 4 cảnh báo dependency useEffect ở phần online. `lint:offline` kiểm tra riêng phần offline.

## Nguồn và cách tái tạo dữ liệu

Không cần tải lại nguồn để `npm ci`/build: gói đã được commit trong `public/offline`.

Dữ liệu đường: **© OpenStreetMap contributors**, ODbL 1.0, timestamp **2026-05-26**. Bản Overpass cache được phân phối công khai trong repository `slidendive/danang-routing`, commit **`70d56994b4611679c31642839ded6543f8cc9807`**, thư mục `cache`. Chỉ sử dụng dữ liệu OSM, không sao chép mã ứng dụng của repository đó. Bản graph chuyển đổi trong `public/offline/roads.json` cũng được cung cấp theo ODbL; nguồn gốc và các bước chuyển đổi ở các script bên dưới.

- Nguồn: <https://github.com/slidendive/danang-routing/tree/70d56994b4611679c31642839ded6543f8cc9807/cache>
- Ghi công và quyền dữ liệu: <https://www.openstreetmap.org/copyright>
- ODbL: <https://opendatacommons.org/licenses/odbl/1-0/>
- Glyph Noto Sans Regular: <https://github.com/maplibre/demotiles/tree/gh-pages/font/Noto%20Sans%20Regular>, SIL Open Font License, kèm bản giấy phép tại `public/licenses/Noto-SIL-OFL.txt`.
- Plus Jakarta Sans: package `@fontsource/plus-jakarta-sans`, SIL OFL, giấy phép tại `public/licenses/Plus-Jakarta-Sans-SIL-OFL.txt`.
- POI, ảnh minh họa và hình nền giản lược được biên soạn bằng các script của MapAI.

Để tái tạo hoặc thay dữ liệu (Python 3 + Pillow; npm dependencies đã cài):

```bash
git clone https://github.com/slidendive/danang-routing.git /tmp/mapai-osm-source
git -C /tmp/mapai-osm-source checkout 70d56994b4611679c31642839ded6543f8cc9807
python scripts/prepare-offline-data.py /tmp/mapai-osm-source/cache
python scripts/prepare-offline-places.py
npm run offline:tiles
npm test
npm run build
```

`prepare-offline-data.py` ghi graph và ảnh, tạo `scripts/roads.geojson.local` (ignored) làm đầu vào cho PMTiles. `build-offline-tiles.mjs` viết PMTiles v3, đọc kiểm chứng bằng thư viện `pmtiles`, rồi tạo lại manifest kích thước/SHA-256. Glyph đã được lưu sẵn, không cần gọi nhà cung cấp khi chạy. Khi thay dữ liệu, cập nhật `version`/`sourceDate` ở script tạo manifest và kiểm tra lại thông tin hiển thị trước khi triển khai; không sửa một asset mà bỏ qua manifest. Client đang dùng gói cũ có thể cập nhật qua nút đồng bộ.

Ứng dụng phải được phục vụ cùng origin ở đường dẫn gốc, hỗ trợ SPA fallback về `index.html`. Dockerfile hiện dùng Node 22 + `npm ci`, sau đó Nginx phục vụ build. Môi trường triển khai cần HTTPS để PWA và GPS hoạt động.
