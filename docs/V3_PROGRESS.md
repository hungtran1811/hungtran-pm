# Tiến độ Up Level V3

Cập nhật 18/11/2026. Các phần đang dùng được giữ để chạy tiếp. Thư viện bài cũ cho học sinh chưa làm.

## Đang chạy

- Up Level giữ `studentId` và PIN cũ. Học sinh lớp mới không bị đưa về màn tạo PIN nếu đã có mã.
- Học sinh không tự đặt lại PIN. Lần đầu nhập 4 số. Giáo viên thấy `••••`, bấm vào để xem hoặc đổi PIN.
- Trang quản trị không tự hỏi PIN vài giây một lần. Tải lại trang để thấy PIN học sinh vừa tạo.
- Hộp thoại không kéo focus về nút đóng khi đang gõ.
- Thẻ lớp chỉ còn **Up Level** và **Hoàn thành**. Bấm thẻ mở chi tiết để xem, sửa, copy link hoặc xoá.
- Up Level ghi nhận học sinh được chọn đã học xong lớp cũ và đang học lớp mới.

## Dừng trước thư viện bài cũ

Mã kho bài giảng nằm trên server và có test, không có nút trên giao diện, chưa chạy khi bấm Up Level. Học sinh chưa có mục **Bài học → Đã hoàn thành** để mở lại bài lớp cũ.

Việc tiếp theo: Up Level tự lưu bản bài đã dạy, rồi học sinh đọc lại ở chế độ chỉ xem.

## Ngoài phạm vi commit này

Không đổi `PIN_PEPPER`, không xoá dữ liệu cũ. Function trên mạng vẫn cần biến `PIN_PEPPER`; thiếu biến thì lớp dùng PIN báo "Máy chủ chưa cấu hình PIN."
