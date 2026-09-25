import { useId, useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import { Button } from './Button.jsx';
import { useToast } from './Toast.jsx';
import {
  LESSON_RESOURCE_EXTENSIONS,
  MAX_LESSON_RESOURCE_SIZE_MB,
  MAX_LESSON_RESOURCES,
} from '../../config/lessonResourceConfig.js';
import {
  canAddLessonResource,
  findExistingLessonResource,
  formatUploadSize,
  normalizeLessonResources,
  validateLessonResourceFile,
} from '../../lib/lessonResources.js';
import {
  lessonDocumentExists,
  saveLessonResources,
} from '../../services/curriculum.service.js';
import { uploadLessonMaterial } from '../../services/lessonMaterials.service.js';

export function LessonResourcesField({
  programId,
  lessonId,
  sessionNumber,
  value,
  onChange,
  onSynced,
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const resources = normalizeLessonResources(value);
  const canAdd = canAddLessonResource(resources);

  const commitResources = async (next, { successMessage } = {}) => {
    const stored = normalizeLessonResources(next);
    try {
      await saveLessonResources(programId, lessonId, stored);
      onChange(stored);
      onSynced?.(stored);
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (err) {
      onChange(stored);
      onSynced?.(stored);
      setError(
        err?.message ||
          'Đã có file trên Drive nhưng chưa ghi vào bài. Hãy Áp dụng rồi Lưu thay đổi.',
      );
      return false;
    }
  };

  const handleFiles = async (file) => {
    if (!file || uploading) return;
    const check = validateLessonResourceFile({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
    if (!check.ok) {
      setError(check.error);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    if (!canAdd) {
      setError(`Mỗi buổi tối đa ${MAX_LESSON_RESOURCES} file.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const duplicate = findExistingLessonResource(resources, file.name);
    if (duplicate) {
      setError(`File "${duplicate.fileName}" đã có trong buổi này. Không tải lên lại.`);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const exists = await lessonDocumentExists(programId, lessonId);
      if (!exists) {
        setError('Bài giảng chưa được lưu. Hãy Áp dụng rồi Lưu thay đổi trước khi thêm file.');
        return;
      }

      const resource = await uploadLessonMaterial({
        programId,
        sessionNumber,
        file,
        existingResources: resources,
        onProgress: setProgress,
      });
      await commitResources([...resources, resource], {
        successMessage: 'Đã lưu file vào bài giảng. Không cần bấm Lưu cho phần này.',
      });
    } catch (err) {
      setError(err?.message || 'Không tải được tài nguyên.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (item) => {
    if (uploading) return;
    setError('');
    const next = resources.filter((row) => row.id !== item.id);
    const exists = await lessonDocumentExists(programId, lessonId);
    if (!exists) {
      onChange(next);
      onSynced?.(next);
      return;
    }
    await commitResources(next, {
      successMessage: 'Đã gỡ file khỏi bài giảng. File trên Drive vẫn giữ làm bản sao.',
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Tài nguyên buổi</p>
        <p className="mt-0.5 text-xs text-slate-500">
          File starter cho học sinh tải về. Tối đa {MAX_LESSON_RESOURCES} file ·{' '}
          {LESSON_RESOURCE_EXTENSIONS.join(', ')} · {MAX_LESSON_RESOURCE_SIZE_MB}MB. File được ghi
          nhận ngay khi tải xong.
        </p>
      </div>

      {resources.length > 0 && (
        <ul className="space-y-2">
          {resources.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {item.title || item.fileName}
                </p>
                <p className="text-xs text-slate-500">
                  {item.fileName}
                  {item.size ? ` · ${formatUploadSize(item.size)}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={item.downloadUrl}
                  download={item.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-slate-800"
                  aria-label={`Tải ${item.fileName}`}
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-red-500/10"
                  aria-label={`Xóa ${item.fileName} khỏi bài`}
                  disabled={uploading}
                  onClick={() => handleRemove(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={LESSON_RESOURCE_EXTENSIONS.join(',')}
        className="sr-only"
        disabled={uploading || !canAdd}
        onChange={(event) => handleFiles(event.target.files?.[0])}
      />

      {canAdd ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {uploading ? `Đang tải ${progress}%` : 'Thêm file'}
        </Button>
      ) : (
        <p className="text-xs text-slate-500">Đã đủ {MAX_LESSON_RESOURCES} file cho buổi này.</p>
      )}

      {error ? (
        <p className="text-xs font-medium text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
