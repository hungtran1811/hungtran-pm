# Lesson presentation preset migration

Migration này chỉ gán `presentationPreset`; không sửa hoặc xóa HTML, Markdown hay metadata của bài học. Script xử lý cả `curriculumPrograms/{id}.lessons[]` và subcollection `curriculumPrograms/{id}/lessons/{lessonId}`.

Trình đọc bài giảng hiện luôn hiển thị HTML như file gốc (iframe giữ CSS/class). Preset `hungtran-v1` không còn áp giao diện chung. Không dùng migration này để rewrite HTML thành khung mẫu.

## Dry-run

Dùng Node 22 và Application Default Credentials. Luôn truyền project rõ ràng:

```powershell
$env:FIREBASE_PROJECT_ID = 'your-exact-project-id'
npm run migrate:lessons:presentation
```

Dry-run là mặc định và không tạo backup hay ghi Firestore. Một bài chỉ được đề xuất chuyển sang `hungtran-v1` khi `contentFormat` đang là `html` và mọi phần HTML không rỗng vẫn còn nội dung tĩnh sau khi áp dụng managed sanitizer. Bài chỉ tạo nội dung bằng JavaScript sẽ được bỏ qua.

Có thể giới hạn một lần chạy để nghiệm thu hoặc giữ tổng số write trong một batch nguyên tử:

```powershell
node scripts/migrate-lesson-presentation.js --program=web-basic
node scripts/migrate-lesson-presentation.js --program=web-basic --lesson=lesson-1
```

`--program` và `--lesson` có thể lặp lại. Script dừng apply nếu cần hơn 350 document writes hoặc embedded program vượt ngưỡng an toàn 900 KiB.

## Apply và rollback

Sau khi đã nghiệm thu Netlify Preview và dry-run không có lỗi:

```powershell
npm run migrate:lessons:presentation:apply
```

Trước write đầu tiên, script ghi snapshot có type tags vào `.backups/lesson-presentation-*.json`; Timestamp, GeoPoint, DocumentReference và bytes không bị biến thành JSON không rõ kiểu. Mọi write nằm trong một batch nguyên tử và mang `lastUpdateTime` precondition. Nếu admin sửa dữ liệu sau dry-run/planning, toàn batch bị từ chối thay vì ghi đè snapshot cũ. Chạy lại sẽ không phát sinh thay đổi cho bài đã có `hungtran-v1`.

Rollback chỉ chuyển preset về `legacy-document` và vẫn giữ HTML managed:

```powershell
npm run migrate:lessons:presentation:rollback
npm run migrate:lessons:presentation:rollback:apply
```

Không chạy lệnh `:apply` trong CI hoặc Netlify build. Giữ renderer legacy ít nhất một chu kỳ phát hành.
