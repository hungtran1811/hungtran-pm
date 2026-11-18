import { pinHandler } from './_lib/pinHttp.js';
import { setAdminPin } from './_lib/pinStore.js';

export const handler = pinHandler(
  'pin-admin-set',
  (db, body) => setAdminPin(db, {
    studentId: body.studentId,
    pin: body.pin,
    confirmPin: body.confirmPin,
  }),
  { admin: true },
);
