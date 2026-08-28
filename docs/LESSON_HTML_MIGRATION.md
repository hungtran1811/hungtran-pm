# Lesson HTML Migration Runbook

Migration này chuyển nội dung Markdown cũ sang HTML tĩnh đã sanitize, đồng thời giữ nguyên toàn bộ Markdown và metadata để fallback/rollback. Script xử lý cả `curriculumPrograms/{id}.lessons[]` dạng embedded và `curriculumPrograms/{id}/lessons/{lessonId}` dạng subcollection.

## Soạn hoặc nhập HTML trong trang quản trị

- Editor nhận file `.html`/`.htm` hoặc đoạn HTML dán tay, rồi xem trước đúng như file gốc (iframe `srcdoc` giữ CSS, class và inline style). Preview quản trị và màn học sinh dùng cùng renderer. Nội dung chỉ được ghi khi bấm **Áp dụng** rồi **Lưu thay đổi**.
- Không điền sẵn khung mẫu; không rewrite bài cũ thành skeleton.
- Script, iframe nhúng, form, SVG, event handler và URL nguy hiểm vẫn bị loại khi hiển thị. Tài liệu chỉ tạo nội dung bằng JavaScript sẽ bị từ chối vì sau khi bỏ script không còn gì để hiển thị.
- Bài cũ có HTML lỗi chỉ gồm khoảng trắng sẽ tự đọc Markdown còn giữ lại. Sau khi frontend mới được deploy, mở tab **Bài giảng** và nhập lại file gốc để thay thế bản HTML lỗi.
- Tổng document Firestore sau tuần tự hóa phải không vượt 750 KiB.

## Điều kiện trước khi chạy

- Dùng Node 22 theo `.nvmrc`.
- Đăng nhập bằng Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` hoặc `gcloud auth application-default login`).
- Luôn chỉ định chính xác project. Script migration sẽ từ chối chạy nếu thiếu `FIREBASE_PROJECT_ID`.
- Deploy và nghiệm thu Netlify Preview với dual-reader trước khi migrate production.

PowerShell:

```powershell
$env:FIREBASE_PROJECT_ID = 'hungtran-pm'
npm run inspect:lessons -- python-basic
npm run migrate:lessons:html
```

`migrate:lessons:html` mặc định là dry-run. Lệnh đọc toàn bộ chương trình, log path/định dạng/kích thước và không tạo backup hay ghi Firestore.

## Đọc kết quả dry-run

- `CHANGE`: lesson hợp lệ sẽ được thêm `contentFormat: "html"`, `lectureHtml`, `exerciseHtml`.
- `SKIP already-html`: đã migrate, chạy lặp không tạo thay đổi.
- `SKIP no-markdown-source`: không có trường Markdown nguồn để chuyển.
- `ERROR`: dữ liệu không hợp lệ, format lạ, lỗi convert hoặc lesson vượt 750 KiB.
- `documentWrites`: số document write dự kiến; một mảng embedded được tính là một write.

Record khai báo `contentFormat: "html"` chỉ hợp lệ khi cả `lectureHtml` và `exerciseHtml` đều là string (string rỗng vẫn hợp lệ). Record chỉ có một trong hai trường được báo malformed và chặn toàn bộ apply để khớp invariant của app.

Nguồn bài giảng theo thứ tự `lectureMarkdown` → `contentMarkdown` → `content`; nguồn bài tập theo thứ tự `exerciseMarkdown` → `exercise`. Marked dùng `gfm: true`, `breaks: true`, sau đó chạy cùng sanitizer/allowlist với editor và màn học sinh. Script không xóa hay ghi đè các trường Markdown.

Nếu có bất kỳ `ERROR`, chế độ apply dừng toàn bộ trước khi tạo backup hoặc ghi dữ liệu; không có trạng thái migrate dở dang do lỗi lập kế hoạch.

## Apply sau khi nghiệm thu

Chỉ chạy khi dry-run không có lỗi và đã xác nhận đúng Firebase project:

```powershell
npm run migrate:lessons:html:apply
npm run inspect:lessons -- python-basic
npm run migrate:lessons:html
```

Trước write đầu tiên, script xuất snapshot JSON thô vào `.backups/lessons-html-<project>-convert-<timestamp>.json`. Thư mục này được gitignore; sao chép file backup sang nơi bảo mật trước khi kết thúc đợt phát hành. Các write dùng batch 350 operations, dưới giới hạn 400 của runbook vận hành.

Dry-run cuối phải báo `changes=0` cho dữ liệu vừa chuyển và `already-html` tương ứng.

## Rollback

Rollback chỉ đổi `contentFormat` từ `html` về `markdown` khi lesson còn ít nhất một trường Markdown nguồn; bài HTML-only được skip để không trở thành bài trống. `lectureHtml` và `exerciseHtml` vẫn được giữ để có thể roll-forward lại. Xem trước rồi mới apply:

```powershell
npm run migrate:lessons:html:rollback
npm run migrate:lessons:html:rollback:apply
npm run inspect:lessons -- python-basic
```

Apply rollback cũng tạo một backup pre-write riêng trong `.backups/`. File backup là dữ liệu đối chiếu/phục hồi thủ công, không phải công cụ restore tự động.

## Thứ tự rollout production

1. Deploy Netlify Preview với dual-reader, chưa chạy migration.
2. Smoke test editor/preview, màn học sinh, HTML mới và Markdown fallback.
3. Chạy inspect và conversion dry-run trên đúng production project; xử lý toàn bộ lỗi.
4. Backup hiện trạng, deploy frontend/rules đã nghiệm thu.
5. Chạy apply một lần, inspect lại và hard refresh các chương trình đại diện.
6. Giữ các trường Markdown và dependency `marked` ít nhất một chu kỳ phát hành.

Không chạy `:apply` hoặc `:rollback:apply` trong CI, Netlify build hay trên project chưa được xác nhận thủ công.
