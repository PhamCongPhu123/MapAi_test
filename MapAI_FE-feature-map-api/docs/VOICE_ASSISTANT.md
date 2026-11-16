# ChatAI bằng giọng nói Việt / Anh

Tích hợp vào khung chat hiện tại ở `/map`, dùng chung luồng tìm kiếm MapAI + OpenStreetMap, cache/IndexedDB và chỉ đường. Không có màn hình chat hay backend âm thanh riêng.

## Sử dụng

1. Mở trợ lý MapAI, chọn **VI** (`vi-VN`) hoặc **EN** (`en-US`) ngay trên thanh nhập.
2. Chạm micro và cấp quyền trên thiết bị. Chữ nhận dạng hiện trong khung thu âm. Câu cuối được gửi một lần; có thể chọn **Gửi ngay** hoặc **Hủy**. Nói không rõ, từ chối quyền hoặc hủy không gửi câu hỏi.
3. AI trả lời theo ngôn ngữ đã chọn. Nút loa ở tiêu đề bật/tắt tự đọc; nút **Dừng đọc** ngắt âm thanh; loa trên từng câu trả lời cho phép nghe lại bằng ngôn ngữ của câu đó.
4. Bấm micro lúc AI đang đọc sẽ dừng đọc để nghe câu mới. Thao tác trên bản đồ, đóng chat thủ công, chuyển ngôn ngữ, đưa app xuống nền hoặc rời trang cũng dừng phiên âm thanh phù hợp.

Ví dụ:

| VI | EN |
| --- | --- |
| Tìm bến xe buýt Việt Hàn | Find bus stops Viet Han |
| Chỉ đường đến bến xe buýt Việt Hàn | Directions to the Viet Han bus stop |
| Tìm cây xăng gần nhất | Find the nearest gas station |
| Chỉ đường đến đó | Directions there |
| Phóng to bản đồ | Zoom in |

Tên riêng và ID địa điểm không bị dịch. Lệnh “gần nhất” vẫn cần GPS mới. Kết quả OSM không được nhập database chỉ vì người dùng nói hoặc xem chi tiết; lazy sync vẫn chỉ xảy ra khi yêu thích/đánh giá.

## Thiết bị và offline

