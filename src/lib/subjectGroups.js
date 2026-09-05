/** Nhóm môn để rút gọn filter lớp / chương trình. */
export const OTHER_SUBJECT_ID = 'other';

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
  { id: OTHER_SUBJECT_ID, label: 'Khác' },
];

export const LEVEL_FILTERS = [
  { id: 'basic', label: 'Cơ bản' },
  { id: 'advanced', label: 'Nâng cao' },
  { id: 'intensive', label: 'Tăng cường' },
  { id: 'other', label: 'Khác' },
];

const MATCHABLE_SUBJECTS = SUBJECT_FILTERS.filter((g) => typeof g.match === 'function');

export const SUBJECT_FORM_OPTIONS = MATCHABLE_SUBJECTS.map(({ id, label }) => ({ id, label }));
export const LEVEL_FORM_OPTIONS = LEVEL_FILTERS.filter((l) => l.id !== 'other');

const LEVEL_MATCHERS = [
  { id: 'basic', re: /basic|co ban|cơ bản/ },
  { id: 'advanced', re: /advanced|nang cao|nâng cao/ },
  { id: 'intensive', re: /intensive|tang cuong|tăng cường/ },
];

function foldText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function slugSubject(text) {
  const slug = foldText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || OTHER_SUBJECT_ID;
}

function programMeta(programId, program) {
  const id = String(programId || program?.id || '').toLowerCase();
  const subject = String(program?.subject || '').toLowerCase();
  const name = String(program?.name || '').toLowerCase();
  return { id, subject, name };
}

function knownSubjectOrder() {
  const order = new Map();
  let index = 0;
  SUBJECT_FILTERS.filter((g) => g.id !== 'all' && g.id !== OTHER_SUBJECT_ID).forEach((g) => {
    order.set(g.id, index);
    index += 1;
  });
  order.set(OTHER_SUBJECT_ID, 1000);
  return order;
}

function sortSubjectGroups(groups) {
  const order = knownSubjectOrder();
  return groups.sort((a, b) => {
    const ia = order.has(a.id) ? order.get(a.id) : 500;
    const ib = order.has(b.id) ? order.get(b.id) : 500;
    if (ia !== ib) return ia - ib;
    return a.label.localeCompare(b.label, 'vi');
  });
}

export function resolveProgramSubjectMeta(programId, program = null) {
  const meta = programMeta(programId, program);
  const hit = MATCHABLE_SUBJECTS.find((g) => g.match(meta));
  if (hit) return { id: hit.id, label: hit.label };

  const raw = String(program?.subject || '').trim();
  if (raw) {
    const id = slugSubject(raw);
    if (id !== OTHER_SUBJECT_ID && !MATCHABLE_SUBJECTS.some((g) => g.id === id)) {
      return { id, label: raw };
    }
  }
  return { id: OTHER_SUBJECT_ID, label: 'Khác' };
}

export function resolveProgramSubject(programId, program = null) {
  const meta = resolveProgramSubjectMeta(programId, program);
  if (MATCHABLE_SUBJECTS.some((g) => g.id === meta.id) || meta.id === OTHER_SUBJECT_ID) {
    return meta.id;
  }
  return OTHER_SUBJECT_ID;
}

export function resolveProgramLevel(program = null) {
  const levelText = foldText(program?.level);
  for (const matcher of LEVEL_MATCHERS) {
    if (matcher.re.test(levelText)) return matcher.id;
  }
  const blob = `${foldText(program?.id)} ${foldText(program?.name)}`;
  for (const matcher of LEVEL_MATCHERS) {
    if (matcher.re.test(blob)) return matcher.id;
  }
  return 'other';
}

export function resolveProgramLevelMeta(program = null) {
  const id = resolveProgramLevel(program);
  const hit = LEVEL_FILTERS.find((l) => l.id === id);
  return { id, label: hit?.label || 'Khác' };
}

export function canonicalProgramSubjectValue(program) {
  const meta = resolveProgramSubjectMeta(program?.id, program);
  if (MATCHABLE_SUBJECTS.some((g) => g.id === meta.id)) return meta.id;
  return String(program?.subject || '').trim();
}

export function canonicalProgramLevelValue(program) {
  const id = resolveProgramLevel(program);
  if (id !== 'other') return id;
  return String(program?.level || '').trim();
}

export function resolveClassSubject(classDoc, programsById = {}) {
  const program = programsById[classDoc?.curriculumProgramId];
  return resolveProgramSubjectMeta(classDoc?.curriculumProgramId, program).id;
}

