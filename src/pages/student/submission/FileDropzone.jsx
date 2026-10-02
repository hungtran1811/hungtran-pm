import { useId, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILES_PER_SUBMIT,
  MAX_UPLOAD_SIZE_MB,
} from '../../../config/submissionConfig.js';
import { formatUploadSize } from '../../../lib/submissionValidate.js';

function fileKey(file) {
  return String(file?.name || '').trim().toLowerCase();
}

function mergeSelectedFiles(current, incoming, max) {
  const next = [...current];
  const seen = new Set(next.map(fileKey));
  let overflow = false;
  let duplicate = false;
  for (const file of incoming) {
    if (!file) continue;
    const key = fileKey(file);
    if (!key) continue;
    if (seen.has(key)) {
      duplicate = true;
      continue;
    }
    if (next.length >= max) {
      overflow = true;
      break;
    }
    seen.add(key);
    next.push(file);
  }
  return { files: next, overflow, duplicate };
}

export function FileDropzone({ files = [], disabled, error, onFilesChange, id }) {
  const autoId = useId();
  const inputId = id || autoId;
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const accept = ALLOWED_EXTENSIONS.join(',');
  const canAddMore = files.length < MAX_FILES_PER_SUBMIT;

  const applyIncoming = (incoming) => {
    const result = mergeSelectedFiles(files, incoming, MAX_FILES_PER_SUBMIT);
    onFilesChange?.(result.files, {
      overflow: result.overflow,
      duplicate: result.duplicate,
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeAt = (index) => {
    onFilesChange?.(
      files.filter((_, itemIndex) => itemIndex !== index),
      {},
    );
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        disabled={disabled || !canAddMore}
        onChange={(event) => applyIncoming(Array.from(event.target.files || []))}
      />

      {files.length ? (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${fileKey(file)}-${index}`}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{formatUploadSize(file.size)}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                disabled={disabled}
                aria-label={`Bỏ ${file.name}`}
                onClick={() => removeAt(index)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {canAddMore ? (
        <label
          htmlFor={inputId}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 text-center transition ${
            files.length ? 'mt-2 min-h-24 py-4' : 'min-h-36 py-6'
          } ${
            dragOver
              ? 'border-brand-400 bg-brand-50/80 dark:border-brand-400 dark:bg-brand-500/10'
              : 'border-brand-200 bg-brand-50/40 hover:border-brand-400 hover:bg-brand-50/80 dark:border-brand-500/30 dark:bg-brand-500/5 dark:hover:border-brand-400 dark:hover:bg-brand-500/10'
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
            applyIncoming(Array.from(event.dataTransfer.files || []));
          }}
        >
          <Upload className="h-7 w-7 text-brand-600 dark:text-brand-300" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            {files.length
              ? `Thêm file (${files.length}/${MAX_FILES_PER_SUBMIT})`
              : 'Kéo thả file vào đây hoặc bấm để chọn'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ALLOWED_EXTENSIONS.join(', ')} · tối đa {MAX_UPLOAD_SIZE_MB}MB / file · tối đa {MAX_FILES_PER_SUBMIT}{' '}
            file
          </p>
        </label>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Đã chọn đủ {MAX_FILES_PER_SUBMIT} file cho lần nộp này.</p>
      )}

      {error ? (
        <p className="mt-1 text-xs font-medium text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
