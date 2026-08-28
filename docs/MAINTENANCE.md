# Maintenance Notes

Tài liệu này gom các việc cần nhớ khi nâng cấp/bảo trì `hungtran-pm`.

## Ưu tiên bảo trì

1. Chạy kiểm tra nền:

```bash
npm ci
npm test
npm run test:rules
npm run build
npm run audit:security:gate
```

2. Dùng Node 22 theo `.nvmrc`. Firestore Rules tests cần Java/JDK 21 vì chạy Firebase emulator.
3. Ưu tiên update patch/minor cho dependency runtime trước. Các major lớn như Vite, Vitest, Marked, Firebase Admin nên đi bằng branch riêng và smoke test đủ.
4. Sau mọi thay đổi `firestore.rules` hoặc `firestore.indexes.json`, deploy rules/indexes trước khi smoke test production:

```bash
npm run deploy:firestore
```

## Firestore Write Contracts

Các write từ cổng học sinh phải giữ đúng shape vì `firestore.rules` kiểm tra bằng `getAfter()` và field whitelist.

- Phản hồi buổi học phải ghi cùng batch:
  - `knowledgeReports/{classCode}__{studentId}__{lessonId}`
  - `knowledgeReportReceipts/{sameId}`
  - `knowledgeReportStudentSummaries/{sameId}`
  - `studentFeedbackIndex/{classCode}__{studentId}` với `lessonIds: arrayUnion(lessonId)`
- Báo cáo tiến độ dự án phải ghi cùng batch:
  - `reports/{generatedId}`
  - `students/{studentId}` với `latestReportId` trỏ đúng report mới
- Quiz/ôn tập: collection legacy vẫn nằm trong `firestore.rules` để bài nộp cũ an toàn. App không còn UI ghi mới.
- Mini-game **Vụ án** đã bỏ khỏi app; không còn rules `caseSessions` (feature chưa từng deploy production).

## Refactor Rules

- Chỉ tách file lớn sau khi đã có test bao quanh hành vi liên quan.
- Tách theo hành vi, không theo “cho file ngắn lại”. Ví dụ: question engine, scoring, session state machine, editor form, presentation UI.
- Không đổi schema production nếu chưa có script migrate/dry-run và rollback note.
- Với Showdown/Spy, luôn test bằng ít nhất 2 browser/tab: admin điều khiển, học sinh join và gửi dữ liệu.

## Backup Nhẹ

Trang `Cài đặt` có nút tải backup JSON gồm lớp, học sinh và chương trình/bài giảng. Đây là bản xuất dữ liệu để đối chiếu/phục hồi thủ công, chưa phải cơ chế restore tự động.

## Migration bài giảng HTML

- Dùng [`LESSON_HTML_MIGRATION.md`](LESSON_HTML_MIGRATION.md) làm runbook chính thức.
- Lệnh migration mặc định dry-run, bắt buộc `FIREBASE_PROJECT_ID`, abort toàn bộ apply nếu plan có lỗi và tạo `.backups/*.json` trước mọi write.
- Không xóa trường Markdown trong chu kỳ rollout đầu; rollback chỉ chuyển `contentFormat` về `markdown` cho lesson còn nguồn Markdown và không làm trống bài HTML-only.
- Chạy `npm run test:migration` cùng bộ kiểm tra trước deploy.
- Bài mới trong trang Bài giảng để trống HTML; nhập file `.html` rồi xem trước đúng như file gốc. Không viết migration để bọc lại HTML cũ thành skeleton.
