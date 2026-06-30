import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const PROJECT_ID = 'demo-hungtran-pm-rules';
const CLASS_CODE = 'PY101';
const FINAL_CLASS_CODE = 'FINAL101';
const STUDENT_ID = 'student-1';
const FINAL_STUDENT_ID = 'student-final';
const STUDENT_NAME = 'An Nguyen';
const FINAL_STUDENT_NAME = 'Binh Tran';
const PROGRAM_ID = 'python-basic';
const LESSON_ID = 'lesson-2';
const SESSION_NUMBER = 2;

let testEnv;

function serverTimestamp() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

function arrayUnion(value) {
  return firebase.firestore.FieldValue.arrayUnion(value);
}

function publicDb() {
  return testEnv.unauthenticatedContext().firestore();
}

function feedbackBase() {
  const feedbackId = `${CLASS_CODE}__${STUDENT_ID}__${LESSON_ID}`;
  return {
    feedbackId,
    classCode: CLASS_CODE,
    studentId: STUDENT_ID,
    curriculumProgramId: PROGRAM_ID,
    sessionNumber: SESSION_NUMBER,
    lessonId: LESSON_ID,
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };
}

function pendingQuizSubmission(submissionId = 'quiz-submission-1') {
  return {
    classCode: CLASS_CODE,
    studentId: STUDENT_ID,
    studentName: STUDENT_NAME,
    programId: PROGRAM_ID,
    lessonId: LESSON_ID,
    curriculumProgramId: PROGRAM_ID,
    sessionNumber: SESSION_NUMBER,
    quizTitle: 'Exam quiz',
    lessonTitle: 'Lesson 2',
    attemptNumber: 1,
    maxAttempts: 3,
    timeLimitMinutes: 15,
    startedAtMs: 1000,
    durationSeconds: 60,
    responses: [
      {
        questionId: 'q1',
        questionType: 'mcq',
        prompt: 'Pick one',
        selectedIndex: 0,
        selectedLabel: 'A',
        isCorrect: null,
      },
    ],
    mcqCorrect: 0,
    mcqTotal: 1,
    mcqPercent: 0,
    codeCorrect: 0,
    codeGraded: 0,
    gradedCorrect: 0,
    gradedTotal: 0,
    gradedPercent: 0,
    unansweredCount: 0,
    gradingStatus: 'pending',
    timedOut: false,
    submitReason: 'manual',
    source: 'student-quiz-v2',
    submittedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    submissionId,
  };
}

