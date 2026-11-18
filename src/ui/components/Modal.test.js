// @vitest-environment happy-dom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Modal } from './Modal.jsx';

let container;
let root;

function PinDialog() {
  const [pin, setPin] = useState('');
  return createElement(Modal, {
    open: true,
    onClose: () => {},
    title: 'PIN',
    children: createElement('input', {
      'aria-label': 'PIN mới',
      value: pin,
      onChange: (event) => setPin(event.target.value),
    }),
  });
}

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

describe('Modal focus', () => {
  it('keeps the field focused while typing instead of moving to the close button', async () => {
    await act(async () => {
      root.render(createElement(PinDialog));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const field = container.querySelector('[aria-label="PIN mới"]');
    const closeButton = container.querySelector('[aria-label="Đóng"]');
    expect(document.activeElement).toBe(field);
    expect(closeButton.tabIndex).toBe(-1);

    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      field.focus();
      valueSetter.call(field, '1');
      field.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(field.value).toBe('1');
    expect(document.activeElement).toBe(field);
    expect(document.activeElement).not.toBe(closeButton);
  });
});
