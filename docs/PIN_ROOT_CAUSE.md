# PIN sau Up Level — Phase 0

HEAD khi audit: `6143c2a6af439a58d189df39d816c1ea8b3929e0`.
Nhánh: `fix/up-level-v3-pin-history`.
Không ghi production, không đổi `PIN_PEPPER`, không deploy.

## Kết luận

Luồng mã hiện tại **giữ credential và nhận PIN cũ trên lớp mới** khi `PIN_PEPPER` có mặt lúc xử lý request. Lỗi học sinh thấy trên hungtranpm.com tối 17/11 không phải enrollment sai, không phải hash lệch, và không phải khóa tạm.

Lỗi đã thấy trên lớp mới `/c/t`:

| Bước | Kết quả quan sát | Phân loại |
|---|---|---|
| `pin-gate` lúc đầu | HTTP 502, `ERR_REQUIRE_ESM` từ `firebase-admin/auth` → `jwks-rsa` → `jose` | 5xx tạo phiên, đã tách khỏi `firebase-admin/auth` ở `1262046` |
| `pin-gate` sau đó | Màn hình verify hiện ô PIN và nút Quên PIN | `needsVerify`, credential còn |
| `pin-verify` | HTTP 500, chữ "Máy chủ chưa cấu hình PIN." | `PIN_PEPPER_MISSING`, pepper không có trong process của function |

`401 Mã không đúng` và `429` khóa tạm không xuất hiện ở lần đó. `signInWithCustomToken` chưa chạy vì verify dừng trước khi ký token.

## Emulator

`firestore-rules/up-level-migration.test.js` — `lets the same student verify the old PIN on the new class`.

Dữ liệu giả: lớp `PINSRC` → `PINDST`, học sinh `s01`, credential scrypt không có `scryptN` (đúng dạng bản ghi đang chạy), `credentialVersion` 2, `studentSessions` version 2. Pepper chỉ đặt trong process của test.

Kết quả lệnh `firebase emulators:exec --only firestore` + vitest file này, 18/11/2026: **7/7 passed**.

- Verify lớp nguồn thành công.
- Up Level không đổi `studentId`, hash, `credentialVersion`, session version.
- Enrollment nguồn `completed`, đích `active`.
- `pin-gate` lớp đích = `needsVerify`.
- Verify lớp đích với cùng PIN thành công, token custom có `uid` `stu_s01` và `claims.credentialVersion` 2.
- PIN sai = 401. Học sinh không thuộc lớp = 403.
- Xóa `PIN_PEPPER` rồi verify = throw `PIN_PEPPER_MISSING`, không thành 401.

## Chưa chứng minh

Auth emulator không đổi custom token lấy ID token của project `hungtran-pm`. Token test chỉ chứng minh chữ ký và payload. Lần lỗi trên site dừng trước bước này.

## Việc production cần duyệt

Function trên site phải thấy đúng `PIN_PEPPER` đã dùng khi tạo hash. Không tạo pepper mới, không reset PIN, không sửa credential. Nếu biến chỉ nằm ở scope build thì function vẫn báo thiếu pepper sau khi code đọc biến lúc chạy.
