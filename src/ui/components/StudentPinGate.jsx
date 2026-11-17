import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from './Button.jsx';
import { Field } from './Field.jsx';
import { Spinner } from './Spinner.jsx';
import {
  claimPin,
  fetchPinGate,
  requestPinReset,
  setResetPin,
  verifyPin,
} from '../../services/studentGate.service.js';
import { PIN_MISMATCH_MESSAGE, pinConfirmDiverged } from '../../lib/pinFlow.js';

export function StudentPinGate({ classCode, student, onSuccess, onBack }) {
  const [mode, setMode] = useState('loading');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setMode('loading');
    setError('');
    fetchPinGate({ classCode, studentId: student.id })
      .then((result) => {
        if (!cancelled) setMode(result.mode || 'needsVerify');
      })
      .catch((loadError) => {
        if (!cancelled) {
          setMode('error');
          setError(loadError.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [classCode, student.id]);

  useEffect(() => {
    if (mode !== 'pendingReset') return undefined;
    let cancelled = false;
    const timer = setInterval(() => {
      fetchPinGate({ classCode, studentId: student.id })
        .then((result) => {
          if (cancelled) return;
          const next = result.mode || 'needsVerify';
          if (next === 'pendingReset') return;
          setPin('');
          setConfirmPin('');
          setNotice('');
          setMode(next);
        })
        .catch(() => {});
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [mode, classCode, student.id]);

  const submit = async (event) => {
    event.preventDefault();
    if (needsPair && pinConfirmDiverged(pin, confirmPin)) return;
    setBusy(true);
    setError('');
    try {
      const payload =
        mode === 'needsClaim'
          ? await claimPin({ classCode, studentId: student.id, pin, confirmPin })
          : mode === 'needsResetPin'
            ? await setResetPin({ classCode, studentId: student.id, pin, confirmPin })
            : await verifyPin({ classCode, studentId: student.id, pin });
      await onSuccess(payload.token);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  };

  const askReset = async () => {
    setBusy(true);
    setError('');
    try {
      await requestPinReset({ classCode, studentId: student.id });
      setMode('pendingReset');
      setNotice('Đã gửi yêu cầu. Đợi giáo viên duyệt rồi đặt mã mới.');
    } catch (resetError) {
      setError(resetError.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmRef = useRef(null);
  const needsPair = mode === 'needsClaim' || mode === 'needsResetPin';
  const pinMismatch = needsPair && pinConfirmDiverged(pin, confirmPin);

  if (mode === 'loading') {
    return (
      <div
        className="card mx-auto flex max-w-md flex-col items-center gap-3 px-5 py-10"
        role="status"
        aria-live="polite"
      >
        <Spinner className="h-8 w-8" />
        <p className="text-sm font-medium text-slate-500">Đang kiểm tra mã PIN...</p>
        <Button type="button" variant="ghost" onClick={onBack}>
          Chọn tên khác
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-md space-y-4 p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Mã PIN</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-50">{student.fullName}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'needsClaim'
            ? 'Đặt 4 chữ số và nhập lại. Không có mã kích hoạt.'
            : 'Nhập 4 chữ số của em.'}
        </p>
      </div>
      {mode === 'locked' ? (
        <p className="text-sm text-slate-600">Mã đang tạm khóa. Thử lại sau ít phút hoặc nhờ giáo viên.</p>
      ) : null}
      {mode === 'pendingReset' ? (
        <p className="text-sm text-slate-600">
          {notice || 'Yêu cầu đang chờ giáo viên duyệt. Ô đặt mã mới sẽ hiện khi được duyệt.'}
        </p>
      ) : null}
      {needsPair || mode === 'needsVerify' ? (
        <>
          <Field label={needsPair ? 'PIN mới' : 'PIN'}>
            <PinCodeInput
              value={pin}
              onChange={setPin}
              disabled={busy}
              autoFocus
              onComplete={needsPair ? () => confirmRef.current?.focus() : undefined}
            />
          </Field>
          {needsPair ? (
            <Field label="Nhập lại PIN" error={pinMismatch ? PIN_MISMATCH_MESSAGE : ''}>
              <PinCodeInput ref={confirmRef} value={confirmPin} onChange={setConfirmPin} disabled={busy} />
            </Field>
          ) : null}
          <Button type="submit" className="w-full" loading={busy} disabled={pinMismatch}>
            {needsPair ? 'Xác nhận' : 'Vào lớp'}
          </Button>
        </>
      ) : null}
      {mode === 'needsVerify' ? (
        <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={askReset}>
          Quên PIN
        </Button>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        Chọn tên khác
      </Button>
    </form>
  );
}

function digitsOf(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 4).split('');
}

export const PinCodeInput = forwardRef(function PinCodeInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
}, ref) {
  const [visible, setVisible] = useState(false);
  const inputsRef = useRef([]);
  const digits = digitsOf(value);

  useImperativeHandle(ref, () => ({
    focus() {
      inputsRef.current[0]?.focus();
    },
  }));

  const write = (nextDigits) => {
    const next = nextDigits.join('').replace(/\D/g, '').slice(0, 4);
    const completed = digits.join('').length < 4 && next.length === 4;
    onChange(next);
    if (completed) onComplete?.();
    return completed;
  };

  const putDigit = (index, digit) => {
    const next = digits.slice();
    next[index] = digit;
    const completed = write(next);
    if (!completed && digit && index < 3) inputsRef.current[index + 1]?.focus();
  };

  const onPaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    event.preventDefault();
    const completed = write(pasted.split(''));
    if (!completed) inputsRef.current[Math.min(pasted.length, 3)]?.focus();
  };

  return (
    <div className="flex w-full items-center gap-2">
      <div
        className="grid min-w-0 flex-1 grid-cols-4 gap-2"
        role="group"
        aria-label="4 chữ số"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
      >
        {[0, 1, 2, 3].map((index) => (
          <input
            key={index}
            ref={(node) => {
              inputsRef.current[index] = node;
            }}
            id={index === 0 ? id : undefined}
            className="input-base h-12 w-full min-w-0 px-0 text-center text-lg font-semibold tabular-nums [&::-ms-reveal]:hidden"
            type={visible ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            aria-label={`Số thứ ${index + 1}`}
            value={digits[index] || ''}
            disabled={disabled}
            autoFocus={autoFocus && index === 0}
            onPaste={onPaste}
            onChange={(event) => {
              const digit = event.target.value.replace(/\D/g, '').slice(-1);
              putDigit(index, digit);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') {
                inputsRef.current[Math.max(0, index - 1)]?.focus();
              }
              if (event.key === 'ArrowRight') {
                inputsRef.current[Math.min(3, index + 1)]?.focus();
              }
              if (event.key !== 'Backspace') return;
              event.preventDefault();
              if (digits[index]) {
                putDigit(index, '');
                return;
              }
              const previous = Math.max(0, index - 1);
              putDigit(previous, '');
              inputsRef.current[previous]?.focus();
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:opacity-60 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        aria-pressed={visible}
        aria-label={visible ? 'Ẩn PIN' : 'Hiện PIN'}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
});
