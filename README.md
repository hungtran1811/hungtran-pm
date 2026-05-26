# hungtranPM

Web app quản lý lớp học lập trình, học liệu, báo cáo tiến độ sản phẩm và kiểm tra trắc nghiệm.

## Stack

- Frontend: Vite + Vanilla JavaScript
- UI: Bootstrap 5, Bootstrap Icons, CSS custom trong `src/styles`
- Auth: Firebase Authentication cho admin
- Database: Cloud Firestore
- Backend: Firebase Cloud Functions còn trong repo, một số luồng dùng Firestore direct fallback

## Chạy local

```bash
npm install
npm run install:functions
npm run dev
```

Tạo `.env` từ `.env.example` và điền cấu hình Firebase trước khi chạy.

## Build

```bash
npm run build
```

## Seed dữ liệu

```bash
npm run seed:demo
npm run seed:curriculum
```

Các script seed cần Firebase credentials hợp lệ.

## Ghi chú phát triển

- Không dùng `alert/confirm/prompt` native; dùng toast/dialog component của app.
- Không đổi Firestore schema hoặc route public nếu task không yêu cầu.
- Với refactor lớn, giữ behavior cũ và chạy `npm run build` sau từng cụm thay đổi.
- Tài liệu ghi nhớ cho Codex có thể nằm trong `docs/` local, nhưng thư mục này được ignore và không push lên git.
