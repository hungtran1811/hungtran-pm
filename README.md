# hungtranPM

Web app quản lý tiến độ sản phẩm học sinh theo PBL + waterfall đơn giản.

## Stack

- Frontend: Vite + Vanilla JavaScript
- UI: Bootstrap 5 + Bootstrap Icons
- Auth: Firebase Authentication (Google Sign-In cho admin)
- Database: Cloud Firestore
- Backend public API: Firebase Cloud Functions
- Hosting: Netlify hoặc Firebase Hosting

## Route chuẩn

Ứng dụng dùng `hash route`.

- Học sinh: `#/student/report`
- Admin login: `#/admin/login`
- Dashboard: `#/admin/dashboard`
- Lớp: `#/admin/classes`
- Học sinh: `#/admin/students`
- Báo cáo: `#/admin/reports`
- Preview phụ huynh: `#/admin/parent-preview`

Nếu người dùng mở nhầm dạng `/admin/...`, app sẽ tự chuẩn hóa sang `#/admin/...`.

## Chạy local

1. Cài dependency frontend:

```bash
npm install
```

2. Cài dependency cho Cloud Functions:

```bash
npm run install:functions
```

3. Tạo `.env` từ `.env.example` và điền config Firebase thật.

4. Chạy frontend:

```bash
npm run dev
```

## Dùng Firebase Emulator

Đặt:

```env
VITE_USE_EMULATORS=true
VITE_FIREBASE_FUNCTIONS_REGION=asia-southeast1
```

Sau đó chạy emulator Firebase bằng project tương ứng, ví dụ:

```bash
firebase emulators:start --only auth,firestore,functions
```

## Seed dữ liệu demo

Seed script tạo:

- 2 lớp
- 6 học sinh
- 12 báo cáo
- 1 admin demo

Yêu cầu:

- Có Application Default Credentials, hoặc
- Có file service account và trỏ `GOOGLE_APPLICATION_CREDENTIALS`

Có thể đổi email admin demo:

```env
SEED_ADMIN_EMAIL=you@example.com
```

Chạy seed:

```bash
npm run seed:demo
```

## Ghi chú triển khai

- Firestore client chỉ cho admin đọc/ghi `classes`, `students`.
- `reports` là append-only từ Cloud Functions, client không được ghi trực tiếp.
- Dashboard phụ huynh ở v1 là `admin-only preview`.
- Timezone mặc định: `Asia/Ho_Chi_Minh`.

## Ghi chú release Netlify

- V1 hiện dùng hướng `Firestore direct fallback` nếu Cloud Functions chưa deploy được trên gói Firebase hiện tại.
- Trên Netlify, đặt:
  - `VITE_USE_EMULATORS=false`
  - `VITE_FIREBASE_FUNCTIONS_REGION=asia-southeast1`
  - `VITE_ENABLE_ADMIN_DEBUG_ACTIONS=false`
- Nếu cần test thao tác xóa báo cáo ở local, đặt `VITE_ENABLE_ADMIN_DEBUG_ACTIONS=true`. Không bật biến này trên production.
