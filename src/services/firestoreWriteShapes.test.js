import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMock = vi.hoisted(() => {
  let generatedId = 0;
  const state = {
    batchOps: [],
    setDocOps: [],
    updateDocOps: [],
    deleteDocOps: [],
    getDocByPath: new Map(),
  };

  function reset() {
    generatedId = 0;
    state.batchOps = [];
    state.setDocOps = [];
    state.updateDocOps = [];
    state.deleteDocOps = [];
    state.getDocByPath = new Map();
  }

  function snapshot(data = null, id = 'snap-id') {
    return {
      id,
      exists: () => data !== null,
      data: () => data,
      ref: { path: `mock/${id}`, id },
    };
  }

  function refPath(ref) {
    return typeof ref === 'string' ? ref : ref?.path || String(ref);
  }

  function collection(...args) {
    const start = args[0]?.__db ? 1 : 0;
    return { path: args.slice(start).map(refPath).join('/') };
  }

  function doc(...args) {
    if (args.length === 1) {
      generatedId += 1;
      const id = `generated-${generatedId}`;
      return { path: `${refPath(args[0])}/${id}`, id };
    }
    const start = args[0]?.__db ? 1 : 0;
    const path = args.slice(start).map(refPath).join('/');
    const parts = path.split('/');
    return { path, id: parts.at(-1) };
  }

  function writeBatch() {
    return {
      set: (ref, data, options) => state.batchOps.push({ type: 'set', ref, data, options }),
      update: (ref, data) => state.batchOps.push({ type: 'update', ref, data }),
      delete: (ref) => state.batchOps.push({ type: 'delete', ref }),
      commit: vi.fn(async () => {}),
    };
  }

  return {
    state,
    reset,
    snapshot,
    collection,
    doc,
    writeBatch,
  };
});

const candidateMock = vi.hoisted(() => ({
  firstExistingDoc: null,
}));

vi.mock('../config/firebase.js', () => ({
  db: { __db: true },
}));

vi.mock('../lib/firestoreCandidates.js', () => ({
  getFirstExistingDoc: vi.fn(async () => candidateMock.firstExistingDoc),
}));

vi.mock('firebase/firestore', () => ({
  Timestamp: class Timestamp {},
  arrayRemove: (...values) => ({ __op: 'arrayRemove', values }),
  arrayUnion: (...values) => ({ __op: 'arrayUnion', values }),
  collection: firestoreMock.collection,
  deleteDoc: vi.fn(async (ref) => firestoreMock.state.deleteDocOps.push({ ref })),
  deleteField: () => ({ __op: 'deleteField' }),
  doc: firestoreMock.doc,
  getDoc: vi.fn(async (ref) => firestoreMock.state.getDocByPath.get(ref.path) || firestoreMock.snapshot(null, ref.id)),
  getDocs: vi.fn(async () => ({ docs: [] })),
  increment: (value) => ({ __op: 'increment', value }),
  limit: (value) => ({ __query: 'limit', value }),
  onSnapshot: vi.fn(),
  orderBy: (...args) => ({ __query: 'orderBy', args }),
  query: (...args) => ({ __query: 'query', args }),
  serverTimestamp: () => ({ __serverTimestamp: true }),
  setDoc: vi.fn(async (ref, data, options) => firestoreMock.state.setDocOps.push({ ref, data, options })),
  updateDoc: vi.fn(async (ref, data) => firestoreMock.state.updateDocOps.push({ ref, data })),
  where: (...args) => ({ __query: 'where', args }),
  writeBatch: firestoreMock.writeBatch,
}));

import { submitKnowledgeReport } from './knowledgeReports.service.js';
import { submitProgressReport } from './reports.service.js';

const student = {
  id: 'student-1',
  fullName: 'An Nguyen',
  projectName: 'Weather App',
  currentProgressPercent: 20,
  progressStalledCount: 1,
};

const classDoc = {
  classCode: 'PY101',
  curriculumProgramId: 'python-basic',
};

const lesson = {
  id: 'lesson-2',
  sessionNumber: 2,
  title: 'Lists',
};

beforeEach(() => {
  firestoreMock.reset();
  candidateMock.firstExistingDoc = null;
});

describe('student Firestore write shapes', () => {
  it('writes knowledge feedback, receipt, summary and feedback index in one batch', async () => {
    await submitKnowledgeReport({
      student,
      classDoc,
      lesson,
      form: {
        understoodTopics: 'Em hiểu vòng lặp',
        unclearTopics: 'Em chưa rõ list lồng nhau',
        understandingLevel: 4,
        supportRequest: 'Muốn xem thêm ví dụ',
      },
    });

    const paths = firestoreMock.state.batchOps.map((op) => op.ref.path);
    expect(paths).toEqual([
      'knowledgeReports/PY101__student-1__lesson-2',
      'knowledgeReportReceipts/PY101__student-1__lesson-2',
      'knowledgeReportStudentSummaries/PY101__student-1__lesson-2',
      'studentFeedbackIndex/PY101__student-1',
    ]);

    const feedback = firestoreMock.state.batchOps[0].data;
    expect(feedback).toMatchObject({
      classCode: 'PY101',
      studentId: 'student-1',
      studentName: 'An Nguyen',
      lessonId: 'lesson-2',
      sessionNumber: 2,
      understandingLevel: 4,
    });
    expect(firestoreMock.state.batchOps[3].options).toEqual({ merge: true });
    expect(firestoreMock.state.batchOps[3].data.lessonIds).toEqual({
      __op: 'arrayUnion',
      values: ['lesson-2'],
    });
  });

  it('creates a progress report and mirrors latest progress onto the student snapshot', async () => {
    await submitProgressReport({
      student,
      classDoc,
      form: {
        progressPercent: 45,
        stage: 'Xây dựng sản phẩm',
        status: 'Đang làm',
        doneToday: 'Hoàn thành giao diện chính',
        nextGoal: 'Kết nối dữ liệu thời tiết',
        difficulties: '',
        projectGithubUrl: '',
        projectCanvaUrl: '',
      },
    });

    expect(firestoreMock.state.batchOps).toHaveLength(2);
    const [reportOp, studentOp] = firestoreMock.state.batchOps;
    expect(reportOp).toMatchObject({ type: 'set' });
    expect(reportOp.ref.path).toBe('reports/generated-1');
    expect(reportOp.data).toMatchObject({
      classCode: 'PY101',
      studentId: 'student-1',
      projectName: 'Weather App',
      progressPercent: 45,
      source: 'student-form',
    });
    expect(studentOp).toMatchObject({ type: 'update' });
    expect(studentOp.ref.path).toBe('students/student-1');
    expect(studentOp.data).toMatchObject({
      currentProgressPercent: 45,
      latestReportId: 'generated-1',
      progressStalledCount: 0,
    });
  });
});
