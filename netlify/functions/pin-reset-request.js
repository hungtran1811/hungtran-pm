import { pinHandler } from './_lib/pinHttp.js';
import { requestPinReset } from './_lib/pinStore.js';

export const handler = pinHandler('pin-reset-request', (db, body) =>
  requestPinReset(db, { classCode: body.classCode, studentId: body.studentId }),
);
