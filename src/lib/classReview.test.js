import { describe, expect, it } from 'vitest';
import { buildClassReviewItem } from './classReview.js';

const student = {
  id: 's1',
  fullName: 'An',
  lastReportedAt: new Date('2026-09-01T00:00:00'),
  currentStage: 'Phân tích vấn đề',
  currentStatus: 'Đang làm',
  currentProgressPercent: 70,
};

const lessonNine = {
  id: 'r9',
  studentId: 's1',
  lessonKey: 'L09',
  doneToday: 'Buổi 9',
  nextGoal: 'Mục tiêu 9',
  difficulties: 'Khó 9',
  stage: 'Xây dựng sản phẩm',
  status: 'Đang làm',
  progressPercent: 40,
  submittedAt: new Date('2026-09-09T10:00:00'),
  snapshotOnly: false,
};

const snapshot = {
  id: 'snapshot-s1',
  studentId: 's1',
  lessonKey: '',
  doneToday: '—',
  stage: 'Phân tích vấn đề',
  status: 'Đang làm',
  snapshotOnly: true,
  submittedAt: new Date('2026-09-01T00:00:00'),
};

function lessonsFrom(reports) {
  const map = new Map();
  for (const report of reports) map.set(report.lessonKey, report);
  return map;
}

describe('buildClassReviewItem', () => {
  it('does not use an older lesson or a snapshot when the selected lesson has no report', () => {
    const item = buildClassReviewItem({
      student,
      lessonKey: 'L10',
      lessons: lessonsFrom([lessonNine]),
      classReports: [lessonNine],
      latestReport: snapshot,
      requiresBoth: true,
      allDrive: {
        files: [{ id: 'f1', lessonKey: 'L10', originalFileName: 'an.zip', isLatest: true }],
      },
    });

    expect(item.report).toBeNull();
    expect(item.hasReport).toBe(false);
    expect(item.hasFile).toBe(true);
    expect(item.isComplete).toBe(false);
    expect(item.reportHistory).toEqual([lessonNine]);
  });

  it('uses only the real report for the selected lesson', () => {
    const item = buildClassReviewItem({
      student,
      lessonKey: 'L09',
      lessons: lessonsFrom([lessonNine]),
      classReports: [lessonNine],
      latestReport: snapshot,
      requiresBoth: true,
    });

    expect(item.report).toBe(lessonNine);
    expect(item.hasReport).toBe(true);
    expect(item.isComplete).toBe(false);
  });

  it('keeps a knowledge class on the file signal and ignores the snapshot', () => {
    const item = buildClassReviewItem({
      student,
      lessonKey: 'L02',
      lessons: lessonsFrom([lessonNine]),
      latestReport: snapshot,
      requiresBoth: false,
      allDrive: null,
    });

    expect(item.report).toBeNull();
    expect(item.hasReport).toBe(false);
    expect(item.isComplete).toBe(false);
  });

  it('does not show a snapshot as the all-class report', () => {
    const item = buildClassReviewItem({
      student,
      isAllClasses: true,
      latestReport: snapshot,
    });

    expect(item.report).toBeNull();
    expect(item.hasReport).toBe(false);
  });
});
