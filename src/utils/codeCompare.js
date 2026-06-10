export function normalizeCodeForCompare(code) {
  return String(code ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

export function codeMatchesReferences(studentCode, references) {
  const normalized = normalizeCodeForCompare(studentCode);
  if (!normalized) return false;
  const refs = Array.isArray(references)
    ? references
    : references
      ? [String(references)]
      : [];
  return refs.some((ref) => normalizeCodeForCompare(ref) === normalized);
}

export function parseReferenceCodeBlock(text) {
  return String(text ?? '')
    .split(/\n---\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatReferenceCodeBlock(references) {
  const list = Array.isArray(references) ? references : references ? [String(references)] : [];
  return list.map((r) => String(r).trim()).filter(Boolean).join('\n---\n');
}
