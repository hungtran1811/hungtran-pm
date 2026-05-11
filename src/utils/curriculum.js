const LEVEL_ORDER = {
  Basic: 1,
  Advanced: 2,
  Intensive: 3,
};

export function normalizeCurriculumText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getProgramAliases(program) {
  const aliases = [program?.name, program?.subject, program?.level];

  if (program?.id === 'gamemaker-basic') {
    aliases.push('game basic', 'game');
  }

  if (program?.subject === 'Gamemaker') {
    aliases.push('game maker', 'game');
  }

  if (program?.subject === 'Python App') {
    aliases.push('python');
  }

  if (program?.subject === 'Computer Science') {
    aliases.push('computer science', 'cs');
  }

  if (program?.subject === 'Web') {
    aliases.push('website', 'web app', 'html', 'css', 'javascript', 'js', 'frontend', 'front end');
  }

  return aliases.map(normalizeCurriculumText).filter(Boolean);
}

export function getDefaultCurriculumProgramId(programs = []) {
  return programs[0]?.id || '';
}

export function sortCurriculumPrograms(programs = []) {
  return [...programs].sort((left, right) => {
    if (left.subject !== right.subject) {
      return left.subject.localeCompare(right.subject, 'vi');
    }

    const leftLevelOrder = LEVEL_ORDER[left.level] || 99;
    const rightLevelOrder = LEVEL_ORDER[right.level] || 99;

    if (leftLevelOrder !== rightLevelOrder) {
      return leftLevelOrder - rightLevelOrder;
    }

    return left.name.localeCompare(right.name, 'vi');
  });
}

export function groupCurriculumProgramsBySubject(programs = []) {
  const groups = new Map();

  sortCurriculumPrograms(programs).forEach((program) => {
    if (!groups.has(program.subject)) {
      groups.set(program.subject, []);
    }

    groups.get(program.subject).push(program);
  });

  return Array.from(groups.entries()).map(([subject, subjectPrograms]) => ({
    subject,
    programs: subjectPrograms,
  }));
}

export function clampCurriculumSession(program, sessionNumber) {
  const maxSession = Math.max(
    1,
    Number(program?.totalSessionCount || program?.knowledgePhaseEndSession || 1),
  );
  const numericSession = Number(sessionNumber || 1);
  return Math.min(maxSession, Math.max(1, Number.isFinite(numericSession) ? numericSession : 1));
}

export function normalizeCurriculumExerciseVisibleSessions(value = [], program = null) {
  const rawValues = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.entries(value)
          .filter(([, visible]) => Boolean(visible))
          .map(([sessionNumber]) => sessionNumber)
      : [];
  const sessionLimit = program
    ? Math.max(1, Number(program.totalSessionCount || program.knowledgePhaseEndSession || 1))
    : Number.POSITIVE_INFINITY;
  const uniqueSessions = new Set();

  rawValues.forEach((item) => {
    const sessionNumber = Number(item || 0);

    if (Number.isFinite(sessionNumber) && sessionNumber >= 1 && sessionNumber <= sessionLimit) {
      uniqueSessions.add(Math.floor(sessionNumber));
    }
  });

  return [...uniqueSessions].sort((left, right) => left - right);
}

export function isCurriculumExerciseVisibleForSession(assignment = {}, sessionNumber = 0) {
  const visibleSessions = normalizeCurriculumExerciseVisibleSessions(assignment.exerciseVisibleSessions);
  return visibleSessions.includes(Number(sessionNumber || 0));
}

export function setCurriculumExerciseVisibleForSession(assignment = {}, sessionNumber = 0, visible = false, program = null) {
  const normalizedSession = clampCurriculumSession(program, sessionNumber);
  const visibleSessions = new Set(normalizeCurriculumExerciseVisibleSessions(assignment.exerciseVisibleSessions, program));

  if (visible) {
    visibleSessions.add(normalizedSession);
  } else {
    visibleSessions.delete(normalizedSession);
  }

  return [...visibleSessions].sort((left, right) => left - right);
}

export function suggestCurriculumProgramIdForClass(programs = [], classInfo = null) {
  const fallbackProgramId = getDefaultCurriculumProgramId(programs);
  const haystack = normalizeCurriculumText(`${classInfo?.classCode || ''} ${classInfo?.className || ''}`);

  if (!haystack) {
    return fallbackProgramId;
  }

  let bestProgramId = fallbackProgramId;
  let bestScore = -1;

  programs.forEach((program) => {
    const aliases = getProgramAliases(program);
    let score = 0;

    aliases.forEach((alias) => {
      if (!alias) {
        return;
      }

      if (haystack.includes(alias)) {
        score += alias === normalizeCurriculumText(program.name) ? 6 : 3;
      }
    });

    if (haystack.includes(normalizeCurriculumText(program.level))) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestProgramId = program.id;
    }
  });

  return bestProgramId;
}

export function getSuggestedCurriculumAssignment(classInfo = null, programs = []) {
  const programId = classInfo?.curriculumProgramId || suggestCurriculumProgramIdForClass(programs, classInfo);
  const program = programs.find((item) => item.id === programId) || null;

  return {
    programId,
    currentSession: clampCurriculumSession(program, classInfo?.curriculumCurrentSession || 1),
    curriculumPhase: classInfo?.curriculumPhase === 'final' ? 'final' : 'learning',
    exerciseVisibleSessions: normalizeCurriculumExerciseVisibleSessions(
      classInfo?.curriculumExerciseVisibleSessions,
      program,
    ),
  };
}
