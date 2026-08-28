# hungtranPM — Quản lý lớp học & học sinh

Webapp quản lý lớp học lập trình (một giáo viên), xây dựng bằng **React + Vite + Tailwind CSS** trên **Firebase** (Authentication + Cloud Firestore). Frontend deploy **Netlify**; không dùng Cloud Functions — logic ghi/đọc qua client + `firestore.rules`.

## Tính năng

### Khu quản trị (`/admin`, đăng nhập admin)

| Trang                | Tính năng chính                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Tổng quan**        | Thống kê lớp/HS, HS cần hỗ trợ, đặt nhanh buổi hiện tại                                                                   |
| **Lớp học**          | CRUD, ẩn/hiện, active/hoàn thành/lưu trữ, gắn chương trình, phase học/cuối khóa, `finalMode` project/exam, copy link lớp  |
| **Học sinh**         | CRUD theo lớp, snapshot tiến độ, **duyệt tên dự án**, lịch sử báo cáo & phản hồi                                          |
| **Báo cáo học sinh** | Tab _Báo cáo tiến độ_ + _Phản hồi buổi học_ — lọc lớp/buổi/trạng thái, copy clipboard, reset phản hồi, **Làm mới**        |
| **Thống kê**         | Biểu đồ tiến độ, heatmap mức hiểu theo buổi, bảng so sánh lớp, **Làm mới**                                                |
| **Bài giảng**        | CRUD chương trình & bài (nhập HTML + xem trước, fallback Markdown + ảnh Cloudinary); lọc chương trình theo môn → trình độ |
| **Mini game**        | Quay tên, đoán số, lật bài, hộp bí ẩn; **Coding Showdown**, **Truy tìm gián điệp** (realtime Firestore); điểm danh có mặt |

Đường dẫn cũ vẫn hoạt động: `/admin/feedback` → báo cáo HS; `/admin/quiz` và `/admin/scores` → thống kê.

**Màn chiếu Showdown:** `/present/:sessionId` (không cần đăng nhập admin shell).

### Khu học sinh (`/c/:classCode`, không đăng nhập)

- Vào lớp bằng mã, chọn họ tên (lưu trên máy)
- **Phase học:** chọn tên → `/c/:code/learn` — mở thẳng bài resume/buổi hiện tại (HTML/Markdown fallback + ảnh, tab Bài giảng + Bài tập); không còn lưới danh sách buổi mặc định
- **Gửi & chờ duyệt tên dự án** (cuối khóa dạng project)
- **Phase cuối khóa + project:** `/c/:code/project` — form đề xuất / báo cáo tiến độ; navbar **Dự án | Bài giảng** (desktop + bottom nav mobile); xem lại bài tại `/c/:code/lessons`
- **Phase cuối khóa + exam:** `/c/:code/learn` — vẫn xem bài giảng; không có form báo cáo tiến độ dự án
- **Mini game realtime:** banner tham gia Showdown / Spy trên cổng HS (`?showdown=`, `?spy=`)

**Feature flags** (xem [`src/config/features.js`](src/config/features.js)): phản hồi buổi học (`FEATURE_KNOWLEDGE_FEEDBACK_ENABLED`) và Coding Showdown hiện **tắt UI**; Spy bật.

Giao diện responsive, **dark mode**.

## Công nghệ

- React 19, React Router 7, Vite 6, Tailwind CSS 4
- Firebase Auth + Firestore
- marked + DOMPurify, recharts (thống kê), CodeMirror + Pyodide (Coding Showdown)
- Cloudinary (ảnh bài giảng)

## Cấu trúc (rút gọn)

