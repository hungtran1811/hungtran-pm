# Restore Backup

Backup JSON trong trang `Cài đặt` là bản xuất dữ liệu để đối chiếu và phục hồi thủ công. Hiện chưa có import UI tự động để tránh ghi nhầm hàng loạt vào production.

## Nội dung backup

File backup có schema `hungtran-pm-admin-backup-v1` và thường gồm:

- `classes`: danh sách lớp.
- `students`: danh sách học sinh.
- `curriculumPrograms`: chương trình, lesson index và lesson detail nếu đọc được.
- `exportedAt`: thời điểm xuất file.

## Quy trình phục hồi an toàn

1. Tạo bản backup mới từ production trước khi phục hồi.
2. Mở file backup cũ và xác định đúng phần cần khôi phục.
3. Ưu tiên phục hồi thủ công từng nhóm nhỏ trong Firebase Console hoặc bằng script riêng có `--dry-run`.
4. Không ghi đè toàn bộ collection nếu chưa kiểm tra schema hiện tại.
5. Sau khi phục hồi, chạy smoke test:
   - Admin mở lớp/học sinh/bài giảng liên quan.
   - Student vào đúng lớp và mở bài hiện tại.
   - Nếu khôi phục quiz/feedback/report, kiểm tra lại trang điểm số và báo cáo.

## Nguyên tắc khi viết script restore

- Script phải mặc định là dry-run.
- Script phải yêu cầu `FIREBASE_PROJECT_ID` rõ ràng, không tự đoán production nếu thiếu biến môi trường.
- Mỗi write batch nên giới hạn dưới 400 operations.
- Log rõ document path sẽ tạo/cập nhật/xóa.
- Không đổi schema production trong lúc restore; nếu cần migration thì viết migration riêng.

## Không làm trong phase này

- Chưa thêm nút import/restore trong Admin UI.
- Chưa tự động merge dữ liệu phức tạp giữa backup và production.
- Chưa restore file upload ngoài Firestore.
