function avgPercent(items, key) {
  if (!items.length) return null;
  return Math.round(items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0) / items.length);
}

/** Latest exam attempt per student × lesson (by attemptNumber). */
export function latestExamByStudentLesson(submissions) {
  const map = new Map();
  for (const s of submissions) {
    const key = `${s.studentId}__${s.lessonId}`;
    const existing = map.get(key);
    if (!existing || Number(s.attemptNumber ?? 0) > Number(existing.attemptNumber ?? 0)) {
      map.set(key, s);
    }
  }
  return [...map.values()];
}

export function buildSessionScoreChart(examSubs, practiceSubs) {
  const sessions = new Set();
  practiceSubs.forEach((s) => sessions.add(s.sessionNumber));
  examSubs.forEach((s) => sessions.add(s.sessionNumber));
  const latestExams = latestExamByStudentLesson(examSubs);

  return [...sessions]
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
    .map((session) => {
      const practice = practiceSubs.filter((p) => p.sessionNumber === session);
      const exams = latestExams.filter((e) => e.sessionNumber === session);
      return {
        session: `Buổi ${session}`,
        sessionNumber: session,
        practiceAvg: avgPercent(practice, 'mcqPercent'),
        practiceCount: practice.length,
        examAvg: avgPercent(exams, 'gradedPercent'),
        examCount: exams.length,
      };
    });
}

function combinedStudentAvg(practiceAvg, examAvg) {
  const parts = [practiceAvg, examAvg].filter((v) => v !== null && v !== undefined);
  if (!parts.length) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

export function buildStudentScoreRows(students, examSubs, practiceSubs) {
  const latestExams = latestExamByStudentLesson(examSubs);

  return students
    .map((student) => {
      const practices = practiceSubs.filter((p) => p.studentId === student.id);
      const exams = latestExams.filter((e) => e.studentId === student.id);
      const practiceAvg = avgPercent(practices, 'mcqPercent');
      const examAvg = avgPercent(exams, 'gradedPercent');
      return {
        studentId: student.id,
        studentName: student.fullName,
        practiceCount: practices.length,
        examCount: exams.length,
        practiceAvg,
        examAvg,
        combinedAvg: combinedStudentAvg(practiceAvg, examAvg),
      };
    })
    .sort((a, b) => a.studentName.localeCompare(b.studentName, 'vi'));
}

export function buildClassScoreSummary(studentRows) {
  const withPractice = studentRows.filter((r) => r.practiceAvg !== null);
  const withExam = studentRows.filter((r) => r.examAvg !== null);
  const withBoth = studentRows.filter((r) => r.combinedAvg !== null);
  return {
    studentCount: studentRows.length,
    practiceAvg: avgPercent(withPractice, 'practiceAvg'),
    examAvg: avgPercent(withExam, 'examAvg'),
    combinedAvg: avgPercent(withBoth, 'combinedAvg'),
    practiceParticipants: withPractice.length,
    examParticipants: withExam.length,
  };
}
