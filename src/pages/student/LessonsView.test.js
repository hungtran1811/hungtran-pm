// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LessonsView } from './LessonsView.jsx';

vi.mock('../../services/students.service.js', () => ({
  recordLessonOpened: vi.fn(async () => {}),
}));

vi.mock('../../services/curriculum.service.js', () => ({
  getProgramLesson: vi.fn(async () => null),
}));

let container;
let root;

const classDoc = {
  classCode: 'WEB-TEST',
  curriculumCurrentSession: 2,
};

const program = {
  id: 'web-basic',
  lessons: [
    {
      id: 'lesson-1',
      sessionNumber: 1,
      title: 'HTML cơ bản',
      content: '<section class="lesson-section"><h2>Nội dung thử nghiệm</h2></section>',
      contentFormat: 'html',
      presentationPreset: 'hungtran-v1',
    },
    {
      id: 'lesson-2',
      sessionNumber: 2,
      title: 'CSS cơ bản',
      content: '<section class="lesson-section"><h2>Buổi hai</h2></section>',
      contentFormat: 'html',
      presentationPreset: 'hungtran-v1',
    },
  ],
};

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  document.body.style.overflow = '';
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.style.overflow = '';
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

function findButton(label) {
  return [...container.querySelectorAll('button')].find((button) =>
    button.textContent.includes(label),
  );
}

function renderLessonsView(props = {}) {
  return act(async () => {
    root.render(
      createElement(LessonsView, {
        classDoc,
        program,
        student: { id: 'student-1' },
        autoOpenResume: false,
        ...props,
      }),
    );
  });
}

describe('LessonsView reading workspace', () => {
  it('keeps lesson content mounted while focus mode opens and restores focus on exit', async () => {
    const onActiveSessionChange = vi.fn();
    await renderLessonsView({ onActiveSessionChange });

    await act(async () => findButton('HTML cơ bản').click());

    expect(onActiveSessionChange).toHaveBeenLastCalledWith(1);
    expect(container.querySelector('aside[aria-label="Điều hướng buổi học"]')).not.toBeNull();

    const contentBeforeFocus = container.querySelector('.lesson-content');
    const focusButton = findButton('Chế độ tập trung');
    await act(async () => focusButton.click());

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    expect(container.querySelector('.lesson-content')).toBe(contentBeforeFocus);

    const dialog = container.querySelector('[role="dialog"]');
    const focusableElements = [
      ...dialog.querySelectorAll(
        'a[href], button:not([disabled]), iframe, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    dialog.focus();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }),
      );
    });
    expect(document.activeElement).toBe(focusableElements.at(-1));

    focusableElements.at(-1).focus();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    });
    expect(document.activeElement).toBe(focusableElements[0]);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement?.textContent).toContain('Chế độ tập trung');
    expect(container.querySelector('.lesson-content')).toBe(contentBeforeFocus);

    await act(async () => findButton('Chế độ tập trung').click());
    const backToListButton = container.querySelector('button[aria-label="Danh sách"]');
    await act(async () => backToListButton.click());

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement?.textContent).toContain('HTML cơ bản');
  });

  it('keeps a legacy lesson iframe reachable inside the focus trap', async () => {
    const legacyProgram = {
      ...program,
      lessons: [
        {
          ...program.lessons[0],
          content:
            '<!doctype html><html><head><style>body{font-family:sans-serif}</style></head><body><h2>Tài liệu cũ</h2></body></html>',
          presentationPreset: 'legacy-document',
        },
      ],
    };

    await renderLessonsView({ program: legacyProgram });
    await act(async () => findButton('HTML cơ bản').click());
    await act(async () => findButton('Chế độ tập trung').click());

    const dialog = container.querySelector('[role="dialog"]');
    const iframe = dialog.querySelector('iframe');
    const focusableElements = [
      ...dialog.querySelectorAll(
        'a[href], button:not([disabled]), iframe, input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];

    expect(iframe).not.toBeNull();
    expect(focusableElements).toContain(iframe);
    expect(focusableElements.at(-1)).toBe(iframe);
    iframe.focus();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    });
    expect(document.activeElement).toBe(focusableElements[0]);
  });

  it('collapses the desktop rail to session numbers by default', async () => {
    await renderLessonsView();
    await act(async () => findButton('HTML cơ bản').click());

    expect(container.querySelector('button[aria-label="Mở rộng thanh buổi học"]')).not.toBeNull();
    expect(
      container.querySelector('aside[aria-label="Điều hướng buổi học"] .line-clamp-2'),
    ).toBeNull();
    expect(container.querySelector('button[aria-label="Quay lại đầu trang"]')).toBeNull();
  });

  it('honors a saved expanded rail preference', async () => {
    localStorage.setItem('student:lesson-rail-collapsed:v1', '0');
    await renderLessonsView();
    await act(async () => findButton('HTML cơ bản').click());

    expect(container.querySelector('button[aria-label="Thu gọn thanh buổi học"]')).not.toBeNull();
    expect(
      container.querySelector('aside[aria-label="Điều hướng buổi học"] .line-clamp-2')?.textContent,
    ).toContain('HTML cơ bản');
  });

  it('shows a back-to-top control after scrolling and returns to the top', async () => {
    const originalScrollTo = window.scrollTo;
    const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0, writable: true });

    await renderLessonsView();
    await act(async () => findButton('HTML cơ bản').click());

    window.scrollY = 480;
    await act(async () => window.dispatchEvent(new Event('scroll')));

    const backToTop = container.querySelector('button[aria-label="Quay lại đầu trang"]');
    expect(backToTop).not.toBeNull();
    await act(async () => backToTop.click());
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

    window.scrollTo = originalScrollTo;
    if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
    else delete window.scrollY;
  });

  it('persists the desktop rail preference without affecting lesson navigation', async () => {
    await renderLessonsView();
    await act(async () => findButton('HTML cơ bản').click());

    const expandButton = container.querySelector('button[aria-label="Mở rộng thanh buổi học"]');
    await act(async () => expandButton.click());
    expect(localStorage.getItem('student:lesson-rail-collapsed:v1')).toBe('0');
    expect(container.querySelector('button[aria-label="Thu gọn thanh buổi học"]')).not.toBeNull();

    const collapseButton = container.querySelector('button[aria-label="Thu gọn thanh buổi học"]');
    await act(async () => collapseButton.click());
    expect(localStorage.getItem('student:lesson-rail-collapsed:v1')).toBe('1');
    expect(container.querySelector('button[aria-label="Mở rộng thanh buổi học"]')).not.toBeNull();

    const nextButtons = [...container.querySelectorAll('button[aria-label="Buổi sau"]')];
    await act(async () => nextButtons[0].click());
    expect(container.querySelector('h1')?.textContent).toContain('CSS cơ bản');
  });
});

