// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ProgressReportView.jsx', () => ({
  ProgressReportView: () => createElement('div', { 'data-report': 'form' }, 'Form báo cáo'),
}));
vi.mock('./DriveSubmitPage.jsx', () => ({
  DriveSubmitPage: () => createElement('div', { 'data-submit': 'form' }, 'Form nộp file'),
}));
vi.mock('./ProjectExtrasPanel.jsx', () => ({
  ProjectExtrasPanel: () => createElement('div', { 'data-extras': 'panel' }, 'Liên kết'),
}));
vi.mock('./ProgressReportHistory.jsx', () => ({
  ProgressReportHistory: () =>
    createElement('details', null, createElement('summary', null, 'Đã gửi 0 báo cáo')),
}));
vi.mock('./ProjectSubmissionGuide.jsx', () => ({
  GUIDE_SECTIONS: { overview: 'overview' },
  ProjectSubmissionGuide: () => createElement('div', null, 'Hướng dẫn'),
}));

import { FinalProjectStudentView } from './FinalProjectStudentView.jsx';

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

const classDoc = { curriculumCurrentSession: 13, finalMode: 'project' };
const program = {
  lessons: [{ sessionNumber: 13, title: 'Slidedeck, Demo & Luyện tập thuyết trình sản phẩm' }],
};
const student = {
  id: 's1',
  projectName: 'Game demo',
  projectNameStatus: 'approved',
  currentStage: 'Xây dựng sản phẩm',
  currentProgressPercent: 40,
};

async function renderView() {
  await act(async () => {
    root.render(
      createElement(FinalProjectStudentView, {
        classDoc,
        program,
        student,
      }),
    );
  });
}

describe('FinalProjectStudentView work tab', () => {
  it('shows the lesson once and starts on the report step', async () => {
    await renderView();
    const lessonMentions = container.textContent.match(/Buổi 13/g) || [];
    expect(lessonMentions).toHaveLength(1);
    expect(container.querySelector('[data-report="form"]')).not.toBeNull();
    expect(container.querySelector('[data-submit="form"]')?.closest('.hidden')).not.toBeNull();
  });

  it('switches to the file step without remounting the report form', async () => {
    await renderView();
    const submitTab = [...container.querySelectorAll('[role="tab"]')].find((el) =>
      el.textContent.includes('Nộp file'),
    );
    await act(async () => {
      submitTab.click();
    });
    expect(container.querySelector('[data-report="form"]')?.closest('.hidden')).not.toBeNull();
    expect(container.querySelector('[data-submit="form"]')?.closest('.hidden')).toBeNull();
    expect(container.textContent.match(/Buổi 13/g) || []).toHaveLength(1);
  });

  it('does not show a separate Quy trình tab', async () => {
    await renderView();
    const tabLabels = [...container.querySelectorAll('button')].map((el) => el.textContent);
    expect(tabLabels.some((text) => text.includes('Quy trình'))).toBe(false);
    expect(tabLabels.some((text) => text.includes('Hướng dẫn'))).toBe(true);
  });
});
