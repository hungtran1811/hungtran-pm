// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudentPhaseHome } from './StudentPortal.jsx';

const context = {
  classCode: 'WEB1',
  classDoc: {
    classCode: 'WEB1',
    className: 'Web Basic',
    curriculumPhase: 'final',
    curriculumCurrentSession: 10,
    finalMode: 'project',
  },
  program: { name: 'Web Basic', totalSessionCount: 14, finalMode: 'project' },
  student: {
    id: 's1',
    fullName: 'Gia Bảo',
    projectName: 'BếpGọn',
    projectNameStatus: 'approved',
    currentStage: 'Xây dựng sản phẩm',
    currentProgressPercent: 46,
    latestReportId: 'r1',
  },
};

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

describe('StudentPhaseHome', () => {
  it('shows the learning summary from the reference and no games tab', async () => {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/c/WEB1'] },
          createElement(
            Routes,
            null,
            createElement(
              Route,
              {
                path: '/c/WEB1',
                element: createElement(Outlet, { context }),
              },
              createElement(Route, { index: true, element: createElement(StudentPhaseHome) }),
            ),
          ),
        ),
      );
    });

    const text = container.textContent;
    expect(text).toContain('Xin chào, Gia Bảo!');
    expect(text).not.toContain('Tiếp tục học đúng buổi');
    expect(text).not.toContain('Học một chút mỗi ngày');
    expect(text).not.toContain('Tiến bộ qua từng dự án');
    expect(text).not.toContain('không gian học tập');
    expect(container.querySelector('.student-hero-orbit')).not.toBeNull();
    expect(text).toContain('10/14');
    expect(text).toContain('46%');
    expect(text).toContain('Đã có');
    expect(text).toContain('BếpGọn');
    expect(text).toContain('Hành trình học tập');
    expect(text).toContain('Xem tài liệu buổi hiện tại');
    expect(text).toContain('Cập nhật sản phẩm');
    expect(text).not.toContain('Trò chơi');
    expect(text).not.toContain('Vào mini game');
  });
});
