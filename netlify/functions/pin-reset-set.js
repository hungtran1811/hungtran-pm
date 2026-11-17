import { pinHandler } from './_lib/pinHttp.js';
import { setResetPin } from './_lib/pinStore.js';

export const handler = pinHandler('pin-reset-set', (db, body) =>
  setResetPin(db, {
    classCode: body.classCode,
    studentId: body.studentId,
    pin: body.pin,
    confirmPin: body.confirmPin,
  }),
);
