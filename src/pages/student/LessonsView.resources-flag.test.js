// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/features.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    FEATURE_LESSON_RESOURCES_ENABLED: false,
    FEATURE_KNOWLEDGE_FEEDBACK_ENABLED: false,
  };
});

vi.mock('../../services/students.service.js', () => ({
  recordLessonOpened: vi.fn(async () => {}),
}));

vi.mock('../../services/curriculum.service.js', () => ({
  getProgramLesson: vi.fn(async () => null),
}));

vi.mock('../../services/knowledgeReports.service.js', () => ({
  subscribeFeedbackReceipt: vi.fn(() => () => {}),
  submitKnowledgeReport: vi.fn(async () => {}),
}));

import { LessonsView } from './LessonsView.jsx';

let container;
let root;

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
      resources: [
        {
          id: 'r1',
          title: 'Starter HTML',
          fileName: 'starter.zip',
          downloadUrl: 'https://drive.google.com/uc?export=download&id=abc',
          size: 1024,
        },
      ],
    },
  ],
};

describe('LessonsView when lesson resources are disabled', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('hides the download card even when the lesson has files', async () => {
    await act(async () => {
      root.render(
        createElement(LessonsView, {
          classDoc: { classCode: 'WEB-TEST', curriculumCurrentSession: 1 },
          program,
          student: { id: 'student-1' },
          autoOpenResume: false,
        }),
      );
    });

    const openLesson = [...container.querySelectorAll('button')].find((button) =>
      button.textContent.includes('HTML cơ bản'),
    );
    await act(async () => openLesson.click());

    expect(container.querySelector('[aria-label="Tài nguyên buổi 1"]')).toBeNull();
    expect(container.querySelector('a[href*="uc?export=download"]')).toBeNull();
  });
});
