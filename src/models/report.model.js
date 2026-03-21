import { toDate } from '../utils/date.js';

export function toReportModel(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    classId: data.classId ?? '',
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    projectName: data.projectName ?? '',
    progressPercent: Number(data.progressPercent ?? 0),
    stage: data.stage ?? 'Ý tưởng',
    status: data.status ?? 'Chưa bắt đầu',
    doneToday: data.doneToday ?? '',
    nextGoal: data.nextGoal ?? '',
    difficulties: data.difficulties ?? '',
    submittedAt: toDate(data.submittedAt),
    submittedDateKey: data.submittedDateKey ?? '',
    source: data.source ?? 'student-form',
    createdAt: toDate(data.createdAt),
  };
}
