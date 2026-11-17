// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClassCompletionRoster } from './ClassCompletionRoster.jsx';

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function item({ id, name, hasReport, hasFile, report, drive, reportHistory, student = {} }) {
  return {
    student: {
      id,
      fullName: name,
      classCode: 'PXL',
      projectName: name === 'An' ? 'món ăn việt nam' : '',
      projectNameStatus: name === 'An' ? 'approved' : '',
      projectTopic: name === 'An' ? 'Tìm quán ăn' : '',
      currentStage: 'Giai đoạn buổi khác',
      currentStatus: 'Trạng thái buổi khác',
      ...student,
    },
    hasReport,
    hasFile,
    isComplete: Boolean(hasReport && hasFile),
    report,
    drive,
    reportHistory,
  };
}

const completeItem = item({
  id: 'a',
  name: 'An',
  hasReport: true,
  hasFile: true,
  report: {
    id: 'r2',
    progressPercent: 40,
    status: 'Đang làm',
    stage: 'Làm sản phẩm',
    projectName: 'món ăn việt nam',
    doneToday: 'Xong trang chủ',
    nextGoal: 'Thêm trang chi tiết quán',
    difficulties: 'Chưa có dữ liệu quán',
    projectGithubUrl: 'https://github.com/an/food',
    projectCanvaUrl: 'https://www.canva.com/design/an',
    lessonKey: 'B09',
    submittedAt: new Date('2026-09-12T10:00:00'),
  },
  reportHistory: [
    {
      id: 'r2',
      doneToday: 'Xong trang chủ',
      lessonKey: 'B09',
      submittedAt: new Date('2026-09-12T10:00:00'),
    },
    {
      id: 'r1',
      doneToday: 'Làm wireframe',
      lessonKey: 'B08',
      submittedAt: new Date('2026-09-12T08:00:00'),
    },
  ],
  drive: {
    latest: {
      id: 'f2',
      originalFileName: 'an-v2.zip',
      isLatest: true,
      submittedAt: new Date('2026-09-12T10:05:00'),
    },
    files: [
      { id: 'f2', originalFileName: 'an-v2.zip', isLatest: true },
      { id: 'f1', originalFileName: 'an.zip', isLatest: false },
    ],
  },
});

describe('ClassCompletionRoster', () => {
  it('shows file and report status on the card, and the report inside the popup', async () => {
    await act(async () => {
      root.render(
        createElement(ClassCompletionRoster, {
          showDrive: true,
          showReport: true,
          lessonKey: 'B09',
          canDelete: true,
          onDeleteFile: () => {},
          onDeleteReport: () => {},
          onDeleteLesson: () => {},
          items: [completeItem],
        }),
      );
    });

    const card = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('An'),
    );
    expect(card.textContent).toContain('Báo cáo');
    expect(card.textContent).toContain('File');
    expect(card.textContent).toContain('Đủ');
    expect(card.textContent).not.toContain('Xong trang chủ');
    expect(card.textContent).not.toContain('Xóa');

    await act(async () => {
      card.click();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Xong trang chủ');
    expect(dialog.textContent).toContain('Thêm trang chi tiết quán');
    expect(dialog.textContent).toContain('an-v2.zip');
    expect(dialog.textContent).toContain('Copy báo cáo');
    const records = dialog.querySelector('details');
    expect(records.open).toBe(false);
    expect(records.textContent).toContain('Xóa file');
    expect(records.textContent).toContain('Xóa buổi');
  });

  it('keeps a missing report off the card until the popup opens', async () => {
    await act(async () => {
      root.render(
        createElement(ClassCompletionRoster, {
          showDrive: true,
          showReport: true,
          items: [
            item({
              id: 'b',
              name: 'Bình',
              hasReport: false,
              hasFile: false,
            }),
          ],
        }),
      );
    });

    const card = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Bình'),
    );
    expect(card.textContent).toContain('Chưa có');
    expect(card.textContent).not.toContain('Chưa nộp báo cáo buổi này');
    expect(card.textContent).not.toContain('Giai đoạn buổi khác');
    expect(card.textContent).not.toContain('Đủ');

    await act(async () => {
      card.click();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Chưa nộp báo cáo buổi này');
    expect(dialog.textContent).not.toContain('Giai đoạn buổi khác');
    expect(dialog.textContent).not.toContain('Trạng thái buổi khác');
  });

  it('shows a file in the popup without marking the card complete', async () => {
    await act(async () => {
      root.render(
        createElement(ClassCompletionRoster, {
          showDrive: true,
          showReport: true,
          items: [
            item({
              id: 'c',
              name: 'Chi',
              hasReport: false,
              hasFile: true,
              drive: {
                latest: { id: 'f3', originalFileName: 'chi.zip' },
                files: [{ id: 'f3', originalFileName: 'chi.zip' }],
              },
            }),
          ],
        }),
      );
    });

    const card = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Chi'),
    );
    expect(card.textContent).toContain('File');
    expect(card.textContent).not.toContain('Đủ');
    expect(card.textContent).not.toContain('chi.zip');

    await act(async () => {
      card.click();
    });

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('chi.zip');
    expect(dialog.textContent).toContain('Có file, chưa có báo cáo');
    expect(dialog.textContent).not.toContain('Đủ');
  });
});
