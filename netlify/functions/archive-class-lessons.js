import { pinHandler } from './_lib/pinHttp.js';
import { archiveClassLessons } from './_lib/lessonArchive.js';

export const handler = pinHandler(
  'archive-class-lessons',
  (db, body) => archiveClassLessons(db, { classCode: body.classCode }),
  { admin: true, max: 20 },
);
