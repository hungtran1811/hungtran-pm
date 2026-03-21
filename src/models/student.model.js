import { toDate } from '../utils/date.js';

export function toStudentModel(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    fullName: data.fullName ?? '',
    fullNameKey: data.fullNameKey ?? '',
    classId: data.classId ?? '',
    classCode: data.classCode ?? '',
    projectName: data.projectName ?? '',
    active: Boolean(data.active ?? true),
    currentProgressPercent: Number(data.currentProgressPercent ?? 0),
    currentStage: data.currentStage ?? 'Ý tưởng',
    currentStatus: data.currentStatus ?? 'Chưa bắt đầu',
    currentDifficulties: data.currentDifficulties ?? '',
    lastReportedAt: toDate(data.lastReportedAt),
    latestReportId: data.latestReportId ?? '',
    progressStalledCount: Number(data.progressStalledCount ?? 0),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function getStudentDefaults() {
  return {
    fullName: '',
    classId: '',
    projectName: '',
    active: true,
  };
}
