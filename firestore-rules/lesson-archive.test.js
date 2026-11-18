import { createHash } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { beforeAll, describe, expect, it } from 'vitest';
import { archiveClassLessons, readArchivedLesson } from '../netlify/functions/_lib/lessonArchive.js';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Refusing lesson archive tests outside the Firestore emulator.');
}

const app = getApps().find((item) => item.name === 'lesson-archive-emulator')
  || initializeApp({ projectId: 'demo-hungtran-pm-rules' }, 'lesson-archive-emulator');
const db = getFirestore(app);

function sha256(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex');
}

function fakeDrive(files) {
  return {
    async ensureFolder() {
      return 'archive-folder';
    },
    async copyFile({ fileId, name }) {
      if (!files.has(fileId)) throw new Error('missing source');
      const id = `copy-${name}`;
      files.set(id, files.get(fileId));
      return { id, name };
    },
    async readFile(fileId) {
      if (!files.has(fileId)) throw new Error('gone');
      return files.get(fileId);
    },
  };
}

async function seedProgram(programId, lessons, { subcollection = false } = {}) {
  await db.collection('curriculumPrograms').doc(programId).set({
    name: 'Web Basic',
    lessonsStorage: subcollection ? 'subcollection' : 'embedded',
    lessons: subcollection ? [] : lessons,
  });
  if (!subcollection) return;
  for (const lesson of lessons) {
    await db.collection('curriculumPrograms').doc(programId).collection('lessons').doc(lesson.id).set(lesson);
  }
}

describe('lesson archive emulator', () => {
  beforeAll(() => {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error('Firestore emulator is required.');
    }
  });

  it('stores opened lessons, including an archived one, and does not overwrite a ready archive', async () => {
    const code = 'ARCH-READY';
    const programId = 'arch-ready-program';
    await seedProgram(programId, [
      { id: 'l1', sessionNumber: 1, title: 'Buổi 1', lectureMarkdown: 'Nội dung gốc', archived: false },
      { id: 'l2', sessionNumber: 2, title: 'Buổi 2', lectureMarkdown: 'Đã dạy', archived: true },
    ], { subcollection: true });
    await db.collection('classes').doc(code).set({
      classCode: code,
      status: 'active',
      curriculumProgramId: programId,
      curriculumCurrentSession: 2,
    });
    await db.collection('studentCredentials').doc('arch-student').set({ hash: 'keep-me', credentialVersion: 2 });
    await db.collection('classEnrollments').doc(`${code}__arch-student`).set({
      classCode: code,
      studentId: 'arch-student',
      status: 'active',
    });

    const drive = fakeDrive(new Map());
    const first = await archiveClassLessons(db, { classCode: code }, drive);
    expect(first.ok).toBe(true);
    expect(first.body.state).toBe('ready');
    expect(first.body.archiveLessonCount).toBe(2);
    expect(first.body.missingSessions).toEqual([]);
    expect(first.body.checksumManifest).toMatch(/^[a-f0-9]{64}$/);

    const stored = await db.collection('classLessonArchives').doc(code).collection('lessons').doc('l1').get();
    expect(stored.data().title).toBe('Buổi 1');
    expect(stored.data().lectureMarkdown).toBe('Nội dung gốc');
    const checksum = first.body.checksumManifest;

    await db.collection('curriculumPrograms').doc(programId).collection('lessons').doc('l1').update({
      title: 'Đã sửa trên giáo án',
      lectureMarkdown: 'Nội dung mới',
    });
    const second = await archiveClassLessons(db, { classCode: code }, drive);
    expect(second.body.state).toBe('ready');
    expect(second.body.already).toBe(true);
    expect(second.body.staleSource).toBe(true);
    expect(second.body.checksumManifest).toBe(checksum);
    const after = await db.collection('classLessonArchives').doc(code).collection('lessons').doc('l1').get();
    expect(after.data().title).toBe('Buổi 1');
    expect(after.data().lectureMarkdown).toBe('Nội dung gốc');

    const read = await readArchivedLesson(db, { classCode: code, lessonId: 'l1' });
    expect(read.body.lectureMarkdown).toBe('Nội dung gốc');
    expect((await db.collection('studentCredentials').doc('arch-student').get()).data().hash).toBe('keep-me');
    expect((await db.collection('classEnrollments').doc(`${code}__arch-student`).get()).data().status).toBe('active');
  });

  it('keeps a Drive copy readable after the live file is removed', async () => {
    const code = 'ARCH-DRIVE';
    const html = '<p>Bài trên Drive</p>';
    const files = new Map([['live-html', html]]);
    await seedProgram('arch-drive-program', [{
      id: 'd1',
      sessionNumber: 1,
      title: 'Drive',
      lectureMarkdown: '',
      lectureHtmlDrive: { driveFileId: 'live-html', fileName: 'L01-lecture.html', byteSize: html.length },
    }]);
    await db.collection('classes').doc(code).set({
      classCode: code,
      status: 'active',
      curriculumProgramId: 'arch-drive-program',
      curriculumCurrentSession: 1,
    });

    const result = await archiveClassLessons(db, { classCode: code }, fakeDrive(files));
    expect(result.body.state).toBe('ready');
    const saved = await db.collection('classLessonArchives').doc(code).collection('lessons').doc('d1').get();
    const copyId = saved.data().lectureArchiveDrive.driveFileId;
    expect(copyId).not.toBe('live-html');
    expect(saved.data().lectureArchiveDrive.checksum).toBe(sha256(html));
    files.delete('live-html');
    const drive = fakeDrive(files);
    expect(await drive.readFile(copyId)).toBe(html);
    expect(sha256(await drive.readFile(copyId))).toBe(saved.data().lectureArchiveDrive.checksum);
  });

  it('fails the archive when a taught session has no lesson', async () => {
    const code = 'ARCH-MISSING';
    await seedProgram('arch-missing-program', [
      { id: 'm1', sessionNumber: 1, title: 'Chỉ buổi 1', lectureMarkdown: 'Có' },
    ]);
    await db.collection('classes').doc(code).set({
      classCode: code,
      status: 'active',
      curriculumProgramId: 'arch-missing-program',
      curriculumCurrentSession: 2,
    });

    const result = await archiveClassLessons(db, { classCode: code }, fakeDrive(new Map()));
    expect(result.ok).toBe(true);
    expect(result.body.state).toBe('failed');
    expect(result.body.state).not.toBe('ready');
    expect(result.body.missingSessions).toEqual([2]);
    expect(result.body.archiveLessonCount).toBe(1);
  });
});
