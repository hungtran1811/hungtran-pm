import { resolveFinalMode } from './classFinalMode.js';

export function studentClassBasePath(classCode) {
  return `/c/${encodeURIComponent(classCode || '')}`;
}

export function studentUsesProjectWorkspace(classDoc, program) {
  return classDoc?.curriculumPhase === 'final' && resolveFinalMode(classDoc, program) === 'project';
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
