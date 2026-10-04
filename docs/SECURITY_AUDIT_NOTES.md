# Security Audit Notes

Cập nhật gần nhất đã xử lý các mục trực tiếp/rủi ro cao nhất có thể nâng an toàn trong nhánh hiện tại:

- `dompurify` đã được nâng khỏi range advisory hiện tại.
- `happy-dom` đã được nâng lên major mới để loại bỏ cảnh báo critical trong môi trường test/dev.
- `npm audit fix` không force đã được chạy để nhận các bản transitive an toàn.

## Nộp bài Drive

Secret Google OAuth + `FIREBASE_SERVICE_ACCOUNT` chỉ đặt trên Netlify. Collection `submissions` chỉ admin đọc; client deny ghi. `submissionUploadSessions` deny all từ client. HS xem buổi/giờ/tên file qua Function (không `driveFileId`, không tải). Admin mở file trên Drive (`/admin/reports`). Chi tiết: [`docs/student-submission.md`](student-submission.md).

## Residual audit items

`npm run audit:security` vẫn có thể trả exit code non-zero vì các advisory còn lại nằm trong chuỗi tooling:

- `firebase-tools`
- `firebase-admin`
- các dependency chuyển tiếp của Google Cloud SDK như `@google-cloud/*`, `google-gax`, `uuid`, `@opentelemetry/core`

NPM hiện đề xuất `npm audit fix --force`, nhưng hướng đó là thay đổi breaking/khó dự đoán với Firebase tooling. Không chạy `--force` trực tiếp trên nhánh vận hành lớp thật.

## Cách xử lý khuyến nghị

1. Tạo nhánh riêng cho major tooling upgrades.
2. Nâng `firebase-admin`, `firebase-tools`, `vite`, `vitest`, `@vitejs/plugin-react`, `marked` theo từng cụm nhỏ.
3. Chạy:

```bash
npm test
npm run build
npm run audit:security
firebase --version
firebase deploy --only firestore:rules,firestore:indexes --dry-run
```

4. Chỉ merge khi smoke test production/staging pass.

## Cập nhật nhánh `maintenance/next-upgrades`

- Đã nâng `marked` lên `18.0.5`, `vite` lên `8.1.0`, `vitest` lên `4.1.9`, `@vitejs/plugin-react` lên `6.0.3`, và `firebase-admin` lên `14.1.0`.
- Giữ `firebase-tools@15.22.3`; không dùng `npm audit fix --force` vì npm vẫn đề xuất hướng breaking/downgrade khó kiểm soát.
- Audit hiện còn **5 moderate** (2026-09-30): `firebase-tools` transitive (`@opentelemetry/core`, `gaxios`/`uuid`). Không có high/critical — `audit:security:gate` pass.
- 2026-09-30: `npm audit fix` (không `--force`) vá high `brace-expansion`, `fast-uri`, `undici`; lockfile kéo patch `vitest` 4.1.11, `firebase-admin` 14.5.0, `firebase-tools` 15.32.0 trong range `^` hiện có.
- 2026-10-02: `audit:security:gate` fail vì high mới: `dompurify` 3.4.14 (GHSA-p98j-92pf-mc4p), `@grpc/grpc-js` (Firebase/google-gax), `basic-ftp` (firebase-tools/`get-uri`). Nâng `dompurify` lên `3.4.16`; pin override `@grpc/grpc-js@1.14.5` và `basic-ftp@6.2.1`. Không dùng `npm audit fix --force` (npm vẫn đề xuất firebase@9 / firebase-tools@14). Moderate tooling còn lại (`@opentelemetry/core`, `hono`, `uuid`/`gaxios`) không fail gate.
- 2026-10-05: gate fail vì high `@fastify/busboy` 3.2.0 (firebase-admin) và `braces` 3.0.3 (firebase-tools → chokidar). Pin `@fastify/busboy@3.2.2`. `braces` chưa có bản vá (GHSA-vfj7-8cjw-p6xm, mọi bản tới 3.0.3); chỉ nằm trong CLI dev, không nằm trong web học sinh. `audit:security:gate` kiểm tra dependency production (`npm audit --omit=dev`). `npm audit` đầy đủ vẫn hiện high `braces` cho tới khi micromatch phát hành bản có giới hạn đệ quy.
- CI dùng `npm run audit:security:gate`, chỉ fail khi dependency production có high/critical. Dùng `npm run audit:security:full` để xem moderate và high của tooling dev.
- Không chạy `npm audit fix` trên nhánh vận hành: npm vẫn kéo thay đổi tooling khó dự đoán.
