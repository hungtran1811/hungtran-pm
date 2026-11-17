// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectProductLinks } from './ProjectProductLinks.jsx';

const student = {
  id: 's1',
  projectGithubUrl: '',
  projectCanvaUrl: '',
  projectSlidesUrl: '',
  projectOtherUrl: '',
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
});

function render(links) {
  return act(async () => {
    root.render(
      createElement(ProjectProductLinks, {
        student,
        links,
        onChange: () => {},
        compact: true,
      }),
    );
  });
}

describe('ProjectProductLinks', () => {
  it('shows Canva and keeps the other links behind add buttons', async () => {
    await render({ githubUrl: '', canvaUrl: '', slidesUrl: '', otherUrl: '' });

    const addButtons = () =>
      [...container.querySelectorAll('button')].map((button) => button.textContent.trim());

    expect(container.querySelector('input[placeholder*="canva"]')).toBeTruthy();
    expect(container.querySelector('input[placeholder*="github.com"]')).toBeNull();
    expect(container.querySelector('input[placeholder*="presentation"]')).toBeNull();
    expect(addButtons()).toEqual(['GitHub', 'Google Slides', 'Link khác', 'Lưu liên kết']);

    const githubButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent.trim() === 'GitHub',
    );
    await act(async () => githubButton.click());

    expect(container.querySelector('input[placeholder*="github.com"]')).toBeTruthy();
    expect(addButtons()).toEqual(['Google Slides', 'Link khác', 'Lưu liên kết']);
  });

  it('shows a saved extra link without asking to add it again', async () => {
    await render({
      githubUrl: 'https://github.com/me/app',
      canvaUrl: '',
      slidesUrl: '',
      otherUrl: '',
    });

    expect(container.querySelector('input[placeholder*="github.com"]').value).toBe(
      'https://github.com/me/app',
    );
    const addButtons = [...container.querySelectorAll('button')].map((button) => button.textContent.trim());
    expect(addButtons).toEqual(['Google Slides', 'Link khác', 'Lưu liên kết']);
  });
});
