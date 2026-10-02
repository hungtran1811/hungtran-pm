import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { listMyDriveSubmissions, submitDriveFiles } from '../../services/driveSubmission.service.js';
import { upsertStudentSubmissionNote } from '../../lib/submissionStudentNotes.js';
import { lessonKeysEqual } from '../../lib/submissionFileName.js';
import { validateSubmissionFiles } from '../../lib/submissionValidate.js';
import { MAX_FILES_PER_SUBMIT } from '../../config/submissionConfig.js';
import { buildLessonOptions, buildStudentLessonOptions, defaultLessonKey } from '../../lib/submissionLessons.js';
import { FileDropzone } from './submission/FileDropzone.jsx';
import { UploadProgress } from './submission/UploadProgress.jsx';
import { SubmissionSuccess } from './submission/SubmissionSuccess.jsx';
import { SelectedLessonNote, StudentSubmissionNotes } from './submission/StudentSubmissionNotes.jsx';
import { classRequiresProgressAndProduct } from '../../lib/studentWorkspace.js';
import { GUIDE_SECTIONS } from './ProjectSubmissionGuide.jsx';

const BUSY_STATES = new Set(['validating', 'creating_session', 'uploading', 'saving']);

export function DriveSubmitPage({
  embedded = false,
  lessonKey: lessonKeyProp,
  onLessonKeyChange,
  hideLessonSelect = false,
  onOpenGuide,
} = {}) {
  const { classCode, classDoc, program, student } = useOutletContext();
  const toast = useToast();
  const catalogOptions = useMemo(() => buildLessonOptions(classDoc, program), [classDoc, program]);
  const lessonOptions = useMemo(() => buildStudentLessonOptions(classDoc, program), [classDoc, program]);
  const [internalLessonKey, setInternalLessonKey] = useState(() => defaultLessonKey(classDoc, program));
  const lessonKey = lessonKeyProp ?? internalLessonKey;
  const setLessonKey = (next) => {
    const value = typeof next === 'function' ? next(lessonKey) : next;
    if (lessonKeyProp === undefined) setInternalLessonKey(value);
    onLessonKeyChange?.(value);
  };
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ percent: 0, loaded: 0, total: 0 });
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notesError, setNotesError] = useState('');
  const uploadingRef = useRef(false);

  const loadNotes = useCallback(() => {
    if (!classCode || !student?.id || !student?.fullName) return;
    listMyDriveSubmissions({
      classCode,
      studentId: student.id,
      studentName: student.fullName,
    })
      .then((rows) => {
        setNotes(rows);
        setNotesError('');
      })
      .catch((err) => {
        setNotesError(err?.message || 'Không tải được bài đã nộp.');
      });
  }, [classCode, student?.id, student?.fullName]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    setLessonKey((prev) => {
      if (lessonOptions.some((option) => option.value === prev)) return prev;
      return defaultLessonKey(classDoc, program);
    });
  }, [lessonOptions, classDoc, program]);

  const busy = BUSY_STATES.has(status);
  const selectedLesson = lessonOptions.find((item) => item.value === lessonKey);
  const classLabel = classDoc?.className || classCode;
  const requiresBoth = classRequiresProgressAndProduct(classDoc, program);
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);

  const resetForm = () => {
    setFiles([]);
    setFileError('');
    setStatus('idle');
    setProgress({ percent: 0, loaded: 0, total: 0 });
    setError('');
    setResult(null);
    loadNotes();
  };

  const handleFilesChange = (next, meta = {}) => {
    setFiles(next);
    setError('');
    if (meta.overflow) {
      setFileError(`Mỗi lần nộp tối đa ${MAX_FILES_PER_SUBMIT} file.`);
      return;
    }
    if (meta.duplicate) {
      setFileError('Không nộp hai file trùng tên.');
      return;
    }
    if (!next.length) {
      setFileError('');
      return;
    }
    const check = validateSubmissionFiles(next);
    setFileError(check.ok ? '' : check.error);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy || uploadingRef.current || !lessonOptions.length || !lessonKey) return;

    const check = validateSubmissionFiles(files);
    if (!check.ok) {
      setFileError(check.error);
      setStatus('error');
      setError(check.error);
      return;
    }

    setFileError('');
    setError('');
    setStatus('validating');
    setProgress({ percent: 0, loaded: 0, total: totalBytes });
    uploadingRef.current = true;

    try {
      const submitted = await submitDriveFiles({
        classCode,
        studentId: student.id,
        studentName: student.fullName,
        lessonKey,
        files,
        onStatus: setStatus,
        onProgress: (percent, loaded, total) => {
          setProgress({ percent, loaded, total });
        },
      });
      setResult(submitted);
      setStatus('success');
      const originalFileNames =
        submitted.files?.map((item) => item.originalFileName).filter(Boolean) ||
        files.map((file) => file.name);
      setNotes((prev) =>
        upsertStudentSubmissionNote(prev, {
          lessonKey,
          originalFileName: submitted.originalFileName || originalFileNames[0],
          originalFileNames,
          submittedAt: submitted.submittedAt,
          attempt: submitted.attempt,
        }),
      );
      toast.success(originalFileNames.length > 1 ? `Đã nộp ${originalFileNames.length} file.` : 'Đã nộp bài.');
    } catch (err) {
      const message = err?.message || 'Không nộp được bài. Thử lại.';
      setError(message);
      setStatus('error');
      toast.error(message);
    } finally {
      uploadingRef.current = false;
    }
  };

  if (status === 'success' && result) {
    const storedFileNames =
      result.files?.map((item) => item.storedFileName || item.originalFileName).filter(Boolean) ||
      (result.storedFileName ? [result.storedFileName] : []);
    return (
      <div className={embedded ? '' : 'mx-auto max-w-lg'}>
        <SubmissionSuccess
          studentName={student.fullName}
          classCode={classLabel}
          lessonLabel={selectedLesson?.label || lessonKey}
          storedFileName={result.storedFileName}
          storedFileNames={storedFileNames}
          submittedAt={result.submittedAt}
          requiresReport={requiresBoth && !embedded}
          samePageReport={embedded && requiresBoth}
          onAgain={resetForm}
        />
        {embedded ? null : (
          <div className="mt-5">
            <StudentSubmissionNotes notes={notes} lessonOptions={catalogOptions} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'mx-auto max-w-lg'}>
      {embedded ? null : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Nộp bài
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-50">Gửi file buổi này</h2>
        </>
      )}

      <form className={embedded ? 'space-y-4' : 'card mt-4 space-y-4 p-5'} onSubmit={handleSubmit}>
        {hideLessonSelect ? (
          lessonOptions.length ? null : (
            <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              Giáo viên chưa đặt buổi hiện tại cho lớp. Hỏi giáo viên trước khi nộp.
            </p>
          )
        ) : lessonOptions.length ? (
          <Field label="Buổi" required>
            <Select
              value={lessonKey}
              disabled={busy}
              onChange={(event) => setLessonKey(event.target.value)}
            >
              {lessonOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                  {notes.some((note) => lessonKeysEqual(note.lessonKey, option.value)) ? ' · đã nộp' : ''}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Giáo viên chưa đặt buổi hiện tại cho lớp. Hỏi giáo viên trước khi nộp.
          </p>
        )}
        <SelectedLessonNote notes={notes} lessonKey={lessonKey} />

        <Field
          label="File sản phẩm"
          required
          error={fileError}
          hint={
            onOpenGuide ? (
              <button
                type="button"
                className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                onClick={() => onOpenGuide(GUIDE_SECTIONS.zip)}
              >
                Cách nén ZIP · Tên_dự_án - Lesson_
              </button>
            ) : (
              `Tối đa ${MAX_FILES_PER_SUBMIT} file. Thư mục lớn: chuột phải → Compress to → ZIP file, đặt tên Tên_dự_án - Lesson_số buổi.`
            )
          }
        >
          <FileDropzone files={files} disabled={busy} onFilesChange={handleFilesChange} />
        </Field>

        {status === 'uploading' ? <UploadProgress percent={progress.percent} /> : null}

        {status === 'error' && error ? (
          <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="submit"
            size="lg"
            className="min-h-12 flex-1"
            loading={busy}
            disabled={!files.length || !lessonOptions.length}
          >
            {status === 'error' ? 'Thử lại' : files.length > 1 ? `Nộp ${files.length} file` : 'Nộp bài'}
          </Button>
        </div>
      </form>

      <div className="mt-5">
        {notesError ? (
          <p className="mb-3 text-sm text-amber-800 dark:text-amber-200" role="status">
            {notesError}
          </p>
        ) : null}
        <StudentSubmissionNotes notes={notes} lessonOptions={catalogOptions} />
      </div>
    </div>
  );
}