function practiceSubmission(overrides = {}) {
  return {
    submissionId: `${CLASS_CODE}__${STUDENT_ID}__${LESSON_ID}`,
    classCode: CLASS_CODE,
    studentId: STUDENT_ID,
    studentName: STUDENT_NAME,
    programId: PROGRAM_ID,
    lessonId: LESSON_ID,
    curriculumProgramId: PROGRAM_ID,
    sessionNumber: SESSION_NUMBER,
    quizTitle: 'Practice quiz',
    lessonTitle: 'Lesson 2',
    attemptCount: 1,
    responses: [
      {
        questionId: 'p1',
        questionType: 'mcq',
        prompt: 'Practice',
        selectedIndex: 0,
        selectedLabel: 'A',
        isCorrect: true,
      },
    ],
    mcqCorrect: 1,
    mcqTotal: 1,
    mcqPercent: 100,
    gradingStatus: 'complete',
    source: 'practice-quiz-v1',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

async function seedBaseline() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      db.doc(`classes/${CLASS_CODE}`).set({
        classCode: CLASS_CODE,
        status: 'active',
        hidden: false,
        curriculumProgramId: PROGRAM_ID,
        curriculumCurrentSession: SESSION_NUMBER,
        curriculumPhase: 'learning',
      }),
      db.doc(`classes/${FINAL_CLASS_CODE}`).set({
        classCode: FINAL_CLASS_CODE,
        status: 'active',
        hidden: false,
        curriculumProgramId: PROGRAM_ID,
        curriculumCurrentSession: 0,
        curriculumPhase: 'final',
        finalMode: 'project',
      }),
      db.doc(`students/${STUDENT_ID}`).set({
        id: STUDENT_ID,
        fullName: STUDENT_NAME,
        classId: CLASS_CODE,
        active: true,
        projectName: 'Learning app',
        projectNameStatus: 'approved',
      }),
      db.doc(`students/${FINAL_STUDENT_ID}`).set({
        id: FINAL_STUDENT_ID,
        fullName: FINAL_STUDENT_NAME,
        classId: FINAL_CLASS_CODE,
        active: true,
        projectName: 'Final learning app',
        projectNameStatus: 'approved',
      }),
      db.doc(`curriculumPrograms/${PROGRAM_ID}`).set({
        id: PROGRAM_ID,
        active: true,
        name: 'Python Basic',
      }),
      db.doc(`quizPublicQuestionBanks/${PROGRAM_ID}__${LESSON_ID}`).set({
        quizId: `${PROGRAM_ID}__${LESSON_ID}`,
        programId: PROGRAM_ID,
        lessonId: LESSON_ID,
        sessionNumber: SESSION_NUMBER,
        title: 'Exam quiz',
        enabled: true,
        allowRetake: true,
        maxAttempts: 3,
        questions: [{ id: 'q1', prompt: 'Pick one', options: ['A', 'B'] }],
      }),
      db.doc(`quizQuestionBanks/${PROGRAM_ID}__${LESSON_ID}`).set({
        programId: PROGRAM_ID,
        lessonId: LESSON_ID,
        answers: { q1: 0 },
      }),
      db.doc(`practiceQuizPublicBanks/${PROGRAM_ID}__${LESSON_ID}`).set({
        quizId: `${PROGRAM_ID}__${LESSON_ID}`,
        programId: PROGRAM_ID,
        lessonId: LESSON_ID,
        sessionNumber: SESSION_NUMBER,
        title: 'Practice quiz',
        enabled: true,
        questions: [{ id: 'p1', prompt: 'Practice', options: ['A', 'B'] }],
      }),
      db.doc(`practiceQuizAnswerBanks/${PROGRAM_ID}__${LESSON_ID}`).set({
        programId: PROGRAM_ID,
        lessonId: LESSON_ID,
        answers: { p1: 0 },
      }),
    ]);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseline();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('student-facing Firestore rules', () => {
  it('denies public reads to exam quiz answer banks', async () => {
    const db = publicDb();

    await assertFails(db.doc(`quizQuestionBanks/${PROGRAM_ID}__${LESSON_ID}`).get());
  });

  it('allows the feedback report, receipt, summary, and index batch shape', async () => {
    const db = publicDb();
    const feedbackId = `${CLASS_CODE}__${STUDENT_ID}__${LESSON_ID}`;
    const base = feedbackBase();
    const batch = db.batch();

    batch.set(db.doc(`knowledgeReports/${feedbackId}`), {
      ...base,
      studentName: STUDENT_NAME,
      understoodTopics: 'Loops and variables',
      unclearTopics: 'Nested loops',
      understandingLevel: 4,
      supportRequest: '',
    });
    batch.set(db.doc(`knowledgeReportReceipts/${feedbackId}`), base);
    batch.set(db.doc(`knowledgeReportStudentSummaries/${feedbackId}`), {
      feedbackId,
      classCode: CLASS_CODE,
      studentId: STUDENT_ID,
      curriculumProgramId: PROGRAM_ID,
      sessionNumber: SESSION_NUMBER,
      lessonId: LESSON_ID,
      understoodTopics: 'Loops and variables',
      unclearTopics: 'Nested loops',
      understandingLevel: 4,
      supportRequest: '',
      submittedAt: serverTimestamp(),
    });
    batch.set(
      db.doc(`studentFeedbackIndex/${CLASS_CODE}__${STUDENT_ID}`),
      {
        classCode: CLASS_CODE,
        studentId: STUDENT_ID,
        lessonIds: arrayUnion(LESSON_ID),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await assertSucceeds(batch.commit());
  });

  it('allows progress report create with the matching student snapshot update', async () => {
    const db = publicDb();
    const reportId = 'report-1';
    const batch = db.batch();

    batch.set(db.doc(`reports/${reportId}`), {
      classId: FINAL_CLASS_CODE,
      classCode: FINAL_CLASS_CODE,
      studentId: FINAL_STUDENT_ID,
      studentName: FINAL_STUDENT_NAME,
      projectName: 'Final learning app',
      progressPercent: 45,
      stage: 'Phân tích vấn đề',
      status: 'Đang làm',
      doneToday: 'Built the first working prototype',
      nextGoal: 'Collect feedback from classmates',
      difficulties: '',
      projectGithubUrl: 'https://github.com/example/final-learning-app',
      projectCanvaUrl: '',
      submittedAt: serverTimestamp(),
      submittedDateKey: '2026-06-29',
      source: 'student-form',
      createdAt: serverTimestamp(),
    });
    batch.update(db.doc(`students/${FINAL_STUDENT_ID}`), {
      currentProgressPercent: 45,
      currentStage: 'Phân tích vấn đề',
      currentStatus: 'Đang làm',
      currentDifficulties: '',
      lastReportedAt: serverTimestamp(),
      latestReportId: reportId,
      progressStalledCount: 0,
      projectGithubUrl: 'https://github.com/example/final-learning-app',
      projectCanvaUrl: '',
      updatedAt: serverTimestamp(),
    });

    await assertSucceeds(batch.commit());
  });

  it('denies student snapshot updates without the matching report create', async () => {
    const db = publicDb();

    await assertFails(
      db.doc(`students/${FINAL_STUDENT_ID}`).update({
        currentProgressPercent: 45,
        currentStage: 'Phân tích vấn đề',
        currentStatus: 'Đang làm',
        currentDifficulties: '',
        lastReportedAt: serverTimestamp(),
        latestReportId: 'missing-report',
        progressStalledCount: 0,
        projectGithubUrl: 'https://github.com/example/final-learning-app',
        projectCanvaUrl: '',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows pending quiz submission and latest status without exposing submission reads', async () => {
    const db = publicDb();
    const latestId = `${CLASS_CODE}__${STUDENT_ID}__${LESSON_ID}`;
    const submissionId = 'quiz-submission-1';
    const batch = db.batch();

    batch.set(db.doc(`studentQuizSubmissions/${submissionId}`), pendingQuizSubmission(submissionId));
    batch.set(
      db.doc(`studentQuizLatest/${latestId}`),
      {
        classCode: CLASS_CODE,
        studentId: STUDENT_ID,
        lessonId: LESSON_ID,
        programId: PROGRAM_ID,
        curriculumProgramId: PROGRAM_ID,
        sessionNumber: SESSION_NUMBER,
        submissionId,
        attemptNumber: 1,
        submittedAt: serverTimestamp(),
      },
      { merge: true },
    );

    await assertSucceeds(batch.commit());
    await assertSucceeds(db.doc(`studentQuizLatest/${latestId}`).get());
    await assertFails(db.doc(`studentQuizSubmissions/${submissionId}`).get());
  });

  it('allows valid practice submissions and denies mismatched identities', async () => {
    const db = publicDb();
    const submissionId = `${CLASS_CODE}__${STUDENT_ID}__${LESSON_ID}`;

    await assertSucceeds(
      db.doc(`practiceQuizSubmissions/${submissionId}`).set(practiceSubmission(), { merge: true }),
    );

    await assertFails(
      db.doc(`practiceQuizSubmissions/${submissionId}`).set(
        practiceSubmission({
          studentId: 'student-2',
        }),
        { merge: true },
      ),
    );
  });

  it('allows final project code submission parent and file content flow', async () => {
    const db = publicDb();
    const docId = `${FINAL_CLASS_CODE}__${FINAL_STUDENT_ID}__1`;
    const fileId = 'file-1';

    await assertSucceeds(
      db.doc(`projectCodeSubmissions/${docId}`).set({
        classCode: FINAL_CLASS_CODE,
        studentId: FINAL_STUDENT_ID,
        studentName: FINAL_STUDENT_NAME,
        sessionNumber: 1,
        files: [],
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      db.doc(`projectCodeSubmissions/${docId}/files/${fileId}`).set({
        content: 'print("hello")',
      }),
    );
    await assertSucceeds(
      db.doc(`projectCodeSubmissions/${docId}`).update({
        files: [
          {
            id: fileId,
            name: 'main.py',
            contentType: 'text/x-python',
            sizeBytes: 14,
            uploadedAt: '2026-06-29T00:00:00.000Z',
          },
        ],
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies code file content writes when the parent submission is missing', async () => {
    const db = publicDb();
    const docId = `${FINAL_CLASS_CODE}__${FINAL_STUDENT_ID}__1`;

    await assertFails(
      db.doc(`projectCodeSubmissions/${docId}/files/file-1`).set({
        content: 'print("hello")',
      }),
    );
  });
});
