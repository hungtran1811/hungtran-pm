import { describe, expect, it } from 'vitest';
import {
  buildClassOpsRows,
  buildOpsAttentionItems,
  classPhaseLabel,
  classReportsHref,
  classSessionLabel,
  classStudentsHref,
  collectSettledSubmissions,
  computeDashboardStats,
  computeOpsKpis,
  formatFileRatio,
  formatOpsRatio,
  opsRowBadge,
  studentClassCode,
} from './dashboardStats.js';

describe('studentClassCode', () => {
  it('prefers classCode then classId', () => {
    expect(studentClassCode({ classCode: 'A', classId: 'B' })).toBe('A');
    expect(studentClassCode({ classId: 'B' })).toBe('B');
  });
});

describe('computeDashboardStats', () => {
  const classes = [
    { classCode: 'ACTIVE', status: 'active', studentCount: 3 },
    { classCode: 'DONE', status: 'completed', studentCount: 2 },
  ];

  const students = [
    { id: '1', active: true, classCode: 'ACTIVE', currentStatus: 'Đang làm' },
    { id: '2', active: true, classId: 'ACTIVE', currentStatus: 'Cần hỗ trợ' },
    { id: '3', active: true, classCode: 'DONE', currentStatus: 'Hoàn thành' },
    { id: '4', active: false, classCode: 'ACTIVE', currentStatus: 'Đang làm' },
  ];

  it('counts only active students in active classes', () => {
    const stats = computeDashboardStats(classes, students);
    expect(stats.activeClasses).toBe(1);
    expect(stats.activeStudents).toBe(2);
    expect(stats.needsHelp).toBe(1);
    expect(stats.completedCourse).toBe(1);
    expect(stats.alumniStudents).toBe(1);
  });
});

describe('labels', () => {
  it('builds reports href and session/phase labels', () => {
    expect(classReportsHref('K24')).toBe('/admin/reports?tab=progress&class=K24');
    expect(classReportsHref('K24', { filter: 'missing' })).toBe(
      '/admin/reports?tab=progress&class=K24&filter=missing',
    );
    expect(classStudentsHref('K24')).toBe('/admin/students?class=K24');
    expect(classStudentsHref('K24', { review: true })).toBe('/admin/students?class=K24&review=1');
    expect(classSessionLabel(3)).toBe('B03');
    expect(classSessionLabel(0)).toBe('—');
    expect(classPhaseLabel('learning')).toBe('Học kiến thức');
    expect(classPhaseLabel('final')).toBe('Làm sản phẩm cuối khóa');
  });
});

describe('opsRowBadge', () => {
  it('prioritizes support then pending name then missing report then missing file', () => {
    expect(
      opsRowBadge({
        needSupport: 2,
        pendingNames: 3,
        reportMissing: 4,
        fileMissing: 3,
        reportsApplicable: true,
        filesApplicable: true,
      }).id,
    ).toBe('support');
    expect(
      opsRowBadge({
        pendingNames: 2,
        reportMissing: 4,
        fileMissing: 3,
        reportsApplicable: true,
        filesApplicable: true,
      }),
    ).toEqual({ id: 'pending_name', label: 'Chờ duyệt tên', tone: 'amber', count: 2 });
    expect(
      opsRowBadge({
        reportMissing: 1,
        fileMissing: 3,
        reportsApplicable: true,
        filesApplicable: true,
      }),
    ).toEqual({ id: 'missing_report', label: 'Thiếu báo cáo', tone: 'amber', count: 1 });
    expect(
      opsRowBadge({
        fileMissing: 2,
        filesApplicable: true,
      }),
    ).toEqual({ id: 'missing_file', label: 'Thiếu file', tone: 'amber', count: 2 });
    expect(opsRowBadge({}).id).toBe('ok');
  });
});

describe('formatOpsRatio / collectSettledSubmissions', () => {
  it('shows em dash when not applicable or unavailable', () => {
    expect(formatOpsRatio({ applicable: false, submitted: 1, total: 2 })).toBe('—');
    expect(formatOpsRatio({ applicable: true, unavailable: true, submitted: 1, total: 2 })).toBe('—');
    expect(formatOpsRatio({ applicable: true, submitted: 1, total: 3 })).toBe('1/3');
  });

  it('keeps fulfilled classes and omits failed keys', () => {
    expect(
      collectSettledSubmissions(['A', 'B'], [
        { status: 'fulfilled', value: [{ id: '1' }] },
        { status: 'rejected', reason: new Error('fail') },
      ]),
    ).toEqual({
      submissionsByClass: { A: [{ id: '1' }] },
      failedClassCodes: ['B'],
    });
  });
});

