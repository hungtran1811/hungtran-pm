import { pinHandler } from './_lib/pinHttp.js';
import { verifyStudentPin } from './_lib/pinStore.js';

export const handler = pinHandler('pin-verify', (db, body) =>
  verifyStudentPin(db, { classCode: body.classCode, studentId: body.studentId, pin: body.pin }),
);
