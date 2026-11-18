// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaskedPin } from './ClassPinBoard.jsx';
import { StudentPinGate } from './StudentPinGate.jsx';

const fetchPinGate = vi.fn();

vi.mock('../../services/studentGate.service.js', () => ({
  fetchPinGate: (...args) => fetchPinGate(...args),
  claimPin: vi.fn(),
  requestPinReset: vi.fn(),
  setResetPin: vi.fn(),
  verifyPin: vi.fn(),
}));

let container;
let root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  fetchPinGate.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('MaskedPin', () => {
  it('shows PIN status and never the digits', async () => {
    await act(async () => {
      root.render(createElement(MaskedPin, { status: 'Đang dùng', hasCredential: true }));
    });
    expect(container.textContent).toContain('Đang dùng');
    expect(container.textContent).not.toContain('1234');
    expect(container.querySelector('button')).toBeNull();
  });
});

describe('StudentPinGate', () => {
  it('asks for the existing PIN and has no forgot-PIN action', async () => {
    fetchPinGate.mockResolvedValue({ mode: 'needsVerify' });

    await act(async () => {
      root.render(createElement(StudentPinGate, {
        classCode: 'LOP',
        student: { id: 'stu-1', fullName: 'Học sinh A' },
        onSuccess: vi.fn(),
        onBack: vi.fn(),
      }));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Nhập 4 chữ số của em.');
    expect(container.textContent).not.toContain('Quên PIN');
    expect(container.textContent).not.toContain('chờ giáo viên duyệt');
  });
});
