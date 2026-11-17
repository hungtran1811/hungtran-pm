import { DEFAULT_STAGE, DEFAULT_STATUS } from '../constants/index.js';
import { normalizeClassLookupInput, suggestStudentAccessCode } from './classAccessCode.js';

export function preserveClassCode(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function progressionId(sourceClassCode) {
  return `uplevel_${normalizeClassLookupInput(sourceClassCode)}`;
}

export function enrollmentDocId(classCode, studentId) {
  return `${preserveClassCode(classCode)}__${studentId}`;
}

export function upLevelGate(currentSession, totalSessions) {
  const current = Number(currentSession) || 0;
  const total = Number(totalSessions) || 0;
  if (total > 0 && current >= total) return { ready: true, early: false };
  return { ready: false, early: true };
}

export const HISTORICAL_STATE_FIELDS = [
  'currentStatus',
  'currentStage',
  'currentProgressPercent',
  'currentDifficulties',
  'projectName',
  'projectNameSubmission',
  'projectNameStatus',
  'projectNameReviewNote',
  'projectTopic',
  'projectProblemSolution',
  'projectPlannedFeatures',
  'projectGithubUrl',
  'projectCanvaUrl',
  'projectSlidesUrl',
  'projectOtherUrl',
  'latestReportId',
  'lastReportedAt',
  'openedLessonIds',
  'lastOpenedLessonId',
  'lastOpenedSessionNumber',
  'lastOpenedAt',
  'progressStalledCount',
];

export function sourceStateSnapshot(student, classCode) {
  return {
    studentId: student.id,
    classCode,
    currentStatus: student.currentStatus || DEFAULT_STATUS,
    currentStage: student.currentStage || DEFAULT_STAGE,
    currentProgressPercent: Number(student.currentProgressPercent) || 0,
    currentDifficulties: student.currentDifficulties || '',
    projectName: student.projectName || '',
    projectNameSubmission: student.projectNameSubmission || '',
    projectNameStatus: student.projectNameStatus || '',
    projectNameReviewNote: student.projectNameReviewNote || '',
    projectTopic: student.projectTopic || '',
    projectProblemSolution: student.projectProblemSolution || '',
    projectPlannedFeatures: student.projectPlannedFeatures || '',
    projectGithubUrl: student.projectGithubUrl || '',
    projectCanvaUrl: student.projectCanvaUrl || '',
    projectSlidesUrl: student.projectSlidesUrl || '',
    projectOtherUrl: student.projectOtherUrl || '',
    latestReportId: student.latestReportId || '',
    lastReportedAt: student.lastReportedAt ?? null,
    openedLessonIds: Array.isArray(student.openedLessonIds) ? [...student.openedLessonIds] : [],
    lastOpenedLessonId: student.lastOpenedLessonId || '',
    lastOpenedSessionNumber: Number(student.lastOpenedSessionNumber) || 0,
    lastOpenedAt: student.lastOpenedAt ?? null,
    progressStalledCount: Number(student.progressStalledCount) || 0,
  };
}

export function overlayHistoricalState(student, state) {
  if (!state) return student;
  const next = { ...student };
  for (const field of HISTORICAL_STATE_FIELDS) {
    if (state[field] !== undefined) next[field] = state[field];
  }
  return next;
}

export function freshTargetState(studentId, classCode) {
  return {
    studentId,
    classCode,
    currentStatus: DEFAULT_STATUS,
    currentStage: DEFAULT_STAGE,
    currentProgressPercent: 0,
    currentDifficulties: '',
    projectName: '',
    projectNameSubmission: '',
    projectNameStatus: '',
    projectNameReviewNote: '',
    projectTopic: '',
    projectProblemSolution: '',
    projectPlannedFeatures: '',
    projectGithubUrl: '',
    projectCanvaUrl: '',
    projectSlidesUrl: '',
    projectOtherUrl: '',
    latestReportId: '',
    lastReportedAt: null,
    openedLessonIds: [],
    lastOpenedLessonId: '',
    lastOpenedSessionNumber: 0,
    lastOpenedAt: null,
    progressStalledCount: 0,
  };
}

export function freshStudentMirror(classCode) {
  return {
    classId: classCode,
    classCode,
    currentClassCode: classCode,
    currentStatus: DEFAULT_STATUS,
    currentStage: DEFAULT_STAGE,
    currentProgressPercent: 0,
    currentDifficulties: '',
    projectName: '',
    projectNameSubmission: '',
    projectNameStatus: '',
    projectNameReviewNote: '',
    projectTopic: '',
    projectProblemSolution: '',
    projectPlannedFeatures: '',
    projectGithubUrl: '',
    projectCanvaUrl: '',
    projectSlidesUrl: '',
    projectOtherUrl: '',
    latestReportId: '',
    lastReportedAt: null,
    openedLessonIds: [],
    lastOpenedLessonId: '',
    lastOpenedSessionNumber: 0,
    lastOpenedAt: null,
    progressStalledCount: 0,
  };
}

function homeClass(student) {
  return student.classId || student.classCode || '';
}

export function upLevelRequestHash({
  sourceClassCode,
  targetClassCode,
  programId,
  className,
  studentAccessCode,
  selectedIds = [],
  override = false,
  overrideReason = '',
} = {}) {
  const ids = [...selectedIds].map(String).filter(Boolean).sort();
  return [
    normalizeClassLookupInput(sourceClassCode),
    normalizeClassLookupInput(targetClassCode),
    String(programId || '').trim(),
    String(className || '').trim(),
    normalizeClassLookupInput(studentAccessCode),
    ids.join(','),
    override === true ? '1' : '0',
    String(overrideReason || '').trim(),
  ].join('|');
}

function progressionBody({
  operationId,
  source,
  target,
  program,
  selected,
  excluded,
  state,
  early,
  actor,
  requestHash,
  overrideReason,
}) {
  return {
    operationId,
    idempotencyKey: operationId,
    requestHash: requestHash || '',
    sourceClassCode: source.classCode,
    targetClassCode: target,
    sourceProgramId: source.curriculumProgramId || '',
    targetProgramId: program.id,
    studentIds: selected.map((student) => student.id),
    excludedStudentIds: excluded.map((student) => student.id),
    state,
    earlyOverride: early,
    overrideReason: early ? String(overrideReason || '').trim() : '',
    requestedBy: actor || '',
  };
}

export function planUpLevel({
  source,
  students = [],
  program,
  sessionTotal,
  targetClassCode,
  className,
  studentAccessCode = '',
  selectedIds = [],
  confirmCode = '',
  override = false,
  overrideReason = '',
  actor = '',
  existingProgression = null,
  targetClass = null,
  targetHasReports = false,
  gameOpen = false,
  uploadOpen = false,
  credentialStudentIds = null,
} = {}) {
  if (!source?.classCode) return { ok: false, error: 'Không tìm thấy lớp nguồn.' };

  const sourceCode = preserveClassCode(source.classCode);
  const target = preserveClassCode(targetClassCode);
  const confirm = preserveClassCode(confirmCode);
  const sameCode = (left, right) => normalizeClassLookupInput(left) === normalizeClassLookupInput(right);
  const access = normalizeClassLookupInput(studentAccessCode);
  const name = String(className || '').trim();
  const ids = Array.isArray(selectedIds) ? selectedIds.filter(Boolean) : [];
  const requestHash = upLevelRequestHash({
    sourceClassCode: sourceCode,
    targetClassCode: target,
    programId: program?.id,
    className: name,
    studentAccessCode: access,
    selectedIds: ids,
    override,
    overrideReason,
  });

  if (existingProgression?.state === 'committed' && existingProgression.targetClassCode) {
    const committedTarget = preserveClassCode(existingProgression.targetClassCode);
    const sameRequest = !existingProgression.requestHash || existingProgression.requestHash === requestHash;
    if (sameCode(committedTarget, target) && sameRequest) {
      return {
        ok: true,
        already: true,
        targetClassCode: committedTarget,
        requestHash,
        writes: [],
        studentCount: existingProgression.studentIds?.length || 0,
      };
    }
    return { ok: false, status: 409, error: 'Lớp nguồn đã có một chuyển cấp khác.' };
  }
  const resumable = existingProgression?.state === 'failed'
    || existingProgression?.state === 'prepared'
    || existingProgression?.state === 'preparing';
  if (
    existingProgression?.requestHash
    && existingProgression.requestHash !== requestHash
    && existingProgression.state !== 'rolled_back'
    && !(resumable && sameCode(existingProgression.targetClassCode, target))
  ) {
    return { ok: false, status: 409, error: 'Đang có một Up Level khác cho lớp này.' };
  }

  if (!target || sameCode(target, sourceCode)) {
    return { ok: false, error: 'Mã lớp đích phải khác mã lớp nguồn.' };
  }
  if (!sameCode(confirm, target)) return { ok: false, error: 'Hãy gõ lại đúng mã lớp đích.' };
  if (!program?.id) return { ok: false, error: 'Hãy chọn một chương trình đã có.' };
  if (!name) return { ok: false, error: 'Hãy nhập tên lớp đích.' };

  const gate = upLevelGate(source.curriculumCurrentSession, sessionTotal);
  if (!gate.ready && override !== true) {
    return { ok: false, error: 'Lớp chưa tới buổi cuối.' };
  }
  if (!gate.ready && !String(overrideReason || '').trim()) {
    return { ok: false, error: 'Hãy ghi lý do mở sớm.' };
  }
  if (gameOpen || uploadOpen) {
    return { ok: false, error: 'Hãy đóng phiên Spy, Showdown hoặc bài nộp đang mở trước khi chuyển lớp.' };
  }
  if (existingProgression?.targetClassCode && !sameCode(existingProgression.targetClassCode, target)) {
    return { ok: false, status: 409, error: 'Đang có một Up Level khác cho lớp này.' };
  }

  const sameOperation = Boolean(
    targetClass &&
      (sameCode(targetClass.previousClassCode, sourceCode) || sameCode(existingProgression?.targetClassCode, target)),
  );
  if (targetClass && !sameOperation) return { ok: false, error: 'Mã lớp đã tồn tại.' };
  if (targetHasReports && !sameOperation) return { ok: false, error: 'Mã lớp đã tồn tại.' };

  const suggestion = suggestStudentAccessCode(target);
  if (suggestion.needsChoice && !suggestion.options.includes(access)) {
    return { ok: false, error: 'Hãy chọn một mã ngắn.' };
  }

  const selected = [];
  for (const id of ids) {
    const student = students.find((item) => item.id === id);
    const home = student ? homeClass(student) : '';
    if (!student?.active || (!sameCode(home, sourceCode) && !sameCode(home, target))) {
      return { ok: false, error: 'Học sinh không thuộc lớp nguồn.' };
    }
    selected.push(student);
  }
  if (!selected.length) return { ok: false, error: 'Hãy chọn ít nhất một học sinh.' };

  const selectedSet = new Set(selected.map((student) => student.id));
  const excluded = students.filter(
    (student) => student.active && sameCode(homeClass(student), sourceCode) && !selectedSet.has(student.id),
  );
  const operationId = progressionId(sourceCode);
  const cohortId = source.cohortId || `cohort_${sourceCode}`;
  const early = !gate.ready;
  const writes = [
    {
      collection: 'classProgressions',
      id: operationId,
      step: 'prepare',
      data: progressionBody({
        operationId,
        source,
        target,
        program,
        selected,
        excluded,
        state: 'preparing',
        early,
        actor,
        requestHash,
        overrideReason,
      }),
    },
    {
      collection: 'classes',
      id: target,
      step: 'prepare',
      once: true,
      data: {
        classCode: target,
        className: name,
        status: 'preparing',
        hidden: true,
        pinRequired: true,
        curriculumProgramId: program.id,
        curriculumPhase: 'learning',
        curriculumCurrentSession: 0,
        finalMode: program.finalMode === 'exam' ? 'exam' : 'project',
        previousClassCode: sourceCode,
        nextClassCode: '',
        studentAccessCode: access,
        studentCount: selected.length,
        cohortId,
        driveFolderId: '',
      },
    },
  ];

  for (const student of selected) {
    writes.push({
      collection: 'classEnrollments',
      id: enrollmentDocId(sourceCode, student.id),
      step: 'prepare',
      data: {
        classCode: sourceCode,
        studentId: student.id,
        status: 'completed',
        sourceClassCode: sourceCode,
        targetClassCode: target,
      },
    });
    if (sameCode(homeClass(student), sourceCode)) {
      writes.push({
        collection: 'classStudentStates',
        id: enrollmentDocId(sourceCode, student.id),
        step: 'prepare',
        once: true,
        data: sourceStateSnapshot(student, sourceCode),
      });
    }
    writes.push(
      {
        collection: 'classEnrollments',
        id: enrollmentDocId(target, student.id),
        step: 'prepare',
        data: {
          classCode: target,
          studentId: student.id,
          status: 'active',
          sourceClassCode: sourceCode,
          targetClassCode: target,
        },
      },
      {
        collection: 'classStudentStates',
        id: enrollmentDocId(target, student.id),
        step: 'prepare',
        once: true,
        data: freshTargetState(student.id, target),
      },
      {
        collection: 'students',
        id: student.id,
        step: 'commit',
        kind: 'mirror',
        data: freshStudentMirror(target),
      },
    );
  }

  for (const student of excluded) {
    writes.push(
      {
        collection: 'classEnrollments',
        id: enrollmentDocId(sourceCode, student.id),
        step: 'prepare',
        data: {
          classCode: sourceCode,
          studentId: student.id,
          status: 'active',
          sourceClassCode: sourceCode,
          targetClassCode: target,
        },
      },
      {
        collection: 'classStudentStates',
        id: enrollmentDocId(sourceCode, student.id),
        step: 'prepare',
        once: true,
        data: sourceStateSnapshot(student, sourceCode),
      },
    );
  }

  writes.push(
    {
      collection: 'classes',
      id: sourceCode,
      step: 'commit',
      data: {
        nextClassCode: target,
        status: 'completed',
        cohortId,
      },
    },
    {
      collection: 'classes',
      id: target,
      step: 'commit',
      data: {
        hidden: false,
        status: 'active',
        studentCount: selected.length,
      },
    },
    {
      collection: 'classProgressions',
      id: operationId,
      step: 'commit',
      data: progressionBody({
        operationId,
        source,
        target,
        program,
        selected,
        excluded,
        state: 'committed',
        early,
        actor,
        requestHash,
        overrideReason,
      }),
    },
  );

  const knownCredentials = Array.isArray(credentialStudentIds) ? new Set(credentialStudentIds) : null;
  const missingPinIds = knownCredentials
    ? selected.filter((student) => !knownCredentials.has(student.id)).map((student) => student.id)
    : [];
  const warnings = missingPinIds.map((id) => `Học sinh ${id} chưa có PIN để giữ. Em sẽ tự tạo PIN 4 số, không có mã kích hoạt.`);

  return {
    ok: true,
    already: false,
    operationId,
    requestHash,
    targetClassCode: target,
    studentCount: selected.length,
    skippedCount: excluded.length,
    warnings,
    pinStatusCounts: knownCredentials
      ? { present: selected.length - missingPinIds.length, missing: missingPinIds.length }
      : null,
    writes,
  };
}
