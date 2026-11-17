// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudentShell } from './StudentShell.jsx';

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

function renderShell(props = {}, initialEntries = ['/']) {
  return act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries },
        createElement(
          StudentShell,
          {
            bottomNavItems: [{ id: 'lessons', label: 'Bài giảng', sectionId: 'student-lessons' }],
            ...props,
          },
          createElement('section', { id: 'student-lessons' }, 'Nội dung'),
        ),
      ),
    );
  });
}

describe('StudentShell lesson reading layout', () => {
  it('uses the lesson-width shell and keeps bottom navigation outside lesson detail', async () => {
    await renderShell();

    expect(container.querySelector('main')?.classList).toContain('max-w-[90rem]');
    expect(container.querySelector('header > div')?.classList).toContain('max-w-[90rem]');
    expect(container.querySelector('header img')?.getAttribute('src')).toBe('/logo-wordmark.svg');
    expect(container.querySelector('.student-bottom-nav')).not.toBeNull();
  });

  it('keeps the lesson-width shell and removes bottom navigation while reading a lesson', async () => {
    await renderShell({ activeLessonSession: 1 });

    expect(container.querySelector('main')?.classList).toContain('max-w-[90rem]');
    expect(container.querySelector('header > div')?.classList).toContain('max-w-[90rem]');
    expect(container.querySelector('.student-bottom-nav')).toBeNull();
  });

  it('keeps path navigation visible while reading a lesson', async () => {
    await renderShell({
      activeLessonSession: 1,
      bottomNavItems: [
        { id: 'project', label: 'Dự án', to: '/c/WEB1/project' },
        { id: 'lessons', label: 'Bài giảng', to: '/c/WEB1/lessons' },
      ],
    });

    expect(container.querySelector('.student-bottom-nav')).not.toBeNull();
    expect(container.querySelector('a[href="/c/WEB1/project"]')?.textContent).toContain('Dự án');
  });

  it('renders a join notice outside the scrolling main column', async () => {
    await renderShell({
      notice: createElement('button', { type: 'button' }, 'Tham gia'),
    });

    expect(container.querySelector('.student-game-join-notice')?.textContent).toContain('Tham gia');
    expect(container.querySelector('main')?.textContent).not.toContain('Tham gia');
  });

  it('shows the student groups from the shell items', async () => {
    await renderShell({
      bottomNavItems: [
        { id: 'home', label: 'Trang chủ', to: '/c/WEB1' },
        { id: 'lessons', label: 'Bài học', to: '/c/WEB1/lessons' },
        { id: 'project', label: 'Dự án', to: '/c/WEB1/project' },
      ],
    });

    const primary = container.querySelector('nav[aria-label="Điều hướng chính"]');
    expect([...primary.querySelectorAll('a')].map((link) => link.textContent)).toEqual([
      'Trang chủ',
      'Bài học',
      'Dự án',
    ]);
    expect(container.querySelectorAll('.student-bottom-nav a')).toHaveLength(3);
  });

  it('highlights only the opened tab', async () => {
    const items = [
      { id: 'home', label: 'Trang chủ', to: '/c/WEB1' },
      { id: 'lessons', label: 'Bài học', to: '/c/WEB1/lessons' },
      { id: 'project', label: 'Dự án', to: '/c/WEB1/project' },
      { id: 'games', label: 'Trò chơi', to: '/c/WEB1#tro-choi' },
    ];
    await renderShell({ bottomNavItems: items }, ['/c/WEB1/lessons']);

    const primary = container.querySelector('nav[aria-label="Điều hướng chính"]');
    const selected = [...primary.querySelectorAll('a')]
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent);
    expect(selected).toEqual(['Bài học']);
    expect(primary.querySelector('a')?.className).not.toContain('hover:');
  });

  it('highlights only the games tab when the games anchor is open', async () => {
    await renderShell(
      {
        bottomNavItems: [
          { id: 'home', label: 'Trang chủ', to: '/c/WEB1' },
          { id: 'lessons', label: 'Bài học', to: '/c/WEB1/lessons' },
          { id: 'project', label: 'Dự án', to: '/c/WEB1/project' },
          { id: 'games', label: 'Trò chơi', to: '/c/WEB1#tro-choi' },
        ],
      },
      ['/c/WEB1#tro-choi'],
    );

    const selected = [...container.querySelectorAll('nav[aria-label="Điều hướng chính"] a')]
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent);
    expect(selected).toEqual(['Trò chơi']);
  });

  it('tightens top padding on the compact project workspace', async () => {
    await renderShell({ compactMain: true, bottomNavItems: [] });

    expect(container.querySelector('main')?.classList).toContain('pt-2');
    expect(container.querySelector('main')?.classList).not.toContain('pt-5');
  });
});
