# Security Audit Notes

Cập nhật gần nhất đã xử lý các mục trực tiếp/rủi ro cao nhất có thể nâng an toàn trong nhánh hiện tại:

- `dompurify` đã được nâng khỏi range advisory hiện tại.
- `happy-dom` đã được nâng lên major mới để loại bỏ cảnh báo critical trong môi trường test/dev.
- `npm audit fix` không force đã được chạy để nhận các bản transitive an toàn.

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
- Audit hiện còn 9 cảnh báo moderate trong chuỗi tooling `firebase-tools`/`firebase-admin` và transitive Google Cloud SDK.
- CI dùng `npm run audit:security:gate`, chỉ fail khi có high/critical. Dùng `npm run audit:security:full` để xem toàn bộ moderate còn lại.
