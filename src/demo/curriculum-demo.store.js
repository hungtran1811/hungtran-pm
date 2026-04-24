import {
  DEMO_CURRICULUM_PROGRAMS,
  getDemoFinalChecklist,
  getDemoLessons,
  getDemoProgram,
} from './curriculum-demo.data.js';

const STORAGE_KEY = 'hungtranpm:demo-curriculum-preview';
const LEGACY_PROGRAM_ID_MAP = {
  'game-basic': 'gamemaker-basic',
};

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getProgramAliases(program) {
  const aliases = [program.name, program.subject, program.level];

  if (program.id === 'gamemaker-basic') {
    aliases.push('game basic', 'game');
  }

  if (program.subject === 'Gamemaker') {
    aliases.push('game maker', 'game');
  }

  if (program.subject === 'Python App') {
    aliases.push('python');
  }

  if (program.subject === 'Computer Science') {
    aliases.push('computer science', 'cs');
  }

  if (program.subject === 'Web') {
    aliases.push('website', 'web app', 'html', 'css', 'javascript', 'js', 'frontend', 'front end');
  }

  return aliases.map(normalizeText).filter(Boolean);
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function resolveDemoProgramId(programId) {
  const normalizedProgramId = LEGACY_PROGRAM_ID_MAP[programId] || programId;
  const hasProgram = DEMO_CURRICULUM_PROGRAMS.some((program) => program.id === normalizedProgramId);
  return hasProgram ? normalizedProgramId : getDefaultDemoProgramId();
}

function sanitizeAssignment(rawAssignment = {}) {
  const programId = resolveDemoProgramId(rawAssignment.programId);

  return {
    programId,
    currentSession: clampDemoCurriculumSession(programId, rawAssignment.currentSession ?? 1),
    curriculumPhase: rawAssignment.curriculumPhase === 'final' ? 'final' : 'learning',
    programSelectionMode: rawAssignment.programSelectionMode === 'manual' ? 'manual' : 'auto',
  };
}

function loadStoredAssignments() {
  if (!canUseStorage()) {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return {};
    }

    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([classCode, assignment]) => [classCode, sanitizeAssignment(assignment)]),
    );
  } catch {
    return {};
  }
}

function persistAssignments(value) {
  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Demo-only state; ignore storage failures.
  }
}

export function getDefaultDemoProgramId() {
  return DEMO_CURRICULUM_PROGRAMS[0]?.id || '';
}

export function clampDemoCurriculumSession(programId, sessionNumber) {
  const program = getDemoProgram(resolveDemoProgramId(programId));
  const maxSession = Math.max(
    1,
    Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || 1),
  );
  const numericSession = Number(sessionNumber || 1);
  return Math.min(maxSession, Math.max(1, Number.isFinite(numericSession) ? numericSession : 1));
}

export function createDemoCurriculumAssignment(programId = getDefaultDemoProgramId()) {
  const resolvedProgramId = resolveDemoProgramId(programId);

  return {
    programId: resolvedProgramId,
    currentSession: clampDemoCurriculumSession(resolvedProgramId, 1),
    curriculumPhase: 'learning',
    programSelectionMode: 'auto',
  };
}

const previewAssignments = loadStoredAssignments();

export function getDemoCurriculumAssignment(classCode) {
  if (!classCode) {
    return null;
  }

  const assignment = previewAssignments[classCode];

  if (!assignment) {
    return null;
  }

  const sanitizedAssignment = sanitizeAssignment(assignment);

  if (JSON.stringify(sanitizedAssignment) !== JSON.stringify(assignment)) {
    previewAssignments[classCode] = sanitizedAssignment;
    persistAssignments(previewAssignments);
  }

  return sanitizedAssignment;
}

export function suggestDemoProgramIdForClass(classInfo = null) {
  const haystack = normalizeText(`${classInfo?.classCode || ''} ${classInfo?.className || ''}`);

  if (!haystack) {
    return getDefaultDemoProgramId();
  }

  let bestProgramId = getDefaultDemoProgramId();
  let bestScore = -1;

  DEMO_CURRICULUM_PROGRAMS.forEach((program) => {
    const aliases = getProgramAliases(program);
    let score = 0;

    aliases.forEach((alias) => {
      if (!alias) {
        return;
      }

      if (haystack.includes(alias)) {
        score += alias === normalizeText(program.name) ? 6 : 3;
      }
    });

    if (haystack.includes(normalizeText(program.level))) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestProgramId = program.id;
    }
  });

  return bestProgramId;
}

export function ensureDemoCurriculumAssignment(classCode, fallbackProgramId = getDefaultDemoProgramId()) {
  if (!classCode) {
    return createDemoCurriculumAssignment(fallbackProgramId);
  }

  if (!previewAssignments[classCode]) {
    previewAssignments[classCode] = createDemoCurriculumAssignment(fallbackProgramId);
    persistAssignments(previewAssignments);
    return previewAssignments[classCode];
  }

  const sanitizedAssignment = sanitizeAssignment(previewAssignments[classCode]);
  previewAssignments[classCode] = sanitizedAssignment;
  persistAssignments(previewAssignments);
  return sanitizedAssignment;
}

export function applySuggestedDemoProgramId(classCode, suggestedProgramId = getDefaultDemoProgramId()) {
  if (!classCode) {
    return null;
  }

  const assignment = getDemoCurriculumAssignment(classCode);
  const resolvedSuggestedProgramId = resolveDemoProgramId(suggestedProgramId);

  if (!assignment) {
    return updateDemoCurriculumAssignment(classCode, {
      programId: resolvedSuggestedProgramId,
      programSelectionMode: 'auto',
    });
  }

  if (assignment.programSelectionMode === 'manual') {
    return assignment;
  }

  if (assignment.programId === resolvedSuggestedProgramId) {
    return assignment;
  }

  return updateDemoCurriculumAssignment(classCode, {
    programId: resolvedSuggestedProgramId,
    programSelectionMode: 'auto',
  });
}

export function updateDemoCurriculumAssignment(classCode, patch = {}) {
  if (!classCode) {
    return null;
  }

  const current = ensureDemoCurriculumAssignment(classCode, patch.programId);
  const nextProgramId = resolveDemoProgramId(patch.programId || current.programId || getDefaultDemoProgramId());
  const nextAssignment = sanitizeAssignment({
    ...current,
    ...patch,
    programId: nextProgramId,
    currentSession: patch.currentSession ?? current.currentSession,
    curriculumPhase: patch.curriculumPhase ?? current.curriculumPhase,
    programSelectionMode: patch.programSelectionMode ?? current.programSelectionMode,
  });

  previewAssignments[classCode] = nextAssignment;
  persistAssignments(previewAssignments);
  return nextAssignment;
}

export function clearDemoCurriculumAssignments() {
  Object.keys(previewAssignments).forEach((key) => {
    delete previewAssignments[key];
  });
  persistAssignments(previewAssignments);
}

export function getDemoCurriculumPreviewByClass(classCode) {
  const assignment = getDemoCurriculumAssignment(classCode);

  if (!assignment) {
    return null;
  }

  const program = getDemoProgram(resolveDemoProgramId(assignment.programId));
  const lessons = getDemoLessons(program?.id);
  const visibleLessons = lessons.filter((lesson) => lesson.sessionNumber <= assignment.currentSession);
  const checklistItems = getDemoFinalChecklist(program?.id);

  return {
    assignment,
    program,
    lessons,
    visibleLessons,
    checklistItems,
  };
}
