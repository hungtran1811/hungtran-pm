import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Select } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { listMyDriveSubmissions, submitDriveFile } from '../../services/driveSubmission.service.js';
import { upsertStudentSubmissionNote } from '../../lib/submissionStudentNotes.js';
import { lessonKeysEqual } from '../../lib/submissionFileName.js';
import { validateSubmissionFile } from '../../lib/submissionValidate.js';
import { buildLessonOptions, buildStudentLessonOptions, defaultLessonKey } from '../../lib/submissionLessons.js';
import { FileDropzone } from './submission/FileDropzone.jsx';
import { UploadProgress } from './submission/UploadProgress.jsx';
import { SubmissionSuccess } from './submission/SubmissionSuccess.jsx';
import { SelectedLessonNote, StudentSubmissionNotes } from './submission/StudentSubmissionNotes.jsx';
import { classRequiresProgressAndProduct } from '../../lib/studentWorkspace.js';

const BUSY_STATES = new Set(['validating', 'creating_session', 'uploading', 'saving']);

export function DriveSubmitPage() {
  const { classCode, classDoc, program, student } = useOutletContext();
  const toast = useToast();
  const catalogOptions = useMemo(() => buildLessonOptions(classDoc, program), [classDoc, program]);
  const lessonOptions = useMemo(() => buildStudentLessonOptions(classDoc, program), [classDoc, program]);
  const [lessonKey, setLessonKey] = useState(() => defaultLessonKey(classDoc, program));
  const [file, setFile] = useState(null);
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

  const resetForm = () => {
    setFile(null);
    setFileError('');
    setStatus('idle');
    setProgress({ percent: 0, loaded: 0, total: 0 });
    setError('');
    setResult(null);
    loadNotes();
  };

  const handleFileChange = (next) => {
    setFile(next);
    setError('');
    if (!next) {
      setFileError('');
      return;
    }
    const check = validateSubmissionFile({
      fileName: next.name,
      fileSize: next.size,
      mimeType: next.type,
    });
    setFileError(check.ok ? '' : check.error);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (busy || uploadingRef.current || !lessonOptions.length || !lessonKey) return;

    const check = validateSubmissionFile({
      fileName: file?.name,
      fileSize: file?.size,
      mimeType: file?.type,
    });
    if (!check.ok) {
      setFileError(check.error);
      setStatus('error');
      setError(check.error);
      return;
    }

    setFileError('');
    setError('');
    setStatus('validating');
    setProgress({ percent: 0, loaded: 0, total: file.size });
    uploadingRef.current = true;

    try {
      const submitted = await submitDriveFile({
        classCode,
        studentId: student.id,
        studentName: student.fullName,
        lessonKey,
        file,
        onStatus: setStatus,
        onProgress: (percent, loaded, total) => {
          setProgress({ percent, loaded, total });
        },
      });
      setResult(submitted);
      setStatus('success');
      setNotes((prev) =>
        upsertStudentSubmissionNote(prev, {
          lessonKey,
          originalFileName: submitted.originalFileName || file.name,
          submittedAt: submitted.submittedAt,
          attempt: submitted.attempt,
        }),
      );
      toast.success('Đã nộp bài.');
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
    return (
      <div className="mx-auto max-w-lg">
        <SubmissionSuccess
          studentName={student.fullName}
          classCode={classLabel}
          lessonLabel={selectedLesson?.label || lessonKey}
          storedFileName={result.storedFileName}
          submittedAt={result.submittedAt}
          requiresReport={requiresBoth}
          onAgain={resetForm}
        />
        <div className="mt-5">
          <StudentSubmissionNotes notes={notes} lessonOptions={catalogOptions} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-50">Nộp bài</h2>
      <p className="mt-1 text-sm text-slate-500">
        {student.fullName} · {classLabel}
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        {lessonOptions.length ? (
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

        <Field label="File sản phẩm" required error={fileError}>
          <FileDropzone
            file={file}
            disabled={busy}
            onFileChange={handleFileChange}
          />
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
            disabled={!file || !lessonOptions.length}
          >
            {status === 'error' ? 'Thử lại' : 'Nộp bài'}
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
