import { useId, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_MB } from '../../../config/submissionConfig.js';
import { formatUploadSize } from '../../../lib/submissionValidate.js';

export function FileDropzone({ file, disabled, error, onFileChange, id, ...inputProps }) {
  const autoId = useId();
  const inputId = id || autoId;
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = ALLOWED_EXTENSIONS.join(',');

  const applyFile = (next) => {
    onFileChange(next || null);
  };

  return (
    <div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => applyFile(event.target.files?.[0] || null)}
        {...inputProps}
      />
      {file ? (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">{formatUploadSize(file.size)}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            disabled={disabled}
            aria-label="Bỏ file"
            onClick={() => {
              applyFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition ${
            dragOver
              ? 'border-brand-400 bg-brand-50/80 dark:border-brand-400 dark:bg-brand-500/10'
              : 'border-slate-300 bg-white hover:border-brand-300 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-brand-500/50 dark:hover:bg-slate-900/80'
          } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            if (disabled) return;
            applyFile(event.dataTransfer.files?.[0] || null);
          }}
        >
          <Upload className="h-7 w-7 text-brand-600 dark:text-brand-300" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            Kéo thả file vào đây hoặc bấm để chọn
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ALLOWED_EXTENSIONS.join(', ')} · tối đa {MAX_UPLOAD_SIZE_MB}MB
          </p>
        </label>
      )}
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
