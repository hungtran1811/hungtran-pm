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

function item({ id, name, hasReport, hasFile, report, drive, reportCount, reportHistory, driveHistory }) {
  return {
    student: {
      id,
      fullName: name,
      classCode: 'PXL',
      projectName: name === 'An' ? 'món ăn việt nam' : '',
      projectNameStatus: name === 'An' ? 'approved' : '',
      projectTopic: name === 'An' ? 'Tìm quán ăn' : '',
      projectGithubUrl: name === 'An' ? 'https://github.com/an/food' : '',
      projectCanvaUrl: name === 'An' ? 'https://www.canva.com/design/an' : '',
    },
    hasReport,
    hasFile,
    isComplete: hasReport && hasFile,
    report,
    drive,
    reportCount,
    reportHistory,
    driveHistory,
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
    submittedAt: new Date('2026-09-12T10:00:00'),
  },
  reportCount: 2,
  reportHistory: [
    {
      id: 'r2',
      progressPercent: 40,
      status: 'Đang làm',
      stage: 'Làm sản phẩm',
      projectName: 'món ăn việt nam',
      doneToday: 'Xong trang chủ',
      nextGoal: 'Thêm trang chi tiết quán',
      difficulties: 'Chưa có dữ liệu quán',
      projectGithubUrl: 'https://github.com/an/food',
      lessonKey: 'B09',
      submittedAt: new Date('2026-09-12T10:00:00'),
    },
    {
      id: 'r1',
      progressPercent: 20,
      status: 'Đang làm',
      stage: 'Phân tích vấn đề',
      doneToday: 'Làm wireframe',
      nextGoal: 'Chốt bố cục',
      difficulties: '',
      lessonKey: 'B09',
      submittedAt: new Date('2026-09-12T08:00:00'),
    },
  ],
  driveHistory: {
    files: [
      {
        id: 'f2',
        originalFileName: 'an-v2.zip',
        attempt: 2,
        isLatest: true,
        lessonKey: 'B09',
        submittedAt: new Date('2026-09-12T10:05:00'),
        driveFileId: 'file-2',
      },
      {
        id: 'f1',
        originalFileName: 'an.zip',
        attempt: 1,
        isLatest: false,
        lessonKey: 'B09',
        submittedAt: new Date('2026-09-12T09:00:00'),
        driveFileId: 'file-1',
      },
    ],
  },
  drive: {
    latest: {
      id: 'f2',
      originalFileName: 'an-v2.zip',
      attempt: 2,
      isLatest: true,
      submittedAt: new Date('2026-09-12T10:05:00'),
      driveFileId: 'file-2',
    },
    files: [
      {
        id: 'f2',
        originalFileName: 'an-v2.zip',
        attempt: 2,
        isLatest: true,
        submittedAt: new Date('2026-09-12T10:05:00'),
        driveFileId: 'file-2',
      },
      {
        id: 'f1',
        originalFileName: 'an.zip',
        attempt: 1,
        isLatest: false,
        submittedAt: new Date('2026-09-12T09:00:00'),
        driveFileId: 'file-1',
      },
    ],
  },
});

describe('ClassCompletionRoster', () => {
  it('renders compact signal cards and opens details in a modal', async () => {
    await act(async () => {
      root.render(
        createElement(ClassCompletionRoster, {
          showDrive: true,
          showReport: true,
          lessonKey: 'B09',
          items: [
            completeItem,
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

    expect(container.textContent).toContain('An');
    expect(container.textContent).toContain('món ăn việt nam');
    expect(container.textContent).toContain('Tìm quán ăn');
    expect(container.textContent).toContain('Bình');
    expect(container.textContent).toContain('Đủ');
    expect(container.textContent).toContain('Chưa có');
    expect(container.textContent).toContain('GitHub');
    expect(container.textContent).toContain('Canva');
    expect(container.textContent).toContain('Copy');
    expect(container.textContent).not.toContain('Xong trang chủ');
    expect(container.textContent).not.toContain('Thêm trang chi tiết quán');

    const card = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('An'),
    );
    await act(async () => {
      card.click();
    });

    expect(container.textContent).toContain('Xong trang chủ');
    expect(container.textContent).toContain('Đang làm');
    expect(container.textContent).toContain('Đã làm được');
    expect(container.textContent).toContain('Mục tiêu tiếp');
    expect(container.textContent).toContain('Thêm trang chi tiết quán');
    expect(container.textContent).toContain('Khó khăn');
    expect(container.textContent).toContain('Chưa có dữ liệu quán');
    expect(container.textContent).toContain('Tên dự án');
    expect(container.textContent).toContain('Copy báo cáo');
    expect(container.textContent).toContain('an-v2.zip');
    expect(container.textContent).toContain('Mới nhất · 2 bản');
    expect(container.textContent).toContain('Lần 2');
    expect(container.textContent).toContain('Lịch sử');
    expect(container.textContent).toContain('2 báo cáo · 2 file');
    expect(container.textContent).not.toContain('an.zip');
    expect(container.textContent).not.toContain('Làm wireframe');

    const historyToggle = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Lịch sử'),
    );
    await act(async () => {
      historyToggle.click();
    });

    expect(container.textContent).toContain('an.zip');
    expect(container.textContent).toContain('Lần 1');
    expect(container.textContent).toContain('Làm wireframe');
    expect(container.textContent).toContain('Mở');
  });
});
