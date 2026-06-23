# hungtranPM — Quản lý lớp học & học sinh

Webapp quản lý lớp học lập trình (một giáo viên), xây dựng bằng **React + Vite + Tailwind CSS** trên **Firebase** (Authentication + Cloud Firestore). Frontend deploy **Netlify**; không dùng Cloud Functions — logic ghi/đọc qua client + `firestore.rules`.

## Tính năng

### Khu quản trị (`/admin`, đăng nhập admin)

| Trang | Tính năng chính |
|-------|-----------------|
| **Tổng quan** | Thống kê lớp/HS, HS cần hỗ trợ, đặt nhanh buổi hiện tại |
| **Lớp học** | CRUD, ẩn/hiện, active/hoàn thành/lưu trữ, gắn chương trình, phase học/cuối khóa, `finalMode` project/exam, copy link lớp |
| **Học sinh** | CRUD theo lớp, snapshot tiến độ, **duyệt tên dự án**, lịch sử báo cáo & phản hồi |
| **Báo cáo học sinh** | Tab *Báo cáo tiến độ* + *Phản hồi buổi học* — lọc lớp/buổi/trạng thái, copy clipboard, reset phản hồi, **Làm mới** |
| **Điểm số** | Tab *Quiz kiểm tra* + *Ôn tập* — xem bài nộp, chấm code, reset lượt làm, **Làm mới** |
| **Thống kê** | Biểu đồ tiến độ, heatmap mức hiểu theo buổi, bảng so sánh lớp, **Làm mới** |
| **Bài giảng** | CRUD chương trình & bài (Markdown + ảnh Cloudinary), soạn quiz (MCQ + code) & ôn tập MCQ |
| **Mini game** | Quay tên, đoán số, lật bài, hộp bí ẩn; **Coding Showdown**, **Truy tìm gián điệp** (realtime Firestore); điểm danh có mặt |

Đường dẫn cũ vẫn hoạt động: `/admin/feedback` → báo cáo HS; `/admin/quiz` → điểm số.

**Màn chiếu Showdown:** `/present/:sessionId` (không cần đăng nhập admin shell).

### Khu học sinh (`/c/:classCode`, không đăng nhập)

- Vào lớp bằng mã, chọn họ tên (lưu trên máy)
- **Phase học:** danh sách bài giảng, đọc Markdown/ảnh, bài tập, **ôn tập** MCQ, **quiz** buổi 5 & 9 (MCQ + code, Pyodide), **phản hồi buổi học**
- **Gửi & chờ duyệt tên dự án** (cuối khóa dạng project)
- **Phase cuối khóa + project:** báo cáo tiến độ sản phẩm (giai đoạn, %, mục tiêu, khó khăn)
- **Phase cuối khóa + exam:** vẫn xem bài giảng; không có form báo cáo tiến độ dự án
- **Mini game realtime:** banner tham gia Showdown / Spy trên cổng HS (`?showdown=`, `?spy=`)

Giao diện responsive, **dark mode**.

## Công nghệ

- React 19, React Router 7, Vite 6, Tailwind CSS 4
- Firebase Auth + Firestore
- marked + DOMPurify, recharts (thống kê), CodeMirror + Pyodide (quiz code)
- Cloudinary (ảnh bài giảng)

## Cấu trúc (rút gọn)

```
src/
  App.jsx                 # routes
  pages/admin/            # Dashboard, Classes, Students, ReportsHub, ScoresHub, Lessons, Analytics, MiniGames
  pages/student/          # StudentPortal, LessonsView, ProgressReportView, quiz/practice
  services/               # Firestore: classes, students, reports, knowledgeReports, curriculum, quiz, practiceQuiz
  lib/                    # adminDataCache, adminPanelData, analyticsData, …
  ui/components/          # AppShell, BrandLogo, Modal, Toast, …
  state/auth.store.jsx    # auth + kiểm tra admins/{email}
public/                   # logo-wordmark.svg, logo-icon.svg, favicon.svg
firestore.rules           # bảo mật ghi công khai (HS) + admin
scripts/                  # migrate program IDs, lessons subcollection, feedback index
```

## Chạy local

```bash
npm install
cp .env.example .env   # điền Firebase + Cloudinary
npm run dev
```

Mở http://localhost:5173 — admin: `/admin/login`, học sinh: `/` hoặc `/c/MÃ_LỚP`.

## Đăng nhập admin

