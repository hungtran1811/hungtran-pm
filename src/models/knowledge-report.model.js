import { toDate } from '../utils/date.js';

export function toKnowledgeReportModel(snapshot) {
  const data = snapshot.data();

  return {
    id: snapshot.id,
    classCode: data.classCode ?? '',
    studentId: data.studentId ?? '',
    studentName: data.studentName ?? '',
    curriculumProgramId: data.curriculumProgramId ?? '',
    sessionNumber: Number(data.sessionNumber ?? 0),
    lessonId: data.lessonId ?? '',
    understoodTopics: data.understoodTopics ?? '',
    unclearTopics: data.unclearTopics ?? '',
    understandingLevel: Number(data.understandingLevel ?? 0),
    supportRequest: data.supportRequest ?? '',
    submittedAt: toDate(data.submittedAt),
    createdAt: toDate(data.createdAt),
  };
}
