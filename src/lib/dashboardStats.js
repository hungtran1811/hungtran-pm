import { isArchivedClassStatus } from '../services/classes.service.js';

export function studentClassCode(student) {
  return student?.classCode || student?.classId || '';
}

/** Chỉ số tổng quan — tập trung lớp đang vận hành (status active). */
export function computeDashboardStats(classes = [], students = []) {
  const activeClasses = classes.filter((c) => c.status === 'active');
  const activeCodes = new Set(activeClasses.map((c) => c.classCode));

  const activeStudents = students.filter(
    (s) => s.active && activeCodes.has(studentClassCode(s)),
  );

  const archivedCodes = new Set(
    classes.filter((c) => isArchivedClassStatus(c.status)).map((c) => c.classCode),
  );

  const alumniStudents = students.filter(
    (s) => s.active && archivedCodes.has(studentClassCode(s)),
  ).length;

  const enrolledOnClassDocs = activeClasses.reduce(
    (sum, c) => sum + Number(c.studentCount || 0),
    0,
  );

  return {
    activeClasses: activeClasses.length,
    totalClasses: classes.length,
    archivedClasses: archivedCodes.size,
    activeStudents: activeStudents.length,
    enrolledOnClassDocs,
    nearlyDone: activeStudents.filter((s) => s.currentStatus === 'Gần hoàn thành').length,
    needsHelp: activeStudents.filter((s) => s.currentStatus === 'Cần hỗ trợ').length,
    completedInActive: activeStudents.filter((s) => s.currentStatus === 'Hoàn thành').length,
    alumniStudents,
  };
}