- **Email/Mật khẩu** — chạy mọi nơi (kể cả Cursor).
- **Google** — trình duyệt thật (Chrome/Edge); OAuth bị chặn trong trình duyệt nhúng.

### Thiết lập một lần (Firebase Console)

1. **Authentication → Sign-in method:** bật Email/Password (và Google nếu cần).
2. **Authentication → Users:** tạo user email/mật khẩu.
3. **Firestore:** `admins/{email-thường}` → `{ active: true, role: "admin" }`  
   `active` phải là **boolean** `true`, không phải chuỗi `"true"`.

Quên mật khẩu: nhập email ở trang login → «Quên mật khẩu?».

## Triển khai production

### 1. Netlify

- Build: `npm run build`, publish: `dist` (`netlify.toml` có SPA redirect).
- **Environment variables:** toàn bộ `VITE_*` trong `.env.example` (Firebase + Cloudinary).
- Không commit `.env`.

### 2. Firebase Auth

- **Authorized domains:** thêm domain Netlify (và domain tùy chỉnh).

### 3. Firestore

```bash
firebase use hungtran-pm
npm run deploy:firestore
```

Hoặc: `firebase deploy --only firestore:rules,firestore:indexes`

**Sau khi đổi rules/indexes** (quiz, spy, điểm danh mini game): luôn chạy lệnh trên trước khi smoke test production.

### 4. Migrate dữ liệu cũ (nếu DB đã có từ bản trước)

Cần `firebase login` hoặc Application Default Credentials:

```bash
npm run migrate:programs:dry
npm run migrate:lessons:dry
npm run migrate:feedback-index:dry
# OK thì:
npm run migrate:programs
npm run migrate:lessons
npm run migrate:feedback-index
```

| Script | Mục đích |
|--------|----------|
| `migrate:programs` | `python-app-basic` → `python-basic`, … |
| `migrate:lessons` | `lessons[]` embed → subcollection `lessons/` |
| `migrate:feedback-index` | Backfill `studentFeedbackIndex` từ `knowledgeReports` |

### 5. Checklist sau deploy

- [ ] Admin: email + Google (trình duyệt thật)
- [ ] HS: vào lớp, chọn tên, đọc bài, phản hồi
- [ ] Quiz / ôn tập (nếu đã bật trong bài giảng)
- [ ] Cuối khóa: tên dự án → duyệt → báo cáo tiến độ
- [ ] Admin: Báo cáo HS, Điểm số, Thống kê — nút **Làm mới**
- [ ] Upload ảnh bài giảng (Cloudinary)
- [ ] Refresh sâu URL (SPA), dark mode
- [ ] **Mini game:** điểm danh → Quay tên chỉ trong nhóm có mặt
- [ ] **Spy / Showdown:** tạo phòng → HS join → vote / thi đấu → reveal
- [ ] `npm run test` pass (Vitest — logic điểm danh, quiz responses)

## Mô hình dữ liệu (chính)

| Collection | Mô tả |
|------------|--------|
| `classes` | Lớp, phase, buổi hiện tại, chương trình, `finalMode` |
| `students` | HS + snapshot tiến độ + tên dự án (pending/approved) |
| `reports` | Báo cáo tiến độ sản phẩm |
| `knowledgeReports` + `knowledgeReportReceipts` | Phản hồi buổi học |
| `studentFeedbackIndex` | Index `lessonIds[]` theo lớp+HS (1 read cổng HS) |
| `curriculumPrograms` + `…/lessons` | Chương trình; bài trong subcollection |
| `quizPublicQuestionBanks`, `studentQuizSubmissions`, `studentQuizLatest` | Quiz HS (đáp án chỉ admin; HS nộp pending, admin chấm) |
| `practiceQuizPublicBanks`, `practiceQuizSubmissions` | Ôn tập |
| `showdownSessions`, `spySessions`, `minigameAttendance` | Mini game realtime & điểm danh |
| `admins` | Quyền admin (email → `active`) |

Ghi từ cổng học sinh được kiểm soát bởi `firestore.rules` (batched write cho receipt/snapshot).

## Scripts npm

| Lệnh | Mô tả |
|------|--------|
| `npm run dev` | Dev server |
| `npm run build` | Build production |
| `npm run preview` | Xem bản build local |
| `npm run test` | Chạy Vitest (logic thuần) |
| `npm run deploy:firestore` | Deploy rules + indexes |
| `npm run migrate:*` | Xem bảng migrate ở trên |
