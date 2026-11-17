import { pinHandler } from './_lib/pinHttp.js';
import { commitUpLevel } from './_lib/upLevelStore.js';

export const handler = pinHandler('up-level', (db, body) => commitUpLevel(db, body), { admin: true, max: 10 });
