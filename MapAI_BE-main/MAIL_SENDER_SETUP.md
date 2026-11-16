# Lấy code, cập nhật database và đổi email gửi thư MapAI

## 1. Lấy code mới trên Windows

Nếu đã clone project, mở PowerShell tại thư mục repository:

```powershell
cd D:\Da_nen_tang_fimalproject\MapAi_test
git status
git fetch origin
git switch work-unified
git pull --ff-only origin work-unified
```

Nếu chưa có nhánh local, dùng `git switch --track origin/work-unified` thay cho `git switch work-unified`. Nếu Git báo thay đổi local, giữ lại các thay đổi đó và xử lý trước khi pull; không dùng reset hard để bỏ cấu hình/dữ liệu của bạn.

Máy chưa có source:

```powershell
git clone --branch work-unified https://github.com/PhamCongPhu123/MapAi_test.git
cd MapAi_test
```

Cần Node.js 22.12 trở lên và .NET SDK 9. Android cần thêm Android Studio, JDK 21 và SDK theo `MapAI_FE-feature-map-api/MOBILE.md`.

## 2. Database: cập nhật, không tạo lại

Nếu đang dùng PostgreSQL/Supabase/Aiven và kết nối vẫn hợp lệ, giữ nguyên database cùng tài khoản, địa điểm và dữ liệu đã có. Bản đồng bộ bổ sung migration `AddAccountSync`, tạo bảng `AccountFavorites` và `SyncReceipts`.

Tại thư mục gốc repository:

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Development"
dotnet tool restore --tool-manifest MapAI_BE-main/.config/dotnet-tools.json
dotnet ef database update --project MapAI_BE-main/src/MapAI.Infrastructure --startup-project MapAI_BE-main/src/MapAI.API
```

Lệnh áp dụng các migration còn thiếu; chạy lại sau khi database đã cập nhật sẽ không tạo thêm bảng trùng. Kiểm tra `ConnectionStrings:DefaultConnection` đang trỏ đúng database trước khi chạy. Môi trường Development đọc thêm .NET User Secrets của startup project; biến môi trường `ConnectionStrings__DefaultConnection` sẽ ghi đè cấu hình đó.

Máy/database mới cần cấu hình kết nối và chạy cùng lệnh. Migration chỉ tạo/cập nhật cấu trúc, không tự sao chép dữ liệu từ database cũ. Đổi địa chỉ SMTP không đổi email tài khoản trong bảng `Users` và không cần migration riêng.

## 3. Đổi tài khoản gửi Gmail trên laptop

Project đã đặt mặc định `MailSetting:Mail` thành `congphu.0303@gmail.com`, giữ SMTP Gmail STARTTLS cổng 587 và bỏ mật khẩu SMTP khỏi file source. Cần cung cấp **App Password của chính tài khoản Gmail mới**; mật khẩu hoặc App Password của tài khoản cũ không dùng thay được.

1. Đăng nhập Google bằng `congphu.0303@gmail.com`.
2. Bật Xác minh 2 bước tại <https://myaccount.google.com/security>.
3. Vào <https://myaccount.google.com/apppasswords>, tạo mật khẩu ứng dụng, đặt tên MapAI. Nếu Google không cung cấp mục này, kiểm tra chính sách tài khoản và phương thức xác minh đang dùng.
4. Lưu mật khẩu bằng .NET User Secrets, không đưa vào source, APK hoặc chat.

Dừng backend đang chạy. Mở PowerShell tại `MapAI_BE-main`:

```powershell
cd D:\Da_nen_tang_fimalproject\MapAi_test\MapAI_BE-main

# Xóa override cũ trong cửa sổ hiện tại nếu có: environment ưu tiên hơn User Secrets.
"Host", "Port", "DisplayName", "Mail", "Password" | ForEach-Object {
    Remove-Item "Env:MailSetting__$_" -ErrorAction SilentlyContinue
}

dotnet user-secrets set "MailSetting:Host" "smtp.gmail.com" --project .\src\MapAI.API
dotnet user-secrets set "MailSetting:Port" "587" --project .\src\MapAI.API
dotnet user-secrets set "MailSetting:DisplayName" "MapAI" --project .\src\MapAI.API
dotnet user-secrets set "MailSetting:Mail" "congphu.0303@gmail.com" --project .\src\MapAI.API

$mapaiMailPassword = ([System.Net.NetworkCredential]::new("", (Read-Host "Dán App Password Gmail mới" -AsSecureString))).Password.Replace(" ", "")
dotnet user-secrets set "MailSetting:Password" $mapaiMailPassword --project .\src\MapAI.API
Remove-Variable mapaiMailPassword

