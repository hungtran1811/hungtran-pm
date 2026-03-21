export function isStudentCompleted(student) {
  return Number(student?.currentProgressPercent ?? 0) === 100 || student?.currentStatus === 'Hoàn thành';
}

export function getClassCompletionStats(classCode, students = []) {
  const activeStudents = students.filter((student) => student.active && student.classId === classCode);
  const completedStudents = activeStudents.filter(isStudentCompleted);

  return {
    activeStudentCount: activeStudents.length,
    completedStudentCount: completedStudents.length,
    completionReady: activeStudents.length > 0 && completedStudents.length === activeStudents.length,
  };
}
