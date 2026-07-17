# Smoke test — Cổng học sinh & Mini Games (đợt thu hẹp)

Checklist sau khi deploy `firestore:rules` hoặc sửa Spy / Lật bài.

## Chuẩn bị

```bash
npm ci
npm test
npm run test:rules
npm run build
npx firebase-tools@latest deploy --only firestore:rules
```

---

## Cổng học sinh `/c/{mã lớp}`

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Mở mã lớp trên điện thoại **không** đăng nhập admin | Vào được màn chọn tên (không EmptyState quyền) |
| 2 | Lớp thiếu field `hidden` trên Firestore | Vẫn đọc được nếu `status == active` |
| 3 | Tab Báo cáo / bổ sung dự án | **Không** thấy mục nộp file code theo buổi |
| 4 | Sau khi chọn tên (giai đoạn học) | **Không** banner next-action, **không** card Ôn tập/Quiz/Bài đã mở, **không** Checklist học tập; vào thẳng bài giảng |
| 5 | Form cuối bài | **Không** form «Phản hồi buổi học» |
| 6 | Lớp `final` + project | Tab **Quy trình** (5 bước + hướng dẫn ý tưởng/làm); **Báo cáo** có gợi ý theo stage; **Bài giảng** xem lại được; **Hướng dẫn nộp** vẫn có |

---

## Admin — Thống kê `/admin/analytics`

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Tải thống kê | 3 StatCards (lớp đang mở · HS cần hỗ trợ · mục chưa nộp), **không** Line/Bar chart |
| 2 | Bảng lớp | Có badge `Cần hỗ trợ` / `Chưa nộp báo cáo` / `OK`; bấm mã lớp → `/admin/reports` |
| 3 | `/admin/feedback` | Redirect sang báo cáo tiến độ (`/admin/reports?tab=progress`) |
| 4 | Báo cáo học sinh trên nav | **Có** — báo cáo tiến độ cuối khóa vẫn dùng; **không** tab phản hồi buổi học |
| 5 | Classes tab Lưu trữ | **Không** panel dọn file code |

---

## Lật bài (admin)

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Chọn lớp, điểm danh, vào Lật bài | Hiện đủ lá |
| 2 | Bấm **Lật ngẫu nhiên** | Animation chạy, một lá lật, không kẹt / không reset giữa chừng |
| 3 | Xáo bài / Làm mới | Hoạt động bình thường |

---

## Truy tìm gián điệp (Spy)

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Điểm danh: bỏ tick 1 HS → tạo phòng | HS đó **không** thấy nút Tham gia trên portal |
| 2 | HS có mặt join qua portal | Admin thấy **thẻ học sinh** (Trong phòng / Chưa vào) |
| 3 | Bắt đầu ván | HS chạm card → ẩn/hiện từ; admin thẻ hiện vai trò + từ khóa (GM only) |
| 4 | Hết lượt mô tả | Không tự vote — GV bấm **Mở bỏ phiếu** |
| 5 | Vote không hòa + Chốt vote | Loại đúng người có nhiều phiếu nhất |
| 6 | Vote hòa (≥2 người cùng phiếu cao) + Chốt | Vào **Biện luận hòa** — mỗi người ~60s; TV + điện thoại hiện tên |
| 7 | Hết biện luận → **Mở đổi phiếu** | HS có thể đổi phiếu; GV **Chốt sau biện luận** |
| 8 | Vẫn hòa sau đổi phiếu (hoặc không đổi) | **Bốc thăm** — toast + banner TV/HS: “Hòa … đã bốc thăm loại X” |

**Lưu ý:** HS phải nằm trong điểm danh (`presentStudentIds`) và phòng đang `lobby` mới join được. Deep link `?spy=` cũng bị chặn nếu không có mặt.

---

## Phi hành đoàn (Crew mode)

| # | Bước | Kỳ vọng |
|---|------|---------|
| 1 | Tạo phòng với mode **Phi hành đoàn** | Không hiện picker từ khóa; có cấu hình số nhiệm vụ / người |
| 2 | Bắt đầu ván | HS thấy vai trò + panel mini-game; TV hiện thanh tiến độ đội |
| 3 | Dân hoàn thành 1-2 nhiệm vụ | `taskProgress` tăng; thanh đội chỉ cộng nhiệm vụ của dân |
| 4 | Gián điệp bấm **Phá hệ thống** | TV + điện thoại hiện banner đỏ; panel nhiệm vụ bị khóa |
| 5 | Một HS còn sống bấm **Report** | Mở ngay vòng vote; người đó bị khóa Report cho cả ván |
| 6 | GV mở **Họp khẩn** | Cũng vào vote; không tiêu hao lượt Report của HS |
| 7 | Vote xong nhưng chưa kết thúc | Session quay lại `playing`, vẫn giữ `reportedByIds` |
| 8 | Dân hoàn thành đủ tiến độ | Nút **Kết thúc — công bố** bật; bấm xong chỉ hiện phe thắng + gián điệp |

**Lưu ý:** Sabotage có cooldown; gián điệp không thể kill trực tiếp. Loại người chỉ qua vote.

---

## Ngoài phạm vi đợt này

- Quay tên, Đoán số, Hộp bí ẩn (đã ổn)
- Coding Showdown → plan riêng
- Olympia đã gỡ khỏi codebase
- Wheel vẫn tắt flag
