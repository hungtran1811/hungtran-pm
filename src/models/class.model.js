import { toDate } from '../utils/date.js';

export function toClassModel(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    classCode: data.classCode ?? snapshot.id,
    className: data.className ?? '',
    status: data.status ?? 'active',
    hidden: Boolean(data.hidden),
    startDate: data.startDate ?? '',
    endDate: data.endDate ?? '',
    studentCount: Number(data.studentCount ?? 0),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export function getClassDefaults() {
  return {
    classCode: '',
    className: '',
    status: 'active',
    hidden: false,
    startDate: '',
    endDate: '',
  };
}
