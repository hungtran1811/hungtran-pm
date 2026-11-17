import { pinHandler } from './_lib/pinHttp.js';
import { countPendingPinResets, listPinBoard, readPinStatus } from './_lib/pinStore.js';

export const handler = pinHandler(
  'pin-status',
  (db, body) => {
    if (body.countPending) return countPendingPinResets(db);
    if (body.listBoard) return listPinBoard(db, { classCode: body.classCode });
    return readPinStatus(db, { studentId: body.studentId });
  },
  { admin: true },
);