describe('buildClassOpsRows', () => {
  const learning = {
    classCode: 'LEARN',
    className: 'Học',
    status: 'active',
    curriculumPhase: 'learning',
    curriculumCurrentSession: 3,
    driveFolderId: 'folder-learn',
  };
  const product = {
    classCode: 'FINAL',
    className: 'Sản phẩm',
    status: 'active',
    curriculumPhase: 'final',
    curriculumCurrentSession: 4,
    driveFolderId: 'folder-final',
  };
  const archived = {
    classCode: 'OLD',
    status: 'completed',
    curriculumPhase: 'final',
    curriculumCurrentSession: 8,
  };

  const students = [
    {
      id: 'a1',
      active: true,
      classCode: 'LEARN',
      currentStatus: 'Cần hỗ trợ',
    },
    {
      id: 'a2',
      active: true,
      classCode: 'LEARN',
      currentStatus: 'Đang học',
    },
    {
      id: 'b1',
      active: true,
      classCode: 'FINAL',
      currentStatus: 'Đang làm',
    },
    {
      id: 'b2',
      active: true,
      classCode: 'FINAL',
      currentStatus: 'Đang làm',
      lastReportedAt: new Date('2026-09-01'),
    },
    {
      id: 'b3',
      active: false,
      classCode: 'FINAL',
      currentStatus: 'Đang làm',
    },
    {
      id: 'old',
      active: true,
      classCode: 'OLD',
      currentStatus: 'Hoàn thành',
    },
  ];

  const submissionsByClass = {
    LEARN: [
      { studentId: 'a1', lessonKey: 'L03' },
      { studentId: 'a2', lessonKey: 'B02' },
    ],
    FINAL: [
      { studentId: 'b1', lessonKey: 'B04' },
      { studentId: 'b2', lessonKey: 'L03' },
    ],
  };

  it('shows dash reports for learning classes and missing lastReportedAt for final', () => {
    const rows = buildClassOpsRows([learning, product, archived], students, submissionsByClass, {
      driveEnabled: true,
    });
    expect(rows.map((row) => row.classCode)).toEqual(['FINAL', 'LEARN']);

    const learn = rows.find((row) => row.classCode === 'LEARN');
    expect(learn.reportsApplicable).toBe(false);
    expect(learn.reportSubmitted).toBeNull();
    expect(learn.needSupport).toBe(1);
    expect(learn.badge.id).toBe('support');
    expect(learn.fileSubmitted).toBe(1);
    expect(learn.fileTotal).toBe(2);
    expect(learn.fileMissing).toBe(1);

    const finalRow = rows.find((row) => row.classCode === 'FINAL');
    expect(finalRow.reportsApplicable).toBe(true);
    expect(finalRow.reportSubmitted).toBe(1);
    expect(finalRow.reportTotal).toBe(2);
    expect(finalRow.reportMissing).toBe(1);
    expect(finalRow.badge.id).toBe('missing_report');
    expect(finalRow.fileSubmitted).toBe(1);
    expect(finalRow.fileMissing).toBe(1);
  });

  it('counts only the current session file and ignores other lesson keys', () => {
    const [row] = buildClassOpsRows(
      [{ ...learning, classCode: 'LEARN', curriculumCurrentSession: 3 }],
      students.filter((student) => student.classCode === 'LEARN'),
      {
        LEARN: [
          { studentId: 'a1', lessonKey: 'L02' },
          { studentId: 'a2', lessonKey: 'B03' },
        ],
      },
      { driveEnabled: true },
    );
    expect(row.fileSubmitted).toBe(1);
    expect(row.fileMissing).toBe(1);
  });

  it('hides file counts when Drive is off', () => {
    const [row] = buildClassOpsRows([product], students, submissionsByClass, { driveEnabled: false });
    expect(row.filesApplicable).toBe(false);
    expect(row.fileSubmitted).toBeNull();
    expect(row.fileMissing).toBe(0);
    expect(formatFileRatio(row)).toBe('—');
  });

  it('marks file column unavailable when the class key is omitted', () => {
    const [row] = buildClassOpsRows([learning], students, {}, { driveEnabled: true });
    expect(row.filesApplicable).toBe(true);
    expect(row.filesUnavailable).toBe(true);
    expect(row.fileSubmitted).toBeNull();
    expect(row.badge.id).toBe('support');
  });

  it('does not require reports for exam-mode final classes', () => {
    const [row] = buildClassOpsRows(
      [{ ...product, finalMode: 'exam' }],
      students,
      { FINAL: [] },
      { driveEnabled: true },
    );
    expect(row.reportsApplicable).toBe(false);
    expect(row.reportSubmitted).toBeNull();
  });

  it('counts pending and legacy unapproved project names', () => {
    const [row] = buildClassOpsRows(
      [product],
      [
        {
          id: 'b1',
          active: true,
          classCode: 'FINAL',
          currentStatus: 'Đang làm',
          projectNameStatus: 'pending',
          projectNameSubmission: 'Weather',
        },
        {
          id: 'b2',
          active: true,
          classCode: 'FINAL',
          currentStatus: 'Đang làm',
          lastReportedAt: new Date('2026-09-01'),
          projectName: 'Legacy app',
        },
      ],
      { FINAL: [] },
      { driveEnabled: true },
    );
    expect(row.pendingNames).toBe(2);
    expect(row.badge.id).toBe('pending_name');
    expect(row.studentsHref).toBe('/admin/students?class=FINAL');
  });

  it('does not count pending names for exam-mode classes', () => {
    const [row] = buildClassOpsRows(
      [{ ...product, finalMode: 'exam' }],
      [
        {
          id: 'b1',
          active: true,
          classCode: 'FINAL',
          currentStatus: 'Đang làm',
          projectNameStatus: 'pending',
          projectNameSubmission: 'Weather',
        },
      ],
      { FINAL: [] },
      { driveEnabled: true },
    );
    expect(row.pendingNames).toBe(0);
    expect(row.badge.id).not.toBe('pending_name');
  });
});

