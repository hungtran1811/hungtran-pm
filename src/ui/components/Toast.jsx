import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext({ notify: () => {} });

let idSeq = 0;

const TONE_STYLES = {
  success: 'border-green-500/30 bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300',
  error: 'border-red-500/30 bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300',
  info: 'border-brand-500/30 bg-brand-50 text-brand-800 dark:bg-brand-500/10 dark:text-brand-200',
};

const TONE_ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message, tone = 'info', duration = 3500) => {
      const id = ++idSeq;
      setToasts((prev) => [...prev, { id, message, tone }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      notify,
      success: (m, d) => notify(m, 'success', d),
      error: (m, d) => notify(m, 'error', d),
      info: (m, d) => notify(m, 'info', d),
    }),
    [notify],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => {
          const Icon = TONE_ICONS[toast.tone] || Info;
          return (
            <button
              type="button"
              key={toast.id}
              onClick={() => dismiss(toast.id)}
              className={`pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-lg transition ${
                TONE_STYLES[toast.tone] || TONE_STYLES.info
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{toast.message}</span>
            </button>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
