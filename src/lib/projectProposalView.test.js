import { describe, expect, it } from 'vitest';
import {
  hasLegacyProjectProposalDetails,
  hasViewableProjectProposal,
  projectProposalName,
  projectProposalStatusPresentation,
} from './projectProposalView.js';

describe('projectProposalView', () => {
  it.each([
    ['pending', { projectNameStatus: 'pending', projectNameSubmission: 'Weather app' }],
    ['legacy', { projectName: 'Library app' }],
    ['approved', { projectNameStatus: 'approved', projectName: 'Habit tracker' }],
    ['rejected', { projectNameStatus: 'rejected', projectNameSubmission: 'Old idea' }],
  ])('allows viewing a named %s proposal', (_label, student) => {
    expect(hasViewableProjectProposal(student)).toBe(true);
  });

  it('does not expose an empty or unsupported record as a proposal', () => {
    expect(hasViewableProjectProposal({ projectNameStatus: 'pending' })).toBe(false);
    expect(hasViewableProjectProposal({ projectName: 'Không có' })).toBe(false);
    expect(hasViewableProjectProposal({ projectName: 'Idea', projectNameStatus: 'archived' })).toBe(
      false,
    );
  });

  it('prefers the approved name and otherwise prefers the submitted name', () => {
    expect(
      projectProposalName({
        projectNameStatus: 'approved',
        projectName: 'Approved name',
        projectNameSubmission: 'Stale submission',
      }),
    ).toBe('Approved name');
    expect(
      projectProposalName({
        projectNameStatus: 'rejected',
        projectName: 'Old approved name',
        projectNameSubmission: 'Rejected name',
      }),
    ).toBe('Rejected name');
  });

  it('marks records missing any required detail as legacy data', () => {
    const complete = {
      projectNameStatus: 'pending',
      projectNameSubmission: 'Complete idea',
      projectTopic: 'Education',
      projectProblemSolution: 'A problem and solution',
      projectPlannedFeatures: 'Feature one',
    };

    expect(hasLegacyProjectProposalDetails(complete)).toBe(false);
    expect(hasLegacyProjectProposalDetails({ ...complete, projectTopic: ' ' })).toBe(true);
    expect(hasLegacyProjectProposalDetails({ projectName: 'Old idea' })).toBe(true);
  });

  it('presents all supported review states', () => {
    expect(projectProposalStatusPresentation({ projectNameStatus: 'pending' })).toEqual({
      label: 'Chờ duyệt',
      tone: 'amber',
    });
    expect(projectProposalStatusPresentation({ projectNameStatus: 'approved' }).label).toBe(
      'Đã duyệt',
    );
    expect(projectProposalStatusPresentation({ projectNameStatus: 'rejected' }).label).toBe(
      'Đã từ chối',
    );
    expect(projectProposalStatusPresentation({}).label).toBe('Dữ liệu cũ · Chờ duyệt');
  });
});
