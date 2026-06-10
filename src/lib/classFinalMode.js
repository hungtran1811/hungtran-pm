/** @typedef {'project' | 'exam'} FinalMode */

/**
 * @param {{ finalMode?: string } | null | undefined} classDoc
 * @param {{ finalMode?: string } | null | undefined} [program]
 * @returns {FinalMode}
 */
export function resolveFinalMode(classDoc, program) {
  if (classDoc?.finalMode === 'exam' || classDoc?.finalMode === 'project') {
    return classDoc.finalMode;
  }
  if (program?.finalMode === 'exam') return 'exam';
  return 'project';
}

/**
 * @param {{ projectName?: string, projectNameSubmission?: string, projectNameStatus?: string } | null | undefined} student
 */
export function isProjectNameApproved(student) {
  if (!student) return false;
  return student.projectNameStatus === 'approved';
}

/** Admin điền tay hoặc học sinh gửi — chưa có trạng thái approved. */
export function isLegacyUnapprovedProject(student) {
  if (!student || student.projectNameStatus) return false;
  return Boolean(student.projectName?.trim());
}

export function canReviewProjectName(student) {
  if (!student) return false;
  if (student.projectNameStatus === 'pending') return true;
  return isLegacyUnapprovedProject(student);
}

export function canReviewStudentProjectName(student, classDoc) {
  return classUsesProjectNames(classDoc) && canReviewProjectName(student);
}

export function projectNameAwaitingReview(student) {
  if (!student) return '';
  if (student.projectNameStatus === 'pending') return student.projectNameSubmission?.trim() || '';
  if (isLegacyUnapprovedProject(student)) return student.projectName?.trim() || '';
  return '';
}

/**
 * @param {{ finalMode?: string } | null | undefined} classDoc
 * @param {{ finalMode?: string } | null | undefined} [program]
 */
export function classUsesProjectNames(classDoc, program) {
  return resolveFinalMode(classDoc, program) === 'project';
}

/**
 * @param {{ projectNameStatus?: string } | null | undefined} student
 * @param {{ finalMode?: string } | null | undefined} classDoc
 * @param {{ finalMode?: string } | null | undefined} [program]
 */
export function needsProjectNameSetup(student, classDoc, program) {
  if (!classUsesProjectNames(classDoc, program)) return false;
  if (isProjectNameApproved(student)) return false;
  const status = student?.projectNameStatus || '';
  if (status === 'pending' || isLegacyUnapprovedProject(student)) return false;
  if (status === 'rejected') return true;
  return !student?.projectNameSubmission?.trim();
}

export function isProjectNameAwaitingReview(student) {
  if (!student || isProjectNameApproved(student)) return false;
  return student.projectNameStatus === 'pending' || isLegacyUnapprovedProject(student);
}

export function projectNameDisplay(student) {
  if (!student) return '';
  if (isProjectNameApproved(student)) return student.projectName?.trim() || '';
  return projectNameAwaitingReview(student) || student.projectNameSubmission?.trim() || '';
}

/** Nhãn hiển thị cho học sinh lớp kiểm tra (không làm sản phẩm). */
export const EXAM_CLASS_STATUS_LABEL = 'Đang học';

/**
 * @param {{ currentStatus?: string } | null | undefined} student
 * @param {{ finalMode?: string } | null | undefined} classDoc
 * @param {{ finalMode?: string } | null | undefined} [program]
 */
export function displayStudentStatus(student, classDoc, program) {
  const raw = student?.currentStatus || 'Chưa bắt đầu';
  if (!classUsesProjectNames(classDoc, program) && raw === 'Chưa bắt đầu') {
    return EXAM_CLASS_STATUS_LABEL;
  }
  return raw;
}

/**
 * @param {{ currentStatus?: string } | null | undefined} student
 * @param {{ finalMode?: string } | null | undefined} classDoc
 * @param {{ finalMode?: string } | null | undefined} [program]
 */
export function displayStudentStatusTone(student, classDoc, program) {
  const label = displayStudentStatus(student, classDoc, program);
  if (label === EXAM_CLASS_STATUS_LABEL) return 'blue';
  const tones = {
    'Chưa bắt đầu': 'slate',
    'Đang làm': 'blue',
    'Cần hỗ trợ': 'red',
    'Gần hoàn thành': 'amber',
    'Hoàn thành': 'green',
  };
  return tones[label] || 'slate';
}
