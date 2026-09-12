import { resolveFinalMode } from './classFinalMode.js';

export function studentClassBasePath(classCode) {
  return `/c/${encodeURIComponent(classCode || '')}`;
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