$env:FrontendUrl = "http://localhost:5173"
dotnet run --project .\src\MapAI.API --launch-profile http --urls http://0.0.0.0:5028
```

Lệnh xóa biến ở trên chỉ áp dụng cho cửa sổ PowerShell đang mở. Nếu Windows, IDE, Docker hoặc hosting có cấu hình SMTP riêng, cập nhật nguồn cấu hình đó nữa. Không in/chụp toàn bộ User Secrets để chia sẻ vì có thể chứa password và API key.

Frontend chạy trong terminal khác:

```powershell
cd D:\Da_nen_tang_fimalproject\MapAi_test\MapAI_FE-feature-map-api
npm ci
$env:VITE_API_BASE_URL = "http://localhost:5028/api/v1"
npm run dev -- --port 5173 --strictPort
```

Mở `http://localhost:5173`, chọn Quên mật khẩu và nhập email của một tài khoản đã tồn tại. Thư mới phải có địa chỉ From `congphu.0303@gmail.com` và tên MapAI. Link đặt lại mật khẩu có hiệu lực 60 phút và dùng một lần. Gửi lại yêu cầu mới thay cho việc dùng link cũ.

Backend cố ý phản hồi chung cho email không tồn tại để không tiết lộ danh sách tài khoản; thông báo nhận yêu cầu không tự chứng minh đã gửi thư tới tài khoản đó. Nếu SMTP lỗi, kiểm tra log backend mà không chia sẻ password/token reset.

## 4. Khi xuất APK và nộp cho thầy

Cấu hình SMTP nằm trên backend. APK gọi API để yêu cầu gửi thư; APK không chứa tài khoản/mật khẩu SMTP.

Trên hosting chạy backend, cập nhật các biến sau rồi restart/redeploy:

| Biến môi trường | Giá trị |
| --- | --- |
| `MailSetting__Host` | `smtp.gmail.com` |
| `MailSetting__Port` | `587` |
| `MailSetting__DisplayName` | `MapAI` |
| `MailSetting__Mail` | `congphu.0303@gmail.com` |
| `MailSetting__Password` | App Password của Gmail mới |
| `FrontendUrl` | URL website HTTPS có trang `/reset-password` |

Hosting phải cho phép kết nối SMTP ra ngoài cổng 587. User Secrets trên laptop không tự xuất hiện trên hosting; environment của hosting cũng ghi đè giá trị trong appsettings.

Frontend web HTTPS cần dùng cùng backend để trang đặt mật khẩu cập nhật đúng database. Cấu hình `VITE_API_BASE_URL` của website khi build/deploy, ví dụ `https://YOUR-BACKEND/api/v1`; đặt `FrontendUrl` của backend thành domain website đó, ví dụ `https://YOUR-WEB` (không thêm `/reset-password`).

Trên frontend mobile, tạo/sửa `.env.mobile.local`:

```env
VITE_API_BASE_URL=https://YOUR-BACKEND/api/v1
```

Build bản đầy đủ:

```powershell
npm run mobile:sync -- android
npm run android:open
```

Trong Android Studio chọn **Build → Generate Signed App Bundle / APK → APK → release**, chọn keystore và build. `mobile:sync:offline` là bản demo không có API URL, không dùng để demo quên mật khẩu online.

Nếu APK đã trỏ đúng backend HTTPS này, chỉ đổi SMTP và restart backend là đủ; không cần build lại APK chỉ để đổi người gửi. Đổi URL API hoặc sửa frontend mới cần sync/build lại.

Trên điện thoại, mở Quên mật khẩu trong app, nhập email tài khoản, mở thư và nhấn liên kết HTTPS. Trang web đặt lại mật khẩu mở trong trình duyệt; sau khi đổi xong quay lại app đăng nhập bằng mật khẩu mới. Luồng hiện tại gửi link website theo `FrontendUrl`; không đổi giá trị này thành `localhost`, địa chỉ API hoặc `mapai://` khi demo qua hosting. Custom scheme đã có trong Capacitor nhưng email chưa tự chuyển sang scheme đó.

## 5. Thư vào Spam

Đổi From/Gmail không đảm bảo thư hết vào Spam. Ở thư hợp lệ đã nhận, dùng **Báo cáo không phải thư rác** và có thể thêm địa chỉ gửi mới vào danh bạ. Backend đã đặt header From với tên hiển thị; Gmail/SMTP vẫn phải xác thực đúng tài khoản gửi. Mật khẩu SMTP cũ đã được bỏ khỏi cấu hình source; nếu đó là App Password còn hoạt động, thu hồi trong tài khoản Google cũ vì nó có thể còn trong lịch sử Git.

Không cần gửi một thư thật để build hoặc chạy kiểm thử tự động. Việc gửi SMTP thực tế cần App Password mới được cấu hình riêng trên máy/hosting của bạn.
