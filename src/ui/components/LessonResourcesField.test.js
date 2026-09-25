// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './Toast.jsx';
import { LessonResourcesField } from './LessonResourcesField.jsx';

const lessonDocumentExists = vi.fn();
const saveLessonResources = vi.fn();
const uploadLessonMaterial = vi.fn();

vi.mock('../../services/curriculum.service.js', () => ({
  lessonDocumentExists: (...args) => lessonDocumentExists(...args),
  saveLessonResources: (...args) => saveLessonResources(...args),
}));

vi.mock('../../services/lessonMaterials.service.js', () => ({
  uploadLessonMaterial: (...args) => uploadLessonMaterial(...args),
}));

let container;
let root;
let lastValue = [];
let synced = [];

const uploaded = {
  id: 'r-new',
  title: 'starter.zip',
  fileName: 'starter.zip',
  size: 12,
  mimeType: 'application/zip',
  driveFileId: 'drive-1',
  downloadUrl: 'https://drive.google.com/uc?export=download&id=drive-1',
  addedAt: '2026-09-25T00:00:00.000Z',
};

function Harness({ initial = [] } = {}) {
  const [value, setValue] = useState(initial);
  lastValue = value;
  return createElement(LessonResourcesField, {
    programId: 'web-basic',
    lessonId: 'lesson-1',
    sessionNumber: 3,
    value,
    onChange: setValue,
    onSynced: (next) => {
      synced = next;
    },
  });
}

function renderField(initial = []) {
  return act(async () => {
    root.render(createElement(ToastProvider, null, createElement(Harness, { initial })));
  });
}

describe('LessonResourcesField persist-on-upload', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    lastValue = [];
    synced = [];
    lessonDocumentExists.mockReset().mockResolvedValue(true);
    saveLessonResources.mockReset().mockImplementation(async (_programId, _lessonId, resources) => resources);
    uploadLessonMaterial.mockReset().mockResolvedValue(uploaded);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('writes lesson resources immediately after Drive upload', async () => {
    await renderField();
    const input = container.querySelector('input[type="file"]');
    const file = new File(['hello'], 'starter.zip', { type: 'application/zip' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(uploadLessonMaterial).toHaveBeenCalledTimes(1);
    expect(saveLessonResources).toHaveBeenCalledWith('web-basic', 'lesson-1', [uploaded]);
    expect(lastValue).toEqual([uploaded]);
    expect(synced).toEqual([uploaded]);
    expect(container.textContent).toContain('starter.zip');
  });

  it('does not upload again when the same file name is already recorded', async () => {
    await renderField([uploaded]);
    const input = container.querySelector('input[type="file"]');
    const file = new File(['hello'], 'Starter.zip', { type: 'application/zip' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(uploadLessonMaterial).not.toHaveBeenCalled();
    expect(saveLessonResources).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/đã có trong buổi/i);
  });

  it('does not upload to Drive when the lesson is not saved yet', async () => {
    lessonDocumentExists.mockResolvedValue(false);
    await renderField();
    const input = container.querySelector('input[type="file"]');
    const file = new File(['hello'], 'starter.zip', { type: 'application/zip' });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(uploadLessonMaterial).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/chưa được lưu/i);
  });
});
