// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from './AppShell.jsx';

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

describe('AppShell V11 navigation', () => {
  it('shows five primary groups and keeps analytics and settings out of that bar', async () => {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/admin'] },
          createElement(AppShell, { title: 'Tổng quan' }, 'Nội dung'),
        ),
      );
    });

    const primary = container.querySelector('nav[aria-label="Điều hướng chính"]');
    const labels = [...primary.querySelectorAll('a')].map((link) => link.textContent);
    expect(labels).toEqual(['Tổng quan', 'Lớp & bài giảng', 'Học sinh', 'Báo cáo', 'Mini game']);
    expect(primary.textContent).not.toContain('Thống kê');
    expect(primary.textContent).not.toContain('Cài đặt');
    expect(container.querySelector('header img')?.getAttribute('src')).toBe('/logo-wordmark.svg');
    expect(container.textContent).not.toContain('Personal Teaching Workspace');
  });

  it('anchors the account menu to the avatar instead of the viewport edge', async () => {
    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ['/admin'] },
          createElement(AppShell, { title: 'Tổng quan' }, 'Nội dung'),
        ),
      );
    });

    const button = container.querySelector('button[aria-label="Không gian riêng của giáo viên"]');
    await act(async () => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(button.parentElement.className).toContain('relative');
    const menu = button.parentElement.querySelector('[class*="absolute"]');
    expect(menu.className).toContain('right-0');
    expect(menu.className).toContain('top-full');
    expect(menu.textContent).toContain('Đăng xuất');
  });
});
