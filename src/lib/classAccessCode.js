const ACCESS_CODE_PATTERN = /^[A-Z]{2,5}[0-9]{1,4}$/;

export const AMBIGUOUS_CLASS_MESSAGE =
  'Có nhiều lớp dùng mã này. Hãy nhập mã lớp đầy đủ được giáo viên cung cấp.';

export function normalizeClassLookupInput(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classCodeSegments(classCode) {
  return normalizeClassLookupInput(classCode)
    .split('-')
    .filter(Boolean);
}

export function suggestStudentAccessCode(classCode) {
  const options = classCodeSegments(classCode).filter((segment) => ACCESS_CODE_PATTERN.test(segment));
  if (options.length === 1) return { code: options[0], needsChoice: false, options };
  if (options.length > 1) return { code: '', needsChoice: true, options };
  return { code: '', needsChoice: false, options: [] };
}

export function classShortCodes(classDoc) {
  const codes = new Set();
  const stored = normalizeClassLookupInput(classDoc?.studentAccessCode || '');
  if (stored) codes.add(stored);
  for (const segment of classCodeSegments(classDoc?.classCode)) {
    if (ACCESS_CODE_PATTERN.test(segment)) codes.add(segment);
  }
  return [...codes];
}

export function classIsLookupEligible(classDoc) {
  return Boolean(classDoc) && classDoc.status === 'active' && classDoc.hidden !== true;
}

function resolved(classDoc) {
  return {
    status: 'resolved',
    canonicalClassCode: classDoc.classCode,
    classLabel: classDoc.className || classDoc.classCode,
  };
}

export function resolveClassLookup(input, classes = []) {
  const normalized = normalizeClassLookupInput(input);
  if (!normalized) return { status: 'not_found' };

  const list = Array.isArray(classes) ? classes : [];
  const full = list.filter((classDoc) => normalizeClassLookupInput(classDoc.classCode) === normalized);
  if (full.length) {
    const open = full.filter(classIsLookupEligible);
    if (open.length === 1) return resolved(open[0]);
    if (!open.length) return { status: 'unavailable' };
    return { status: 'ambiguous', message: AMBIGUOUS_CLASS_MESSAGE };
  }

  const alias = list.filter((classDoc) => classShortCodes(classDoc).includes(normalized));
  const openAlias = alias.filter(classIsLookupEligible);
  if (openAlias.length === 1) return resolved(openAlias[0]);
  if (openAlias.length > 1) return { status: 'ambiguous', message: AMBIGUOUS_CLASS_MESSAGE };
  if (alias.length) return { status: 'unavailable' };
  return { status: 'not_found' };
}

export function findActiveAliasConflicts(accessCode, classes = [], exceptClassCode = '') {
  const normalized = normalizeClassLookupInput(accessCode);
  if (!normalized) return [];
  const except = normalizeClassLookupInput(exceptClassCode);
  return classes.filter(
    (classDoc) =>
      classIsLookupEligible(classDoc) &&
      normalizeClassLookupInput(classDoc.classCode) !== except &&
      classShortCodes(classDoc).includes(normalized),
  );
}
