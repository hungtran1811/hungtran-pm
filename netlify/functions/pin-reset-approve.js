import { pinHandler } from './_lib/pinHttp.js';
import { approvePinReset } from './_lib/pinStore.js';

export const handler = pinHandler(
  'pin-reset-approve',
  (db, body) => approvePinReset(db, { requestId: body.requestId }),
  { admin: true },
);
