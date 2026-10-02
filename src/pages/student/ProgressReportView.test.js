// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../ui/components/Toast.jsx';

const submitProgressReport = vi.fn(async () => 'report-1');

vi.mock('../../services/reports.service.js', () => ({
  listReportsByStudent: vi.fn(async () => []),
  submitProgressReport: (...args) => submitProgressReport(...args),
}));

vi.mock('./ProgressReportHistory.jsx', () => ({
  ProgressReportHistory: () => createElement('div', null, 'Lịch sử'),
}));

vi.mock('./ProjectExtrasPanel.jsx', () => ({
  ProjectExtrasPanel: () => null,
}));

import { ProgressReportView } from './ProgressReportView.jsx';

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  submitProgressReport.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

const classDoc = { classCode: 'PXL', curriculumCurrentSession: 13, finalMode: 'project' };
const program = {
  lessons: [{ sessionNumber: 13, title: 'Demo' }],
};
const student = {
  id: 's1',
  fullName: 'An',
  projectName: 'Nộp bài lớp',
  projectNameStatus: 'approved',
  currentStage: 'Xây dựng sản phẩm',
  currentStatus: 'Đang làm',
  currentProgressPercent: 40,
};

async function renderForm(extraStudent = {}) {
  await act(async () => {
    root.render(
      createElement(
        ToastProvider,
        null,
        createElement(ProgressReportView, {
          classDoc,
          program,
          student: { ...student, ...extraStudent },
        }),
      ),
    );
  });
}

function listboxButton(label) {
  return [...container.querySelectorAll('button[aria-haspopup="listbox"]')].find(
    (el) => el.getAttribute('aria-label') === label,
  );
}

describe('ProgressReportView original pickers', () => {
  it('shows stage, status, range, and simple placeholders', async () => {
    await renderForm();
    const stageTrigger = listboxButton('Giai đoạn');
    const statusTrigger = listboxButton('Trạng thái');
    expect(stageTrigger?.textContent).toContain('Xây dựng sản phẩm');
    expect(statusTrigger?.textContent).toContain('Đang làm');
    expect(stageTrigger.className).toContain('bg-blue-100');
    expect(statusTrigger.className).toContain('bg-blue-100');
    const range = container.querySelector('input[type="range"][aria-label="Tiến độ sản phẩm"]');
    expect(range?.value).toBe('40');
    const areas = [...container.querySelectorAll('textarea')];
    expect(areas[0].placeholder).toContain('ít nhất 3 gạch đầu dòng');
    expect(areas[1].placeholder).toContain('ít nhất 3 gạch đầu dòng');
  });

  it('shows a colored option for each stage when opened', async () => {
    await renderForm();
    const stageTrigger = listboxButton('Giai đoạn');
    await act(async () => {
      stageTrigger.click();
    });
    const kiemThu = [...container.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent.includes('Kiểm thử sản phẩm'),
    );
    expect(kiemThu?.className).toContain('bg-amber-100');
    await act(async () => {
      kiemThu.click();
    });
    expect(stageTrigger.textContent).toContain('Kiểm thử sản phẩm');
    expect(stageTrigger.className).toContain('bg-amber-100');
  });
});
