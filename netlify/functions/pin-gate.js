import { pinHandler } from './_lib/pinHttp.js';
import { readPinGate } from './_lib/pinStore.js';

export const handler = pinHandler('pin-gate', (db, body) =>
  readPinGate(db, { classCode: body.classCode, studentId: body.studentId }),
);
