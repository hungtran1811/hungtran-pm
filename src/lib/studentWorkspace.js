import { resolveFinalMode } from './classFinalMode.js';

export function studentClassBasePath(classCode) {
  return `/c/${encodeURIComponent(classCode || '')}`;
}

function decodePath(value) {
  try {
    return decodeURIComponent(value || '');
  } catch {
    return value || '';
  }
}

/** Chỉ tab đúng trang hiện tại được tính là đang chọn. Đường dẫn gốc của lớp không kéo theo các trang con. */
export function studentNavIsActive(to, location) {
  const raw = String(to || '');
  const hashIndex = raw.indexOf('#');
  const targetHash = hashIndex >= 0 ? raw.slice(hashIndex) : '';
  const targetPath = decodePath(hashIndex >= 0 ? raw.slice(0, hashIndex) : raw);
  const currentPath = decodePath(location?.pathname);
  const currentHash = location?.hash || '';
  if (targetHash) return currentPath === targetPath && currentHash === targetHash;
  const isClassRoot = /^\/c\/[^/]+$/.test(targetPath);
  if (isClassRoot) return currentPath === targetPath && currentHash !== '#tro-choi';
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

export function studentUsesProjectWorkspace(classDoc, program) {
  return classDoc?.curriculumPhase === 'final' && resolveFinalMode(classDoc, program) === 'project';
}

/** Lớp sản phẩm cuối khóa: bắt buộc báo cáo tiến độ + file sản phẩm. */
export function classRequiresProgressAndProduct(classDoc, program) {
  return studentUsesProjectWorkspace(classDoc, program);
}

export function findProgramForClass(classDoc, programs = []) {
  const programId = classDoc?.curriculumProgramId || classDoc?.programId;
  if (!programId) return null;
  return programs.find((item) => item.id === programId) ?? null;
}

export function studentWorkspaceHomePath(classCode, classDoc, program) {
  const base = studentClassBasePath(classCode);
  return studentUsesProjectWorkspace(classDoc, program) ? `${base}/project` : `${base}/learn`;
}

export function studentLessonsPath(classCode) {
  return `${studentClassBasePath(classCode)}/lessons`;
}

export function studentProjectPath(classCode) {
  return `${studentClassBasePath(classCode)}/project`;
}

export function studentLearnPath(classCode) {
  return `${studentClassBasePath(classCode)}/learn`;
}

export function studentSubmitPath(classCode) {
  return `${studentClassBasePath(classCode)}/submit`;
}

/** Ngữ cảnh buổi/phase trên header HS — không phải CTA. */
export function studentSessionContextLabel(classDoc, activeLessonSession = null) {
  const session = activeLessonSession ?? classDoc?.curriculumCurrentSession;
  const parts = [];
  if (session) parts.push(`Buổi ${session}`);
  if (classDoc?.curriculumPhase === 'final') parts.push('Sản phẩm');
  else if (classDoc?.curriculumPhase === 'learning') parts.push('Học');
  return parts.join(' · ');
}
