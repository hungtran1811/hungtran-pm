# Nộp bài học sinh (Google Drive + Firestore)

Học sinh nộp file sản phẩm tại `/c/:classCode/submit` (hoặc `/submit` rồi nhập mã lớp). File lên Google Drive bằng resumable upload; metadata nằm trong collection `submissions`. Refresh token và service account **chỉ** sống trên Netlify Functions — frontend không nhận token Google.

## Luồng

1. HS chọn tên từ roster lớp, chọn buổi, chọn file (≤ 150MB).
2. Trình duyệt gọi `POST /.netlify/functions/drive-create-upload-session`.
3. Function kiểm tra lớp mở + HS active + tên khớp + loại/size file, tạo thư mục lớp (lazy), mở resumable session Drive, trả `{ uploadUrl, storedFileName, uploadToken }`.
4. Trình duyệt `PUT` file thẳng lên Drive (thanh tiến trình %).
5. `POST /.netlify/functions/drive-complete-submission` với `uploadToken` + `driveFileId`.
6. Function xác minh file trên Drive rồi ghi Firestore bằng Admin SDK.
7. Trang nộp HS gọi `drive-list-my-submissions` để hiện buổi đã nộp + giờ + tên file (không có link Drive).
8. Giáo viên xem bài tại `/admin/reports` (đường dẫn cũ `/admin/submissions` chuyển tới đây) và mở file trên Drive (tài khoản giáo viên). Lớp sản phẩm cuối khóa: báo cáo tiến độ + file **cùng buổi**. Lớp giai đoạn học: chỉ file nộp. HS không tải lại file.

Cấu trúc Drive (phẳng theo lớp):

```text
HungTranPM - Submissions/
  PVĐ-CSB02/
    NguyenVanAn/
      B03/
        PVD-CSB02_NguyenVanAn_L03_20260912.zip
```

## Biến môi trường (Netlify / `netlify dev`)

Không dùng prefix `VITE_` cho secret.

| Biến | Vai trò |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client (Web) |
| `GOOGLE_CLIENT_SECRET` | OAuth secret |
| `GOOGLE_REFRESH_TOKEN` | Refresh token tài khoản giáo viên |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | ID thư mục gốc `HungTranPM - Submissions` |
| `FIREBASE_SERVICE_ACCOUNT` | JSON service account (một dòng). `private_key` có thể dùng `\n` |

Tuỳ chọn frontend: `VITE_NETLIFY_FUNCTIONS_BASE` (mặc định `/.netlify/functions`).

## Hướng dẫn setup từng bước (làm 1 lần)

Làm **đúng thứ tự A → F**. Đừng dán Client secret / Refresh token / file JSON service account vào chat hay commit git.

Chuẩn bị: trình duyệt Chrome/Edge, tài khoản **Google của giáo viên** (Drive sẽ chứa bài nộp), quyền Firebase project hiện tại, quyền site Netlify.

---

### A. Google Cloud — project + Drive API + Google Auth Platform

UI hiện tại (2026): màn hình đồng ý OAuth nằm ở **Google Auth platform**, **không** còn wizard cũ `APIs & Services → OAuth consent screen` (menu cũ thường redirect sang đây).

Làm hết A.1 → A.4 rồi mới sang B. Đừng dán secret vào chat.

#### A.1 Tạo / chọn project