```
src/
  App.jsx                 # routes (HS: /c/:code/learn|project|lessons)
  pages/admin/            # Dashboard, Classes, Students, ReportsHub, Lessons, Analytics, MiniGames
  pages/student/          # StudentPortal, LessonsView, FinalProjectStudentView
  services/               # Firestore: classes, students, reports, knowledgeReports, curriculum
  lib/                    # studentWorkspace, lessonHtml, adminPanelData, analyticsData, …
  ui/components/          # AppShell, LessonContent, BrandLogo, Modal, Toast, …
  state/auth.store.jsx    # auth + kiểm tra admins/{email}
public/                   # logo-wordmark.svg, logo-icon.svg, favicon.svg
firestore.rules           # bảo mật ghi công khai (HS) + admin
scripts/                  # migrate program IDs, lessons HTML, feedback index
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

**Sau khi đổi rules/indexes** (Spy crew, đề xuất dự án, điểm danh mini game): luôn chạy lệnh trên trước khi smoke test production.

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

Migration Markdown → HTML là một bước rollout riêng, mặc định dry-run và bắt buộc có project ID rõ ràng:

```powershell
$env:FIREBASE_PROJECT_ID = 'hungtran-pm'
npm run migrate:lessons:html
# Chỉ sau khi Netlify Preview đã được nghiệm thu và dry-run không có lỗi:
npm run migrate:lessons:html:apply
```

| Script                         | Mục đích                                                             |
| ------------------------------ | -------------------------------------------------------------------- |
| `migrate:programs`             | `python-app-basic` → `python-basic`, …                               |
| `migrate:lessons`              | `lessons[]` embed → subcollection `lessons/`                         |
| `migrate:lessons:html`         | Dry-run chuyển Markdown → HTML đã sanitize; giữ Markdown để rollback |
| `migrate:lessons:presentation` | Dry-run gán preset giao diện `hungtran-v1`; không sửa HTML/Markdown  |
| `migrate:feedback-index`       | Backfill `studentFeedbackIndex` từ `knowledgeReports`                |

Chi tiết backup, idempotency, apply và rollback: [`docs/LESSON_HTML_MIGRATION.md`](docs/LESSON_HTML_MIGRATION.md).
Runbook preset giao diện bài giảng: [`docs/LESSON_PRESENTATION_MIGRATION.md`](docs/LESSON_PRESENTATION_MIGRATION.md).

### 5. Checklist sau deploy

- [ ] Admin: email + Google (trình duyệt thật)
- [ ] HS phase học: chọn tên → `/learn` mở thẳng bài
- [ ] HS final/project: nav **Dự án | Bài giảng**, `/lessons` xem lại bài
- [ ] Cuối khóa: tên dự án → duyệt → báo cáo tiến độ
- [ ] Admin: Báo cáo HS, Thống kê — nút **Làm mới**
- [ ] Upload ảnh bài giảng (Cloudinary)
- [ ] Refresh sâu URL (SPA), dark mode
- [ ] **Mini game:** điểm danh → Quay tên chỉ trong nhóm có mặt
- [ ] **Spy / Showdown:** tạo phòng → HS join → vote / thi đấu → reveal
- [ ] `npm run test` pass (Vitest — logic điểm danh, Showdown, bài giảng)

## Mô hình dữ liệu (chính)

| Collection                                                               | Mô tả                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `classes`                                                                | Lớp, phase, buổi hiện tại, chương trình, `finalMode`                                 |
| `students`                                                               | HS + snapshot tiến độ + tên dự án (pending/approved)                                 |
| `reports`                                                                | Báo cáo tiến độ sản phẩm                                                             |
| `knowledgeReports` + `knowledgeReportReceipts`                           | Phản hồi buổi học                                                                    |
| `studentFeedbackIndex`                                                   | Index `lessonIds[]` theo lớp+HS (1 read cổng HS)                                     |
| `curriculumPrograms` + `…/lessons`                                       | Chương trình; bài dual-format HTML/Markdown trong subcollection hoặc embedded legacy |
| `quizPublicQuestionBanks`, `studentQuizSubmissions`, `studentQuizLatest` | Legacy quiz (không còn UI; collection giữ nguyên)                                    |
| `practiceQuizPublicBanks`, `practiceQuizSubmissions`                     | Legacy ôn tập (không còn UI; collection giữ nguyên)                                  |
| `showdownSessions`, `spySessions`, `minigameAttendance`                  | Mini game realtime & điểm danh                                                       |
| `admins`                                                                 | Quyền admin (email → `active`)                                                       |

Ghi từ cổng học sinh được kiểm soát bởi `firestore.rules` (batched write cho receipt/snapshot).

## Scripts npm

| Lệnh                          | Mô tả                                                    |
| ----------------------------- | -------------------------------------------------------- |
| `npm run dev`                 | Dev server                                               |
| `npm run build`               | Build production                                         |
| `npm run preview`             | Xem bản build local                                      |
| `npm run test`                | Chạy Vitest (logic thuần)                                |
| `npm run test:migration`      | Chạy unit test sanitizer/planner migration lesson HTML   |
| `npm run test:rules`          | Chạy Firestore Rules tests qua emulator (cần Java/JDK)   |
| `npm run verify`              | Chạy test rồi build production                           |
| `npm run ci`                  | Chạy unit tests, rules tests, build và audit gate        |
| `npm run audit:security`      | Alias audit đầy đủ                                       |
| `npm run audit:security:gate` | Audit chỉ fail khi có high/critical                      |
| `npm run audit:security:full` | Audit đầy đủ, có thể fail vì moderate tooling đã ghi chú |
| `npm run deploy:firestore`    | Deploy rules + indexes                                   |
| `npm run migrate:*`           | Xem bảng migrate ở trên                                  |

## Bảo trì & nâng cấp

- Ghi chú bảo trì: [`docs/MAINTENANCE.md`](docs/MAINTENANCE.md)
- Runbook migrate lesson HTML: [`docs/LESSON_HTML_MIGRATION.md`](docs/LESSON_HTML_MIGRATION.md)
- Runbook migrate preset giao diện: [`docs/LESSON_PRESENTATION_MIGRATION.md`](docs/LESSON_PRESENTATION_MIGRATION.md)
- Ghi chú audit bảo mật: [`docs/SECURITY_AUDIT_NOTES.md`](docs/SECURITY_AUDIT_NOTES.md)
- Checklist smoke test: [`docs/SMOKE_TEST_CHECKLIST.md`](docs/SMOKE_TEST_CHECKLIST.md)
- Hướng dẫn restore backup thủ công: [`docs/RESTORE_BACKUP.md`](docs/RESTORE_BACKUP.md)
- Trang **Admin → Cài đặt** có Health panel và nút tải backup JSON cho lớp/học sinh/chương trình.
