/** Nhóm môn để rút gọn filter lớp / chương trình. */
export const SUBJECT_FILTERS = [
  { id: 'all', label: 'Tất cả' },
  {
    id: 'python',
    label: 'Python',
    match: ({ id, subject, name }) =>
      /python/.test(id) || /python/.test(subject) || /python/.test(name),
  },
  {
    id: 'scratch',
    label: 'Scratch',
    match: ({ id, subject, name }) =>
      /scratch/.test(id) || /scratch/.test(subject) || /scratch/.test(name),
  },
  {
    id: 'gamemaker',
    label: 'Game Maker',
    match: ({ id, subject, name }) =>
      /game\s*maker|gamemaker|gmk/.test(`${id} ${subject} ${name}`),
  },
  {
    id: 'javascript',
    label: 'Javascript',
    match: ({ id, subject, name }) =>
      /javascript|\bjs\b|node/.test(`${id} ${subject} ${name}`),
  },
  {
    id: 'cs',
    label: 'Computer Science',
    match: ({ id, subject, name }) =>
      /computer\s*science|\bcs\b|tin\s*học/.test(`${id} ${subject} ${name}`),
  },
  {
    id: 'web',
    label: 'Web',
    match: ({ id, subject, name }) =>
      /web|html|css|react|vue|angular|frontend|fullstack|website|next\.?js|lap\s*trình\s*web/.test(
        `${id} ${subject} ${name}`,
      ),
  },
];

const MATCHABLE_SUBJECTS = SUBJECT_FILTERS.filter((g) => g.id !== 'all');

function programMeta(programId, program) {
  const id = String(programId || program?.id || '').toLowerCase();
  const subject = String(program?.subject || '').toLowerCase();
  const name = String(program?.name || '').toLowerCase();
  return { id, subject, name };
}

export function resolveProgramSubject(programId, program = null) {
  const meta = programMeta(programId, program);
  if (!meta.id && !meta.name && !meta.subject) return 'web';
  const hit = MATCHABLE_SUBJECTS.find((g) => g.match(meta));
  return hit?.id || 'web';
}

export function resolveClassSubject(classDoc, programsById = {}) {
  const program = programsById[classDoc?.curriculumProgramId];
  return resolveProgramSubject(classDoc?.curriculumProgramId, program);
}

export function filterClassesBySubject(classes, subjectId, programsById = {}) {
  if (!subjectId || subjectId === 'all') return classes;
  return classes.filter((c) => resolveClassSubject(c, programsById) === subjectId);
}

export function subjectsWithClasses(classes, programsById = {}) {
  const ids = new Set(classes.map((c) => resolveClassSubject(c, programsById)));
  return SUBJECT_FILTERS.filter((g) => g.id === 'all' || ids.has(g.id));
}

export function groupProgramsBySubject(programs = []) {
  const buckets = new Map(MATCHABLE_SUBJECTS.map((g) => [g.id, []]));

  for (const program of programs) {
    const subjectId = resolveProgramSubject(program.id, program);
    const bucket = buckets.get(subjectId) || buckets.get('web');
    bucket.push(program);
  }

  return MATCHABLE_SUBJECTS.map((g) => ({
    id: g.id,
    label: g.label,
    programs: (buckets.get(g.id) || []).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  })).filter((g) => g.programs.length > 0);
}

export function formatClassOptionLabel(cls, { compact = false, showCount = false } = {}) {
  const count = showCount ? ` (${cls.studentCount ?? 0})` : '';
  if (compact) return `${cls.classCode}${count}`;
  const name = cls.className ? ` · ${cls.className}` : '';
  return `${cls.classCode}${name}${count}`;
}