describe('buildOpsAttentionItems / computeOpsKpis', () => {
  it('lists exceptions by rank and sums KPIs', () => {
    const rows = buildClassOpsRows(
      [
        {
          classCode: 'A',
          status: 'active',
          curriculumPhase: 'learning',
          curriculumCurrentSession: 1,
        },
        {
          classCode: 'B',
          status: 'active',
          curriculumPhase: 'final',
          curriculumCurrentSession: 2,
        },
      ],
      [
        { id: '1', active: true, classCode: 'A', currentStatus: 'Cần hỗ trợ' },
        { id: '2', active: true, classCode: 'B', currentStatus: 'Đang làm' },
      ],
      { A: [], B: [] },
      { driveEnabled: true },
    );
    const items = buildOpsAttentionItems(rows);
    expect(items.map((item) => `${item.classCode}:${item.id}`)).toEqual([
      'A:support',
      'B:missing_report',
      'A:missing_file',
      'B:missing_file',
    ]);
    expect(items[0].href).toBe('/admin/students?class=A');
    expect(items[1].href).toBe('/admin/reports?tab=progress&class=B&filter=missing');
    expect(computeOpsKpis(rows)).toEqual({
      openClasses: 2,
      needSupport: 1,
      missingReports: 1,
      missingFiles: 2,
    });
  });

  it('emits pending_name beside support for the same class', () => {
    const rows = buildClassOpsRows(
      [
        {
          classCode: 'A',
          status: 'active',
          curriculumPhase: 'final',
          curriculumCurrentSession: 1,
        },
      ],
      [
        {
          id: '1',
          active: true,
          classCode: 'A',
          currentStatus: 'Cần hỗ trợ',
          projectNameStatus: 'pending',
          projectNameSubmission: 'Todo',
        },
        { id: '2', active: true, classCode: 'A', currentStatus: 'Đang làm' },
      ],
      { A: [] },
      { driveEnabled: true },
    );
    const items = buildOpsAttentionItems(rows);
    expect(items.map((item) => item.id)).toEqual([
      'support',
      'pending_name',
      'missing_report',
      'missing_file',
    ]);
    expect(items.find((item) => item.id === 'pending_name')).toMatchObject({
      classCode: 'A',
      count: 1,
      href: '/admin/students?class=A&review=1',
      detail: '1 học sinh chờ duyệt tên dự án',
    });
  });
});
