import { meaningfulProjectName } from './classFinalMode.js';

const SUPPORTED_PROJECT_PROPOSAL_STATUSES = new Set(['', 'pending', 'approved', 'rejected']);

const PROJECT_DETAIL_FIELDS = ['projectTopic', 'projectProblemSolution', 'projectPlannedFeatures'];

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function projectProposalName(student) {
  if (!student) return '';
  if (student.projectNameStatus === 'approved') {
    return (
      meaningfulProjectName(student.projectName) ||
      meaningfulProjectName(student.projectNameSubmission)
    );
  }
  return (
    meaningfulProjectName(student.projectNameSubmission) ||
    meaningfulProjectName(student.projectName)
  );
}

export function hasViewableProjectProposal(student) {
  if (!projectProposalName(student)) return false;
  return SUPPORTED_PROJECT_PROPOSAL_STATUSES.has(cleanText(student?.projectNameStatus));
}

export function hasLegacyProjectProposalDetails(student) {
  if (!hasViewableProjectProposal(student)) return false;
  return PROJECT_DETAIL_FIELDS.some((field) => !cleanText(student?.[field]));
}

export function projectProposalStatusPresentation(student) {
  switch (cleanText(student?.projectNameStatus)) {
    case 'pending':
      return { label: 'Chờ duyệt', tone: 'amber' };
    case 'approved':
      return { label: 'Đã duyệt', tone: 'green' };
    case 'rejected':
      return { label: 'Đã từ chối', tone: 'red' };
    default:
      return { label: 'Dữ liệu cũ · Chờ duyệt', tone: 'amber' };
  }
}
