import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { badgeToneClass } from './Badge.jsx';

export function ToneSelect({
  id,
  value,
  onChange,
  options = [],
  tones = {},
  label,
  className = '',
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedTone = tones[value] || 'slate';

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        id={id}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        onClick={() => setOpen((prev) => !prev)}
        className={`input-base flex w-full items-center justify-between gap-2 text-left font-medium ${badgeToneClass(
          selectedTone,
        )}`}
      >
        <span className="min-w-0 truncate">{value}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 opacity-70 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute z-30 mt-1 w-full space-y-1 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {options.map((option) => {
            const selected = option === value;
            const tone = tones[option] || 'slate';
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange?.(option);
                  setOpen(false);
                }}
                className={`flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm font-medium ${badgeToneClass(
                  tone,
                )} ${selected ? 'ring-2 ring-inset ring-black/15 dark:ring-white/25' : ''}`}
              >
                <span className="min-w-0 truncate">{option}</span>
                {selected ? <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
