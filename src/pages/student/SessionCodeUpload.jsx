import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileCode2, Trash2, Upload } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Select } from '../../ui/components/Field.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import {
  CODE_SUBMISSION_EXTENSIONS,
  CODE_SUBMISSION_MAX_FILES_PER_SESSION,
  validateCodeSubmissionFile,
} from '../../lib/codeSubmissionLimits.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { isProjectNameApproved } from '../../lib/classFinalMode.js';
import { downloadCodeSubmissionFile } from '../../lib/codeSubmissionDownload.js';
import { sessionNumbersUpToCurrent } from '../../lib/sessionScope.js';
import {
  deleteCodeFile,
  subscribeCodeSubmissionsByStudent,
  uploadCodeFile,
} from '../../services/codeSubmissions.service.js';

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  return `${Math.round(n / 1024)} KB`;
}

export function SessionCodeUpload({ classDoc, student, compact = false }) {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const classCode = classDoc?.id || student.classId;
  const sessionOptions = useMemo(() => sessionNumbersUpToCurrent(classDoc), [classDoc]);
  const [sessionNumber, setSessionNumber] = useState(() => sessionOptions.at(-1) ?? 1);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    if (sessionOptions.length && !sessionOptions.includes(sessionNumber)) {
      setSessionNumber(sessionOptions.at(-1));
    }
  }, [sessionOptions, sessionNumber]);

  useEffect(() => {
    if (!classCode || !student?.id) {
      setSubmissions([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const unsub = subscribeCodeSubmissionsByStudent(
      classCode,
      student.id,
      (rows) => {
        setSubmissions(rows);
        setLoading(false);
      },
      (error) => {
        toast.error(getErrorMessage(error));
        setLoading(false);
      },
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classCode, student?.id]);

  const currentSubmission = submissions.find((s) => Number(s.sessionNumber) === Number(sessionNumber));
  const files = currentSubmission?.files ?? [];
  const accept = CODE_SUBMISSION_EXTENSIONS.join(',');

  const handleUpload = async (event) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (!picked.length) return;

    if (classDoc?.curriculumPhase !== 'final') {
      toast.error('Lớp chưa vào giai đoạn sản phẩm cuối khóa — chưa thể nộp file.');
      return;
    }
    if (!isProjectNameApproved(student)) {
      toast.error('Tên dự án chưa được duyệt — chưa thể nộp file code.');
      return;
    }

    const remaining = CODE_SUBMISSION_MAX_FILES_PER_SESSION - files.length;
    if (remaining <= 0) {
      toast.error(`Tối đa ${CODE_SUBMISSION_MAX_FILES_PER_SESSION} file mỗi buổi.`);
      return;
    }
    const batch = picked.slice(0, remaining);
    if (picked.length > batch.length) {
      toast.error(`Chỉ thêm được ${remaining} file nữa cho buổi này.`);
    }

    setUploading(true);
    let uploaded = 0;
    try {
      for (const file of batch) {
        const validation = validateCodeSubmissionFile(file);
        if (validation.error) {
          toast.error(`${file.name}: ${validation.error}`);
          continue;
        }
        await uploadCodeFile({
          classCode,
          studentId: student.id,
          studentName: student.fullName,
          sessionNumber,
          file,
        });
        uploaded += 1;
      }
      if (uploaded) toast.success(`Đã nộp ${uploaded} file.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    setDeletingId(fileId);
    try {
      await deleteCodeFile({ classCode, studentId: student.id, sessionNumber, fileId });
      toast.success('Đã xóa file.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (file) => {
    setDownloadingId(file.id);
    try {
      await downloadCodeSubmissionFile({
        classCode,
        studentId: student.id,
        sessionNumber,
        fileId: file.id,
        fileName: file.name,
        contentType: file.contentType,
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  };

  if (!sessionOptions.length) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có buổi học nào được mở để nộp file.</p>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'card space-y-4 p-5'}>
      {!compact && (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <FileCode2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Nộp file code theo buổi</h3>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              Tải lên mã nguồn buổi học ({CODE_SUBMISSION_EXTENSIONS.join(', ')}). Tối đa{' '}
              {CODE_SUBMISSION_MAX_FILES_PER_SESSION} file, 512 KB/file.
            </p>
          </div>
        </div>
      )}

      {compact && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {CODE_SUBMISSION_EXTENSIONS.join(', ')} · tối đa {CODE_SUBMISSION_MAX_FILES_PER_SESSION} file, 512 KB/file
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[8rem] flex-1 sm:flex-none">
          <Field label="Buổi học">
            <Select
              value={sessionNumber}
              onChange={(e) => setSessionNumber(Number(e.target.value))}
              disabled={uploading}
            >
              {sessionOptions.map((n) => (
                <option key={n} value={n}>
                  Buổi {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={handleUpload}
        />

        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          loading={uploading}
          disabled={files.length >= CODE_SUBMISSION_MAX_FILES_PER_SESSION}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Chọn file
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : files.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có file nào cho buổi {sessionNumber}.</p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
          {files.map((file) => (
            <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileCode2 className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{file.name}</p>
                <p className="text-xs text-slate-500">{formatFileSize(file.sizeBytes)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-slate-500 hover:text-brand-600 dark:hover:text-brand-300"
                loading={downloadingId === file.id}
                disabled={
                  uploading ||
                  (downloadingId != null && downloadingId !== file.id) ||
                  (deletingId != null && deletingId !== file.id)
                }
                onClick={() => handleDownload(file)}
                title="Tải xuống"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400"
                loading={deletingId === file.id}
                disabled={uploading || (deletingId != null && deletingId !== file.id)}
                onClick={() => handleDelete(file.id)}
                title="Xóa file"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