1. Mở [Google Cloud Console](https://console.cloud.google.com/) bằng **tài khoản Google giáo viên**.
2. Thanh trên, cạnh logo Google Cloud, bấm **tên project** (hoặc chữ **Select a project**).
3. Trong popup: **New project** (góc phải).
   - Project name: `hungtran-pm-drive`
   - Location: để mặc định (No organization cũng được nếu dùng Gmail cá nhân).
4. **Create**. Đợi vài giây.
5. Mở lại bộ chọn project → chọn **hungtran-pm-drive**.  
   Tên project trên thanh trên phải đúng — mọi bước sau phụ thuộc chỗ này.

Hoặc dùng luôn **project Firebase** của app (trùng `VITE_FIREBASE_PROJECT_ID`) nếu muốn gộp, khỏi tạo project mới.

#### A.2 Bật Google Drive API

Cách nhanh: mở đúng project rồi vào  
https://console.cloud.google.com/apis/library/drive.googleapis.com

1. Kiểm tra project trên thanh trên vẫn là `hungtran-pm-drive`.
2. Nếu thấy nút **Enable** → bấm **Enable**. Đợi “API enabled”.
3. Nếu thấy **Manage** / đã enabled → bỏ qua, sang A.3.

Cách đi từ menu:

1. ☰ (góc trái) → **APIs & Services** → **Library**  
   (hoặc **Enabled APIs & services** → **+ ENABLE APIS AND SERVICES**).
2. Ô tìm kiếm: `Google Drive API`.
3. Chọn **Google Drive API** (Google, không phải bản third-party).
4. **Enable**.

#### A.3 Cấu hình Google Auth platform (lần đầu)

1. ☰ → **Google Auth platform** → **Overview**.  
   Link: https://console.cloud.google.com/auth/overview
2. Nếu hiện **Google Auth platform not configured yet** (hoặc trang trống): bấm **Get started** / **GET STARTED**.
3. Wizard từng trang — bấm **Next** sau mỗi trang:

   **App Information**
   - App name: `HungTranPM`  
     (không đặt tên kiểu “Google Drive …”).
   - User support email: chọn **email đang đăng nhập** trong dropdown.
   - **Next**.

   **Audience**
   - **External** — Gmail cá nhân / học sinh ngoài Workspace: chọn cái này.
   - **Internal** — chỉ hiện nếu project thuộc Google Workspace tổ chức; chỉ user trong tổ chức authorize được.
   - **Next**.

   **Contact Information**
   - Email nhận thông báo từ Google: email GV.
   - **Next**.

   **Finish**
   - Tick **I agree to the Google API Services: User Data Policy**.
   - **Continue** → **Create**.

4. Nếu platform **đã cấu hình sẵn**: không chạy lại wizard. Dùng menu trái: **Branding**, **Audience**, **Data Access**.

#### A.4 Scope Drive + Test users

**Scope (bắt buộc):**

1. Menu trái **Google Auth platform** → **Data Access**.  
   Link: https://console.cloud.google.com/auth/scopes
2. **Add or remove scopes**.
3. Ô lọc / tìm: `drive`.
4. Tick đúng:

   `https://www.googleapis.com/auth/drive`

   (See, edit, create, and delete all Google Drive files — restricted. App **Testing** thì không cần Google verify.)
5. **Update** → **Save**.

**Test users (bắt buộc nếu Audience = External):**

1. Menu trái → **Audience**.  
   Link: https://console.cloud.google.com/auth/audience
2. Publishing status để **Testing** (không bấm Publish App).
3. Mục **Test users** → **Add users**.
4. Nhập **đúng email Google GV** sẽ mở Drive chứa bài nộp → **Save**.
5. Quên bước này thì bước C (Playground) bị **Access blocked** / app chưa verified.

Xong A khi: Drive API = Enabled, Auth platform đã Create, scope `drive` đã Save, test user đã có email GV.

---

### B. Tạo OAuth Client ID + Secret

UI hiện tại: **Google Auth platform → Clients** (cũng vào được từ **APIs & Services → Credentials**).

1. Vẫn đúng project: ☰ → **Google Auth platform** → **Clients**.  
   Link: https://console.cloud.google.com/auth/clients
2. **+ Create client** (hoặc **Create credentials** → **OAuth client ID** nếu đang ở Credentials).
3. Application type: **Web application**.
4. Name: `HungTranPM Netlify`.
5. **Authorized redirect URIs** → **Add URI** → dán nguyên:

   `https://developers.google.com/oauthplayground`

6. **Create**.
7. Popup hiện **Your Client ID** và **Your Client Secret**.
   - Copy Client ID → ghi tạm `GOOGLE_CLIENT_ID`.
   - Copy Client secret → ghi tạm `GOOGLE_CLIENT_SECRET`.
   - Mở lại sau: **Clients** → bấm tên client.

---

### C. Lấy Refresh token (OAuth Playground)

Refresh token = chìa khóa lâu dài; access token Playground hết hạn ~1 giờ, **không** dùng access token trong `.env`.

1. Mở [OAuth 2.0 Playground](https://developers.google.com/oauthplayground).
2. Góc phải, bấm **bánh răng ⚙️**.
3. Tick **Use your own OAuth credentials**.
4. Dán `OAuth Client ID` và `OAuth Client secret` vừa tạo → đóng bánh răng.
5. Cột trái, kéo xuống **Drive API v3**.
6. Tick **chỉ** `https://www.googleapis.com/auth/drive`.
7. Bấm **Authorize APIs**.
8. Chọn **đúng tài khoản GV** (trùng test user ở bước A).
9. Google cảnh báo “Google hasn’t verified this app” → **Continue** / **Advanced** → **Go to HungTranPM (unsafe)**.
10. Cho phép quyền Drive → **Continue**.
11. Quay lại Playground, cột giữa: **Exchange authorization code for tokens**.
12. Ô **Refresh token** hiện ra **một lần**. Copy ngay → `GOOGLE_REFRESH_TOKEN`.
    - Nếu không thấy refresh token: bánh răng → chắc đã tick “own credentials”; rồi **Authorize APIs** lại (lần đầu đôi khi chỉ ra access token).
    - Đừng share token này. Ai có nó đọc/ghi Drive GV.

---

### D. Tạo folder gốc trên Drive và lấy ID

1. Vào [Google Drive](https://drive.google.com) **cùng tài khoản GV** vừa authorize.
2. **Mới** → **Thư mục** → tên: `HungTranPM - Submissions` → tạo.
3. Mở thư mục đó (double-click).
4. Nhìn URL thanh địa chỉ, dạng:

   `https://drive.google.com/drive/folders/1AbCxxxxxxxxxxxxxxxxxxxxx`

5. Copy đoạn **sau** `/folders/` (không có dấu `/` cuối) → `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
   - ID thường dài, gồm chữ và số, không có khoảng trắng.

Function sẽ tự tạo `mã lớp / tên HS / buổi` bên trong folder này. File nộp trước khi đổi cấu trúc vẫn nằm ngay trong folder lớp — không tự di chuyển.

---

### E. Firebase service account (ghi Firestore)

1. Mở [Firebase Console](https://console.firebase.google.com/) → chọn **đúng project** app đang dùng (`VITE_FIREBASE_PROJECT_ID` trong `.env`).
2. Biểu tượng bánh răng cạnh **Project overview** → **Project settings**.
3. Tab **Service accounts**.
4. Chọn **Firebase Admin SDK** (mặc định).
5. **Generate new private key** → xác nhận → tải file `.json`.
6. Mở file bằng VS Code / Notepad.
7. Biến cả file thành **một dòng** JSON:
   - Trong VS Code: chọn hết (`Ctrl+A`) → Command Palette → “Join Lines”, **hoặc** minify JSON.
   - Trong `private_key`, các xuống dòng phải là `\n` (file Google tải về thường đã đúng).
8. Giá trị một dòng đó → `FIREBASE_SERVICE_ACCOUNT`.
9. **Không** commit file JSON. Có thể để ngoài repo rồi xóa sau khi copy xong.

Admin SDK bỏ qua `firestore.rules`; HS trên trình duyệt vẫn **không** tự ghi `submissions`.

---

### F. Đưa secret vào máy + đẩy rules

**F1. File `.env` local** (cùng thư mục project, cạnh `package.json`):

Mở `.env` (đã có biến Firebase web). **Thêm cuối file**, không thêm `VITE_` trước tên secret:

```env
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxx
GOOGLE_DRIVE_ROOT_FOLDER_ID=1AbCxxxxx
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"...@....iam.gserviceaccount.com"}
```

Lưu. Kiểm tra `.env` nằm trong `.gitignore` (repo này đã ignore).

**F2. Deploy rules + indexes Firestore** (cần đã `firebase login` và chọn đúng project):

```bash
npm run deploy:firestore
```

Thành công khi CLI in đã deploy `firestore.rules` và `firestore.indexes.json`.

**F3. Chạy local có Functions:**

```bash
npx netlify dev
```

Lần đầu có thể hỏi login Netlify / link site — làm theo prompt. **Không** dùng mỗi `npm run dev` để test nộp file.

Mở URL `netlify dev` in ra (thường `http://localhost:8888`) → `/c/{MÃ_LỚP}/submit` → chọn tên HS active → file `.zip` nhỏ.

**F4. Production (sau khi local ổn):**

1. [Netlify](https://app.netlify.com) → site hungtran-pm → **Site configuration** → **Environment variables**.
2. **Add a variable** lần lượt 5 biến ở F1 (cùng tên, cùng giá trị).
   - Scopes: Production (và Preview nếu muốn test branch).
3. **Deploys** → **Trigger deploy** → **Clear cache and deploy site** (đổi env secret cần redeploy Functions).

---

## Kiểm tra đã xong

- [ ] Drive: `HungTranPM - Submissions/{mã lớp}/{tenHS}/{Lxx}/` có file tên dạng `PVD-CSB02_NguyenVanAn_L03_20260912.zip`
- [ ] Firebase Console → Firestore → collection `submissions` có 1 document
- [ ] Form hiện “Đã nộp bài”

Nếu fail, xem bảng Troubleshooting bên dưới.

## Chạy local

```bash
# Terminal 1
npx netlify dev
```

`netlify dev` phục vụ Vite + Functions (thường cổng 8888). `npm run dev` (5173) chỉ proxy `/.netlify/functions` tới `localhost:8888` — cần `netlify dev` nếu muốn upload thật.

Flag: `FEATURE_DRIVE_SUBMISSION_ENABLED` trong `src/config/features.js`.

## Firestore

- `submissions`: metadata bài nộp. Client **không** create/update/delete; **chỉ admin đọc**. Function ghi bằng Admin SDK.
- `submissionUploadSessions`: token một lần, TTL 60 phút. Client deny all.
- Admin `/admin/reports` tải báo cáo + `submissions` theo `classCode`; lọc buổi / bản mới nhất / tên trên client. `/admin/submissions` redirect về đây.
- Nộp lại cùng (lớp, HS, buổi): bản cũ `isLatest=false`, bản mới `isLatest=true`, `attempt` tăng.

## Bảo mật

- Frontend chỉ gửi `classCode`, `studentId`, `studentName`, buổi, tên/size/mime file — không gửi `driveFolderId` hay token Google.
- Chặn `.exe .msi .bat .cmd .com .scr .ps1` và một số MIME nguy hiểm; allowlist `.zip .py .html .css .js .pdf .txt`.
- Rate limit Phase 1: đếm theo IP trong memory process (TODO: store tập trung nếu scale).
- Không CAPTCHA, không UI chấm điểm trong MVP.
- Học sinh thấy buổi đã nộp + giờ + tên file qua Function `drive-list-my-submissions` (không có `driveFileId`, không tải file). Client vẫn không đọc collection `submissions`.
- Admin xem metadata tại `/admin/reports` và mở file trên Drive (`/file/d/{id}/view`) bằng tài khoản Google giáo viên đã ủy quyền. Không share `anyone` / không đưa token Drive lên trình duyệt.

## Troubleshooting

| Hiện tượng | Việc kiểm |
| --- | --- |
| `Chức năng nộp bài chưa được cấu hình` | Thiếu env Netlify; JSON service account lỗi |
| `Không kết nối được máy chủ nộp bài` | Chưa chạy `netlify dev` / Functions chưa deploy |
| PUT Drive lỗi CORS | Function phải nhận `Origin` khi tạo session; test trên cùng origin (`netlify dev` hoặc site Netlify) |
| `Lớp này hiện không mở` | `status != active` hoặc `hidden` |
| `Tên học sinh không khớp` | Phải chọn tên roster, không gõ tự do |
| Folder lớp không tạo được | Scope OAuth quá hẹp (`drive.file` với folder gốc tạo tay) |
| Complete báo file không khớp | Upload chưa xong / token hết hạn (60 phút) |
| File vượt quá 150MB | Nén `.zip`, xóa `node_modules` / video / build; hoặc giáo viên nhận tay rồi ghi chú ngoài form |

## Ngoại lệ file quá nặng

Trần form là **150MB** (file lên Drive trực tiếp, không đi qua Netlify). Vẫn **một file / lần nộp**.

Nếu HS vẫn không nộp được:

1. Nén `.zip`, bỏ `node_modules`, file build, video/ảnh không cần.
2. Nộp lại trên wifi, không tắt trang khi đang %.
3. Vẫn >150MB: giáo viên nhận ngoài form (Drive/Zalo), rồi tự đặt file vào thư mục lớp trên Drive. Form không ghi nhận lần đó — ghi chú tay nếu cần.

Không mở trần vô hạn: điện thoại HS và phiên 60 phút dễ gãy với file vài trăm MB.

## Admin xem bài nộp

`/admin/reports` (đăng nhập admin): chọn lớp. Lớp sản phẩm cuối khóa hiện bảng báo cáo + file Drive; lớp giai đoạn học chỉ hiện file nộp. Lọc buổi, tìm tên/file, mặc định chỉ bản mới nhất. **Mở file** / **Thư mục** mở tab Drive — cần đang đăng nhập Gmail giáo viên sở hữu folder nộp bài.

## Ngoài MVP

Deadline, CAPTCHA, chấm điểm — chưa làm.
