import { pinHandler } from './_lib/pinHttp.js';
import { readArchivedLesson } from './_lib/lessonArchive.js';

export const handler = pinHandler(
  'archive-class-lesson',
  (db, body) => readArchivedLesson(db, { classCode: body.classCode, lessonId: body.lessonId }),
  { admin: true, max: 60 },
);
