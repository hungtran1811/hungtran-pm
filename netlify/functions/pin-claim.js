import { pinHandler } from './_lib/pinHttp.js';
import { claimStudentPin } from './_lib/pinStore.js';

export const handler = pinHandler('pin-claim', (db, body) =>
  claimStudentPin(db, {
    classCode: body.classCode,
    studentId: body.studentId,
    pin: body.pin,
    confirmPin: body.confirmPin,
  }),
);
