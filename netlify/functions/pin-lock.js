import { pinHandler } from './_lib/pinHttp.js';
import { lockStudentPin } from './_lib/pinStore.js';

export const handler = pinHandler(
  'pin-lock',
  (db, body) => lockStudentPin(db, { studentId: body.studentId, reason: body.reason }),
  { admin: true },
);
