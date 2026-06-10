import { formatDateTime } from '../lib/firestore.js';
import { UNDERSTANDING_LEVELS } from '../constants/index.js';

const UNDERSTANDING_LABELS = UNDERSTANDING_LEVELS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

export function formatProgressReport(report) {
  return [
    `Học sinh: ${report.studentName}`,
    `Dự án: ${report.projectName || '—'}`,
    `Tiến độ: ${report.progressPercent}% - ${report.stage} - ${report.status}`,
    `Đã làm: ${report.doneToday}`,
    `Mục tiêu tiếp theo: ${report.nextGoal}`,
    report.difficulties ? `Khó khăn: ${report.difficulties}` : '',
    report.submittedAt ? `Thời gian: ${formatDateTime(report.submittedAt)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatKnowledgeFeedback(feedback) {
  const level =
    UNDERSTANDING_LABELS[feedback.understandingLevel] || `${feedback.understandingLevel}/5`;
  return [
    `Học sinh: ${feedback.studentName}`,
    `Buổi: ${feedback.sessionNumber}`,
    `Mức hiểu: ${level}`,
    `Đã hiểu: ${feedback.understoodTopics}`,
    `Chưa rõ: ${feedback.unclearTopics}`,
    feedback.supportRequest ? `Cần hỗ trợ: ${feedback.supportRequest}` : '',
    feedback.submittedAt ? `Thời gian: ${formatDateTime(feedback.submittedAt)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildClassExport(header, items, formatter, separator = '\n---\n') {
  return [header, '', ...items.map((item) => `${formatter(item)}${separator}`)].join('\n').trim();
}
