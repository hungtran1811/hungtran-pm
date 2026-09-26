# Smoke Test Checklist

Chạy sau khi update dependency, sửa rules/indexes, hoặc refactor service/page lớn.

## Env production (không ghi secret)

Kiểm tra đã có trên Netlify (và `.env` local khi chạy functions):

- Nộp bài: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`, `FIREBASE_SERVICE_ACCOUNT`
- Tài nguyên bài giảng: `GOOGLE_DRIVE_MATERIALS_ROOT_FOLDER_ID` — thiếu → upload đầu buổi / HTML overflow 502/503
- HTML bài giảng >750 KiB dùng cùng thư mục materials (`LessonHtml/{programId}`). Không thêm collection Firestore; session tái sử dụng `materialUploadSessions` — **không** cần deploy rules nếu chưa đổi `firestore.rules`.
- Tuỳ chọn: `VITE_SENTRY_DSN` (báo lỗi production)

Admin → Cài đặt → **Kiểm tra Drive** để xác nhận cấu hình (không lộ tên biến).

## Admin

- Đăng nhập email/password ở `/admin/login`.
- Mở Dashboard, bấm `Làm mới`. Cột sản phẩm / thiếu file theo **mã buổi L** (L03, không B03). Nếu thấy «dữ liệu cache ~90 giây» hoặc lớp Drive lỗi — bấm Làm mới.
- Chỉnh nhanh buổi hiện tại và phase cho một lớp test (badge Đổi buổi hiện Lnn).
- Mở `Lớp học`, tạo/sửa lớp test, copy link lớp.
- Mở `Học sinh`, tạo/sửa học sinh test, duyệt hoặc từ chối tên dự án.
- Mở `Bài giảng`, tạo/sửa bài, preview HTML/Markdown, upload ảnh Cloudinary nếu có env. Lọc chương trình bằng tìm kiếm và chip môn → trình độ. Import HTML ~1.2 MiB: Lưu thành công + badge Drive; bài ~200 KiB vẫn Firestore. Restart `dev:functions` nếu handler lesson-html chưa có.
- **Tài nguyên buổi:** upload 1 file allowlist ≤100MB; đóng editor không mất file; học sinh thấy nút tải ở đầu buổi.
- Mở `Cài đặt`, tải backup JSON, xóa cache lớp/HS/dashboard, Kiểm tra Drive.

## Student Portal

- Vào `/c/{classCode}`, chọn học sinh.
- **Phase học:** redirect `/learn`, mở thẳng bài resume/buổi hiện tại; không thấy lưới danh sách buổi mặc định; tab Bài giảng + Bài tập (không còn ôn tập/quiz).
- **Phase final/project:** redirect `/project` — form đề xuất hoặc báo cáo; navbar **Dự án | Bài giảng** (desktop) và bottom nav (mobile) chuyển trang đúng.
- **`/lessons`:** xem lại bài giảng; nút quay về **Dự án** hoạt động.
- Phản hồi buổi học: chỉ test nếu `FEATURE_KNOWLEDGE_FEEDBACK_ENABLED = true` (hiện tắt UI).
- Với lớp final/project: gửi tên dự án, admin duyệt; tab **Báo cáo & nộp** — chọn buổi chung, viết báo cáo rồi upload file (bổ sung dự án nằm dưới bước upload).
- **Nộp bài Drive** (khi `FEATURE_DRIVE_SUBMISSION_ENABLED` và đã set env Netlify): `/c/{classCode}/submit` hoặc bước 2 trong **Báo cáo & nộp** — chọn buổi, file hợp lệ có progress, file lên Drive, Firestore `submissions` có metadata; file `.exe` / lớp đóng / quá 150MB bị từ chối; mobile 375px + Retry. HS thấy buổi đã nộp + giờ + tên file, **không** tải file. Lớp cuối khóa (project): đủ = báo cáo + file cùng buổi. Lớp đang học: chỉ nộp file. Admin `/admin/reports`: lớp cuối khóa hiện báo cáo + file; lớp đang học chỉ file nộp. Chi tiết: `docs/student-submission.md`.

## Reports

- Admin mở `Báo cáo học sinh`, lọc lớp/buổi, copy báo cáo.
- Admin reset phản hồi một học sinh và xác nhận học sinh gửi lại được (khi bật lại feedback).
- Admin mở `Thống kê`, kiểm tra chart không trắng và bộ lọc lớp hoạt động.

## Mini Game

- Điểm danh học sinh có mặt trong `Mini game`.
- Quay tên/đoán số/lật bài/hộp bí ẩn dùng đúng danh sách có mặt.
- Showdown: tạo phòng, mở lobby, học sinh join qua banner/link, nộp câu trả lời, admin chấm/reveal/next (khi bật flag).
- Spy: tạo phòng, mở lobby, học sinh join, start game, vote, reveal, finish/restart.

## Production Readiness

- `npm run ci` pass.
- `npm run audit:security:gate` không có cảnh báo mới ngoài các mục đã ghi nhận.
- Nếu đổi rules/indexes: `npm run deploy:firestore` đã chạy.
