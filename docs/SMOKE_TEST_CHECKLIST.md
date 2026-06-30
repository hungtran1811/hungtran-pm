# Smoke Test Checklist

Chạy sau khi update dependency, sửa rules/indexes, hoặc refactor service/page lớn.

## Admin

- Đăng nhập email/password ở `/admin/login`.
- Mở Dashboard, bấm `Làm mới`.
- Chỉnh nhanh buổi hiện tại và phase cho một lớp test.
- Mở `Lớp học`, tạo/sửa lớp test, copy link lớp.
- Mở `Học sinh`, tạo/sửa học sinh test, duyệt hoặc từ chối tên dự án.
- Mở `Bài giảng`, tạo/sửa bài, preview Markdown, upload ảnh Cloudinary nếu có env.
- Mở `Cài đặt`, kiểm tra Health panel và tải backup JSON.

## Student Portal

- Vào `/c/{classCode}`, chọn học sinh.
- Mở bài học hiện tại, xem Markdown/ảnh/lightbox.
- Gửi phản hồi buổi học, reload trang và xác nhận trạng thái đã gửi.
- Làm ôn tập MCQ nếu bài có practice quiz.
- Làm quiz kiểm tra nếu bài có exam quiz; thử nộp, reload, kiểm tra trạng thái đã nộp.
- Với lớp final/project: gửi tên dự án, admin duyệt, học sinh gửi báo cáo tiến độ và link sản phẩm.

## Scores & Reports

- Admin mở `Báo cáo học sinh`, lọc lớp/buổi, copy báo cáo.
- Admin reset phản hồi một học sinh và xác nhận học sinh gửi lại được.
- Admin mở `Điểm số`, xem bảng quiz/ôn tập, reset lượt làm quiz nếu cần.
- Admin mở `Thống kê`, kiểm tra chart không trắng và bộ lọc lớp hoạt động.

## Mini Game

- Điểm danh học sinh có mặt trong `Mini game`.
- Quay tên/đoán số/lật bài/hộp bí ẩn dùng đúng danh sách có mặt.
- Showdown: tạo phòng, mở lobby, học sinh join qua banner/link, nộp câu trả lời, admin chấm/reveal/next.
- Spy: tạo phòng, mở lobby, học sinh join, start game, vote, reveal, finish/restart.

## Production Readiness

- `npm test` pass.
- `npm run build` pass.
- `npm run audit:security` không có cảnh báo mới ngoài các mục đã ghi nhận.
- Nếu đổi rules/indexes: `npm run deploy:firestore` đã chạy.
