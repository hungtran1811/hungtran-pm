import { useRef, useState } from 'react';
import { Button } from './Button.jsx';
import { Field } from './Field.jsx';
import { Modal } from './Modal.jsx';
import { useToast } from './Toast.jsx';
import { PinCodeInput } from './StudentPinGate.jsx';
import { PIN_MISMATCH_MESSAGE, pinConfirmDiverged } from '../../lib/pinFlow.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { setStudentPin } from '../../services/studentGate.service.js';

export function AdminPinEditor({
  studentId,
  studentName = '',
  pin = '',
  hasCredential = false,
  status = '',
  onChanged,
}) {
  const toast = useToast();
  const confirmRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [nextPin, setNextPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [busy, setBusy] = useState(false);
  const mismatch = pinConfirmDiverged(nextPin, confirmPin);
  const cellLabel = pin ? '••••' : (hasCredential ? 'Đã đặt' : 'Chưa tạo');

  const close = () => {
    if (busy) return;
    setOpen(false);
    setNextPin('');
    setConfirmPin('');
  };

  const save = async () => {
    setBusy(true);
    try {
      await setStudentPin({ studentId, pin: nextPin, confirmPin });
      toast.success(hasCredential ? 'Đã đổi PIN.' : 'Đã đặt PIN.');
      setOpen(false);
      setNextPin('');
      setConfirmPin('');
      await onChanged?.();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 min-w-16 items-center justify-center rounded-lg px-2 font-mono text-sm font-semibold tabular-nums tracking-widest text-slate-800 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-label={pin ? `Hiện PIN của ${studentName}` : `PIN của ${studentName}`}
      >
        {cellLabel}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={`PIN · ${studentName}`}
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>Đóng</Button>
            <Button onClick={save} loading={busy} disabled={mismatch || nextPin.length !== 4}>
              {hasCredential ? 'Đổi PIN' : 'Đặt PIN'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">PIN hiện tại</p>
            {pin ? (
              <p className="mt-2 font-mono text-3xl font-semibold tracking-[0.35em] text-slate-900 dark:text-slate-50">
                {pin}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {hasCredential
                  ? 'Học sinh đã đặt PIN trước khi hệ thống lưu bản giáo viên xem được. Em đăng nhập lại một lần, rồi bạn tải lại trang này. Hoặc đặt PIN mới bên dưới.'
                  : 'Học sinh chưa đặt PIN. Có thể đặt giúp em bên dưới.'}
              </p>
            )}
            {status ? <p className="mt-2 text-sm text-slate-500">{status}</p> : null}
          </div>
          <Field label={hasCredential ? 'PIN mới' : 'PIN'}>
            <PinCodeInput
              value={nextPin}
              onChange={setNextPin}
              disabled={busy}
              autoFocus
              onComplete={() => confirmRef.current?.focus()}
            />
          </Field>
          <Field label="Nhập lại PIN" error={mismatch ? PIN_MISMATCH_MESSAGE : ''}>
            <PinCodeInput ref={confirmRef} value={confirmPin} onChange={setConfirmPin} disabled={busy} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
