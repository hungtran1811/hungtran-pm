# Smoke Test Checklist

Chạy sau khi update dependency, sửa rules/indexes, hoặc refactor service/page lớn.

## Admin

- Đăng nhập email/password ở `/admin/login`.
- Mở Dashboard, bấm `Làm mới`.
- Chỉnh nhanh buổi hiện tại và phase cho một lớp test.
- Mở `Lớp học`, tạo/sửa lớp test, copy link lớp.
- Mở `Học sinh`, tạo/sửa học sinh test, duyệt hoặc từ chối tên dự án.
- Mở `Bài giảng`, tạo/sửa bài, preview HTML/Markdown, upload ảnh Cloudinary nếu có env. Lọc chương trình bằng tìm kiếm và chip môn → trình độ.
- Mở `Cài đặt`, tải backup JSON và kiểm tra thao tác cache/bản nháp.

## Student Portal

- Vào `/c/{classCode}`, chọn học sinh.
- **Phase học:** redirect `/learn`, mở thẳng bài resume/buổi hiện tại; không thấy lưới danh sách buổi mặc định; tab Bài giảng + Bài tập (không còn ôn tập/quiz).
- **Phase final/project:** redirect `/project` — form đề xuất hoặc báo cáo; navbar **Dự án | Bài giảng** (desktop) và bottom nav (mobile) chuyển trang đúng.
- **`/lessons`:** xem lại bài giảng; nút quay về **Dự án** hoạt động.
- Phản hồi buổi học: chỉ test nếu `FEATURE_KNOWLEDGE_FEEDBACK_ENABLED = true` (hiện tắt UI).
- Với lớp final/project: gửi tên dự án, admin duyệt, học sinh gửi báo cáo tiến độ và link sản phẩm.
- **Nộp bài Drive** (khi `FEATURE_DRIVE_SUBMISSION_ENABLED` và đã set env Netlify): `/c/{classCode}/submit` — chọn buổi, file hợp lệ có progress, file lên Drive, Firestore `submissions` có metadata; file `.exe` / lớp đóng / quá 150MB bị từ chối; mobile 375px + Retry. HS thấy buổi đã nộp + giờ + tên file, **không** tải file. Lớp cuối khóa (project): HS thấy nhắc nộp cả báo cáo (tab Dự án) lẫn file. Lớp đang học: chỉ nộp file. Admin `/admin/reports`: lớp cuối khóa hiện báo cáo + file; lớp đang học chỉ file nộp. Chi tiết: `docs/student-submission.md`.

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