| Môi trường | Nhận giọng nói | Đọc phản hồi |
| --- | --- | --- |
| Web/PWA | Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`), HTTPS hoặc localhost | `speechSynthesis`, chọn giọng cùng ngôn ngữ |
| Android Capacitor | `@capacitor-community/speech-recognition` 7.0.1, quyền `RECORD_AUDIO`, dịch vụ nhận dạng của hệ điều hành | `@capacitor-community/text-to-speech` 8.0.2, chọn giọng VI/EN đã cài |

**Nhận giọng nói không mặc định chạy offline.** Web chỉ bật khi API `processLocally` xác nhận mô hình đúng ngôn ngữ đã sẵn có. Không tự tải mô hình. Nếu API/giọng không khả dụng, hiện thông báo và chuyển trọng tâm về ô nhập để tiếp tục tìm/định tuyến trên dữ liệu cục bộ.

Bridge Android có bản vá được quản lý bằng `patch-package`: trên Android 12+ app kiểm tra `isOnDeviceRecognitionAvailable` và bắt buộc `createOnDeviceSpeechRecognizer` khi mất mạng. Không rơi về nhận dạng cloud. Nếu thiết bị không có engine hoặc chưa cài mô hình đúng VI/EN, app thông báo và chuyển về bàn phím. Khả năng này phụ thuộc máy/gói ngôn ngữ, không có trên mọi Android. Nếu đang có Wi-Fi nhưng bản APK chỉ cấu hình dữ liệu cục bộ, micro vẫn có thể dùng dịch vụ nhận dạng online của thiết bị rồi tìm trên gói đã tải.

TTS offline chỉ chọn giọng có `localService=true`. Nếu chưa cài giọng phù hợp, app giữ văn bản và hướng dẫn tải giọng Việt/Anh trong cài đặt Text-to-Speech của Android. Không dùng giọng tiếng Anh để đọc nhầm câu tiếng Việt. Giọng cùng ngôn ngữ, đúng vùng được ưu tiên.

Lưu ý iOS: quyền micro/speech và TTS đã được khai báo. Plugin Speech Recognition 7 chưa cung cấp Swift Package, trong khi project iOS đang dùng SPM; cần tích hợp plugin tương thích hoặc CocoaPods trước khi demo **nhận giọng nói native iOS**. Không coi `cap sync ios` là bằng chứng đã build/test iPhone. Web trên iPhone phụ thuộc Web Speech API của Safari.

## Cập nhật và build

Lấy code mới trên `work-unified`, sau đó tại frontend:

```powershell
npm ci
npm run dev -- --port 5175 --strictPort
```

Chạy lại backend .NET theo hướng dẫn hiện có. Request ChatAI thêm `language: "vi-VN" | "en-US"`, mặc định `vi-VN` để tương thích bản cũ. Backend cấu hình Gemini trả lời tối đa ba câu ngắn, đúng ngôn ngữ; lệnh tìm kiếm/chỉ đường và điều khiển bản đồ rõ ràng không cần Gemini. **Tính năng giọng nói không thêm migration/database mới.** Các migration từ tính năng đồng bộ OSM trước đó vẫn cần được áp dụng nếu chưa cập nhật.

Android có AI online: cấu hình API HTTPS trong `.env.mobile.local`, chạy:

```powershell
npm run mobile:sync
cd android
.\gradlew.bat assembleDebug
```

Bản demo dữ liệu cục bộ: dùng `npm run mobile:sync:offline` trước khi build. Bản này không có backend Gemini; có thể nhập/nói lệnh tìm địa điểm và chỉ đường cục bộ theo khả năng kết nối/giọng của thiết bị.

Chạy `npm ci` sẽ tự áp dụng bản vá Speech Recognition 7.0.1 qua `postinstall`. Bản vá bổ sung sự kiện kết quả cuối/confidence/lỗi, hủy nhận dạng có xác nhận, và lựa chọn engine on-device. Không bỏ qua install scripts khi chuẩn bị native build.

Đã khai báo `RECORD_AUDIO` và package visibility cho `RecognitionService` / `TTS_SERVICE`. Trên điện thoại, cấp quyền micro cho MapAI; kiểm tra đã cài dịch vụ nhận dạng và giọng Việt/Anh. Web mở qua IP LAN HTTP sẽ không đủ điều kiện dùng micro; dùng HTTPS hoặc native APK.

## Kiến trúc và dữ liệu

- `voice/application`: máy trạng thái, chốt câu một lần, hủy phiên cũ, chọn ngôn ngữ, bật/tắt loa, làm sạch TTS. Chỉ dùng port, không gọi React/Capacitor/trình duyệt/HTTP trực tiếp.
- `voice/infrastructure`: adapter Web Speech, Capacitor STT/TTS; kiểm quyền, hỗ trợ ngôn ngữ, giọng cục bộ.
- `voice/presentation`: hook vòng đời và điều khiển micro/ngôn ngữ/loa; composition root nối các port. Văn bản đi vào cùng `handleSend` → `createMapService.ask` → API hoặc local search/A*.

TTS bỏ Markdown/URL/emoji/tọa độ, đọc tối đa ba câu và giới hạn độ dài; văn bản đầy đủ vẫn ở chat. Khoảng lặng khoảng hai giây chốt bản tạm; engine gửi kết quả cuối sẽ chốt sớm hơn. Không nghe thấy tiếng sau năm giây hoặc phiên dài quá 25 giây sẽ kết thúc. Chỉ áp dụng ngưỡng confidence khi engine có cung cấp (native không luôn có).

Chỉ lưu lựa chọn ngôn ngữ/loa vào `mapai-voice-preferences` trên thiết bị. Không lưu file âm thanh hoặc gửi âm thanh tới backend MapAI; dịch vụ nhận dạng của trình duyệt/hệ điều hành có thể xử lý âm thanh qua mạng. Không đưa khóa Gemini vào APK/frontend.

## Kiểm chứng

```sh
npm test
npm run lint
npm run build
npm run test:e2e:voice
npm run test:e2e:offline
npm run mobile:sync:offline
npm run test:native:offline
```

Các bài kiểm tra giọng nói tự động dùng adapter/micro/loa mô phỏng, kiểm ngôn ngữ request, gửi đúng một lần, permission/no-model, giữ bản nháp, ngắt lời, lựa chọn loa và lệnh OSM offline. Build APK kiểm native plugin và quyền. Cần thử nghe/nói thật trên điện thoại Android đích để xác nhận chất lượng giọng, dịch vụ hệ điều hành và quyền; kiểm tra bằng trình duyệt không thay cho thử micro/loa vật lý.
