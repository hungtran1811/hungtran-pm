import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function MaskedPin({ pin = '', hasCredential = false }) {
  const [open, setOpen] = useState(false);
  if (!hasCredential && !pin) {
    return <span className="text-sm text-slate-400">Chưa có</span>;
  }
  if (!pin) {
    return (
      <span className="text-sm text-slate-400" title="PIN đặt trước khi bật xem lại. Duyệt đặt lại để có mã mới.">
        Không xem lại được
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={open}
      aria-label={open ? 'Ẩn PIN' : 'Hiện PIN'}
      onClick={() => setOpen((value) => !value)}
      className="inline-flex h-10 items-center justify-center gap-2.5 rounded-lg px-2 text-slate-800 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      <span className="inline-flex items-center gap-1.5 font-mono text-xl font-semibold leading-none">
        {(open ? [...pin] : ['•', '•', '•', '•']).map((char, index) => (
          <span key={`${char}-${index}`}>{char}</span>
        ))}
      </span>
      {open ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}
