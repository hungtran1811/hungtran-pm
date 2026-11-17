// @vitest-environment happy-dom
import { act, createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PinCodeInput } from './StudentPinGate.jsx';

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

function Harness() {
  const [pin, setPin] = useState('');
  return createElement(PinCodeInput, { value: pin, onChange: setPin });
}

function boxes() {
  return [...container.querySelectorAll('input')];
}

describe('PinCodeInput', () => {
  it('keeps four digits hidden until the student asks to see them', async () => {
    await act(async () => root.render(createElement(Harness)));
    const inputs = boxes();
    expect(inputs).toHaveLength(4);
    expect(inputs.every((input) => input.type === 'password')).toBe(true);

    await act(async () => {
      inputs[0].value = '1';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      boxes()[1].value = '2';
      boxes()[1].dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(boxes().map((input) => input.value).join('')).toBe('12');

    const toggle = [...container.querySelectorAll('button')].find((button) =>
      button.getAttribute('aria-label') === 'Hiện PIN',
    );
    await act(async () => toggle.click());
    expect(boxes().every((input) => input.type === 'text')).toBe(true);
    expect(toggle.getAttribute('aria-label')).toBe('Ẩn PIN');
  });

  it('fills every box from a pasted code', async () => {
    await act(async () => root.render(createElement(Harness)));
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    paste.clipboardData = { getData: () => '12ab34' };
    await act(async () => boxes()[0].dispatchEvent(paste));
    expect(boxes().map((input) => input.value).join('')).toBe('1234');
  });

  it('moves focus to the confirm PIN after four digits', async () => {
    const onComplete = vi.fn();
    function HarnessComplete() {
      const confirmRef = useRef(null);
      const [pin, setPin] = useState('');
      const [confirm, setConfirm] = useState('');
      return createElement(
        'div',
        null,
        createElement(PinCodeInput, {
          value: pin,
          onChange: setPin,
          onComplete,
        }),
        createElement(PinCodeInput, { ref: confirmRef, value: confirm, onChange: setConfirm }),
      );
    }

    await act(async () => root.render(createElement(HarnessComplete)));
    const typeDigit = async (index, digit) => {
      const box = [...container.querySelectorAll('input')][index];
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      await act(async () => {
        setter.call(box, digit);
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };
    await typeDigit(0, '1');
    await typeDigit(1, '2');
    await typeDigit(2, '3');
    await typeDigit(3, '4');
    expect([...container.querySelectorAll('input')].slice(0, 4).map((input) => input.value).join('')).toBe('1234');
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
