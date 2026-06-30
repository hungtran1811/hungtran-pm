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
- Quiz kiểm tra:
  - Học sinh ghi `studentQuizSubmissions/{generatedId}` ở trạng thái pending
  - Ghi/merge `studentQuizLatest/{classCode}__{studentId}__{lessonId}`
  - Đáp án đúng chỉ nằm ở `quizQuestionBanks`, học sinh không đọc collection này
- Ôn tập:
  - Ghi `practiceQuizSubmissions/{classCode}__{studentId}__{lessonId}`
  - Public bank ở `practiceQuizPublicBanks`, đáp án ở `practiceQuizAnswerBanks`

## Refactor Rules

- Chỉ tách file lớn sau khi đã có test bao quanh hành vi liên quan.
- Tách theo hành vi, không theo “cho file ngắn lại”. Ví dụ: question engine, scoring, session state machine, editor form, presentation UI.
- Không đổi schema production nếu chưa có script migrate/dry-run và rollback note.
- Với Showdown/Spy, luôn test bằng ít nhất 2 browser/tab: admin điều khiển, học sinh join và gửi dữ liệu.

## Backup Nhẹ

Trang `Cài đặt` có nút tải backup JSON gồm lớp, học sinh và chương trình/bài giảng. Đây là bản xuất dữ liệu để đối chiếu/phục hồi thủ công, chưa phải cơ chế restore tự động.