export function resolveClassSubjectMeta(classDoc, programsById = {}) {
  const program = programsById[classDoc?.curriculumProgramId];
  return resolveProgramSubjectMeta(classDoc?.curriculumProgramId, program);
}

export function filterClassesBySubject(classes, subjectId, programsById = {}) {
  if (!subjectId || subjectId === 'all') return classes;
  return classes.filter((c) => resolveClassSubject(c, programsById) === subjectId);
}

export function subjectsWithClasses(classes, programsById = {}) {
  const present = new Map();
  classes.forEach((classDoc) => {
    const meta = resolveClassSubjectMeta(classDoc, programsById);
    present.set(meta.id, meta.label);
  });
  const known = SUBJECT_FILTERS.filter(
    (g) => g.id === 'all' || (g.match && present.has(g.id)),
  );
  const extras = [...present.entries()]
    .filter(([id]) => !SUBJECT_FILTERS.some((g) => g.id === id))
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
    .map(([id, label]) => ({ id, label }));
  const other = present.has(OTHER_SUBJECT_ID)
    ? [{ id: OTHER_SUBJECT_ID, label: 'Khác' }]
    : [];
  return [...known, ...extras, ...other];
}

export function subjectsWithPrograms(programs = []) {
  const present = new Map();
  programs.forEach((program) => {
    const meta = resolveProgramSubjectMeta(program.id, program);
    present.set(meta.id, meta.label);
  });
  const known = SUBJECT_FILTERS.filter(
    (g) => g.id === 'all' || (g.match && present.has(g.id)),
  );
  const extras = [...present.entries()]
    .filter(([id]) => !SUBJECT_FILTERS.some((g) => g.id === id))
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
    .map(([id, label]) => ({ id, label }));
  const other = present.has(OTHER_SUBJECT_ID)
    ? [{ id: OTHER_SUBJECT_ID, label: 'Khác' }]
    : [];
  return [...known, ...extras, ...other];
}

export function groupProgramsBySubject(programs = []) {
  const buckets = new Map();
  for (const program of programs) {
    const { id, label } = resolveProgramSubjectMeta(program.id, program);
    if (!buckets.has(id)) buckets.set(id, { id, label, programs: [] });
    buckets.get(id).programs.push(program);
  }

  return sortSubjectGroups([...buckets.values()]).map((group) => ({
    ...group,
    programs: group.programs.sort((a, b) => a.name.localeCompare(b.name, 'vi')),
  }));
}

export function groupProgramsBySubjectAndLevel(programs = []) {
  const subjectMap = new Map();
  const levelOrder = new Map(LEVEL_FILTERS.map((level, index) => [level.id, index]));

  for (const program of programs) {
    const subject = resolveProgramSubjectMeta(program.id, program);
    const level = resolveProgramLevelMeta(program);
    if (!subjectMap.has(subject.id)) {
      subjectMap.set(subject.id, { id: subject.id, label: subject.label, levels: new Map() });
    }
    const levels = subjectMap.get(subject.id).levels;
    if (!levels.has(level.id)) {
      levels.set(level.id, { id: level.id, label: level.label, programs: [] });
    }
    levels.get(level.id).programs.push(program);
  }

  return sortSubjectGroups([...subjectMap.values()]).map((group) => ({
    id: group.id,
    label: group.label,
    levels: [...group.levels.values()]
      .map((level) => ({
        ...level,
        programs: level.programs.sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      }))
      .sort((a, b) => (levelOrder.get(a.id) ?? 99) - (levelOrder.get(b.id) ?? 99)),
  }));
}

function firstVisibleProgram(programs = []) {
  return programs.find((program) => program.active !== false) || programs[0] || null;
}

/** Chương trình đầu tiên của môn: ưu tiên Cơ bản, không thì cấp còn lại theo thứ tự. */
export function firstProgramForSubject(programs = [], subjectId, preferredLevel = 'basic') {
  if (!subjectId || subjectId === 'all') return null;
  const groups = groupProgramsBySubjectAndLevel(
    programs.filter((program) => resolveProgramSubjectMeta(program.id, program).id === subjectId),
  );
  const group = groups[0];
  if (!group) return null;
  const preferred = group.levels.find((level) => level.id === preferredLevel);
  return firstVisibleProgram(preferred?.programs) || firstVisibleProgram(group.levels[0]?.programs);
}

export function formatClassOptionLabel(cls, { compact = false, showCount = false } = {}) {
  const count = showCount ? ` (${cls.studentCount ?? 0})` : '';
  if (compact) return `${cls.classCode}${count}`;
  const name = cls.className ? ` · ${cls.className}` : '';
  return `${cls.classCode}${name}${count}`;
}
