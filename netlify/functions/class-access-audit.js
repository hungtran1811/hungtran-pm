import { pinHandler } from './_lib/pinHttp.js';
import { recordAccessCodeAudit } from './_lib/pinStore.js';

export const handler = pinHandler(
  'class-access-audit',
  (db, body) =>
    recordAccessCodeAudit(db, {
      classCode: body.classCode,
      studentAccessCode: body.studentAccessCode,
      email: body.email,
    }),
  { admin: true },
);
