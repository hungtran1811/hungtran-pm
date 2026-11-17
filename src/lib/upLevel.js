import { DEFAULT_STAGE, DEFAULT_STATUS } from '../constants/index.js';
import { normalizeClassLookupInput, suggestStudentAccessCode } from './classAccessCode.js';

export function progressionId(sourceClassCode) {
  return `uplevel_${normalizeClassLookupInput(sourceClassCode)}`;
}

export function enrollmentDocId(classCode, studentId) {
  return `${normalizeClassLookupInput(classCode)}__${studentId}`;
}

export function upLevelGate(currentSession, totalSessions) {
  const current = Number(currentSession) || 0;
  const total = Number(totalSessions) || 0;
  if (total > 0 && current >= total) return { ready: true, early: false };
  return { ready: false, early: true };
}

export function sourceStateSnapshot(student, classCode) {
  return {
    studentId: student.id,
    classCode,
    currentStatus: student.currentStatus || DEFAULT_STATUS,
    currentStage: student.currentStage || DEFAULT_STAGE,
    currentProgressPercent: Number(student.currentProgressPercent) || 0,
    currentDifficulties: student.currentDifficulties || '',
    projectName: student.projectName || '',
    projectNameStatus: student.projectNameStatus || '',
    projectGithubUrl: student.projectGithubUrl || '',
    projectCanvaUrl: student.projectCanvaUrl || '',
    projectSlidesUrl: student.projectSlidesUrl || '',
    projectOtherUrl: student.projectOtherUrl || '',
    latestReportId: student.latestReportId || '',
    lastReportedAt: student.lastReportedAt ?? null,
    openedLessonIds: Array.isArray(student.openedLessonIds) ? [...student.openedLessonIds] : [],
    lastOpenedLessonId: student.lastOpenedLessonId || '',
    lastOpenedSessionNumber: Number(student.lastOpenedSessionNumber) || 0,
  };
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
    projectNameStatus: '',
    projectGithubUrl: '',
    projectCanvaUrl: '',
    projectSlidesUrl: '',
    projectOtherUrl: '',
    latestReportId: '',
    lastReportedAt: null,
    openedLessonIds: [],
    lastOpenedLessonId: '',
    lastOpenedSessionNumber: 0,
  };
}

export function freshStudentMirror(classCode) {
  return {
    classId: classCode,
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
    progressStalledCount: 0,
  };
}

function homeClass(student) {
  return student.classId || student.classCode || '';
}

function progressionBody({ operationId, source, target, program, selected, excluded, state, early, actor }) {
  return {
    operationId,
    idempotencyKey: operationId,
    sourceClassCode: source.classCode,
    targetClassCode: target,
    sourceProgramId: source.curriculumProgramId || '',
    targetProgramId: program.id,
    studentIds: selected.map((student) => student.id),
    excludedStudentIds: excluded.map((student) => student.id),
    state,
    earlyOverride: early,
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
  actor = '',
  existingProgression = null,
  targetClass = null,
  targetHasReports = false,
  gameOpen = false,
  uploadOpen = false,
} = {}) {
  if (!source?.classCode) return { ok: false, error: 'Không tìm thấy lớp nguồn.' };
  if (existingProgression?.state === 'committed' && existingProgression.targetClassCode) {
    return {
      ok: true,
      already: true,
      targetClassCode: existingProgression.targetClassCode,
      writes: [],
      studentCount: existingProgression.studentIds?.length || 0,
    };
  }

  const sourceCode = normalizeClassLookupInput(source.classCode);
  const target = normalizeClassLookupInput(targetClassCode);
  const confirm = normalizeClassLookupInput(confirmCode);
  const access = normalizeClassLookupInput(studentAccessCode);
  const name = String(className || '').trim();
  const ids = Array.isArray(selectedIds) ? selectedIds.filter(Boolean) : [];

  if (!target || target === sourceCode) {
    return { ok: false, error: 'Mã lớp đích phải khác mã lớp nguồn.' };
  }
  if (confirm !== target) return { ok: false, error: 'Hãy gõ lại đúng mã lớp đích.' };
  if (!program?.id) return { ok: false, error: 'Hãy chọn một chương trình đã có.' };
  if (!name) return { ok: false, error: 'Hãy nhập tên lớp đích.' };

  const gate = upLevelGate(source.curriculumCurrentSession, sessionTotal);
  if (!gate.ready && override !== true) {
    return { ok: false, error: 'Lớp chưa tới buổi cuối.' };
  }
  if (gameOpen || uploadOpen) {
    return { ok: false, error: 'Hãy đóng phiên Spy, Showdown hoặc bài nộp đang mở trước khi chuyển lớp.' };
  }
  if (existingProgression?.targetClassCode && existingProgression.targetClassCode !== target) {
    return { ok: false, error: `Lớp này đã được chuyển sang ${existingProgression.targetClassCode}.` };
  }

  const sameOperation = Boolean(
    targetClass &&
      (targetClass.previousClassCode === sourceCode || existingProgression?.targetClassCode === target),
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
    const home = student ? normalizeClassLookupInput(homeClass(student)) : '';
    if (!student?.active || (home !== sourceCode && home !== target)) {
      return { ok: false, error: 'Học sinh không thuộc lớp nguồn.' };
    }
    selected.push(student);
  }
  if (!selected.length) return { ok: false, error: 'Hãy chọn ít nhất một học sinh.' };

  const selectedSet = new Set(selected.map((student) => student.id));
  const excluded = students.filter(
    (student) => student.active && normalizeClassLookupInput(homeClass(student)) === sourceCode && !selectedSet.has(student.id),
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
        status: 'active',
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
    if (normalizeClassLookupInput(homeClass(student)) === sourceCode) {
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
      }),
    },
  );

  return {
    ok: true,
    already: false,
    targetClassCode: target,
    studentCount: selected.length,
    writes,
  };
}