describe('LessonsView auto-open resume', () => {
  it('opens the current session on mount and stays on the list after going back', async () => {
    const onActiveSessionChange = vi.fn();
    await renderLessonsView({ autoOpenResume: true, onActiveSessionChange });

    expect(onActiveSessionChange).toHaveBeenLastCalledWith(2);
    expect(container.querySelector('h1')?.textContent).toContain('CSS cơ bản');
    expect(container.querySelector('aside[aria-label="Điều hướng buổi học"]')).not.toBeNull();

    await act(async () => findButton('Danh sách').click());

    expect(onActiveSessionChange).toHaveBeenLastCalledWith(null);
    expect(findButton('Tiếp tục học — Buổi 2')).not.toBeUndefined();
    expect(findButton('HTML cơ bản')).not.toBeUndefined();
    expect(container.querySelector('aside[aria-label="Điều hướng buổi học"]')).toBeNull();
  });

  it('hides the lesson grid when hideLessonList is set', async () => {
    await renderLessonsView({ autoOpenResume: true, hideLessonList: true, showBack: false });

    expect(container.querySelector('h1')?.textContent).toContain('CSS cơ bản');
    expect(findButton('Tiếp tục học — Buổi 2')).toBeUndefined();
    expect(findButton('Danh sách')).toBeUndefined();
    expect(container.querySelector('h2')?.textContent).not.toBe('Bài giảng');
  });

  it('exits to the parent workspace instead of the lesson grid', async () => {
    const onExitReader = vi.fn();
    await renderLessonsView({
      autoOpenResume: true,
      hideLessonList: true,
      backLabel: 'Về dự án',
      onExitReader,
    });

    await act(async () => findButton('Về dự án').click());

    expect(onExitReader).toHaveBeenCalledTimes(1);
    expect(findButton('Tiếp tục học — Buổi 2')).toBeUndefined();
    expect(container.querySelector('h1')?.textContent).toContain('CSS cơ bản');
  });
});
