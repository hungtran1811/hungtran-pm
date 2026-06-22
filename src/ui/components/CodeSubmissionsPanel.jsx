import { useState } from 'react';
import { Download, Eye, FileCode2 } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { useToast } from './Toast.jsx';
import { downloadCodeSubmissionFile, fetchCodeFileContent } from '../../lib/codeSubmissionDownload.js';
import { getErrorMessage } from '../../lib/firestore.js';

function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  return `${Math.round(n / 1024)} KB`;
}

export function CodeSubmissionsPanel({
  submissions = [],
  classCode,
  studentId,
  emptyMessage = 'Học sinh chưa nộp file code nào.',
}) {
  const toast = useToast();
  const [openSession, setOpenSession] = useState(() => String(submissions.at(-1)?.sessionNumber ?? ''));
  const [downloadingId, setDownloadingId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoadingId, setPreviewLoadingId] = useState(null);

  const totalFiles = submissions.reduce((sum, row) => sum + (row.files?.length ?? 0), 0);

  const handleDownload = async (submission, file) => {
    const key = `${submission.sessionNumber}-${file.id}`;
    const resolvedClassCode = classCode || submission.classCode;
    setDownloadingId(key);
    try {
      await downloadCodeSubmissionFile({
        classCode: resolvedClassCode,
        studentId,
        sessionNumber: submission.sessionNumber,
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

  const handlePreview = async (submission, file) => {
    const key = `${submission.sessionNumber}-${file.id}`;
    const resolvedClassCode = classCode || submission.classCode;
    setPreviewLoadingId(key);
    try {
      const content = await fetchCodeFileContent(
        resolvedClassCode,
        studentId,
        submission.sessionNumber,
        file.id,
      );
      if (content == null) {
        toast.error('Không tìm thấy nội dung file.');
        return;
      }
      setPreview({ name: file.name, content });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setPreviewLoadingId(null);
    }
  };

  if (!submissions.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center dark:border-slate-700">
        <FileCode2 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">File code theo buổi</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {submissions.length} buổi · {totalFiles} file
          </p>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {submissions.map((submission) => {
            const key = String(submission.sessionNumber);
            const expanded = openSession === key;
            return (
              <div key={submission.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  onClick={() => setOpenSession(expanded ? '' : key)}
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Buổi {submission.sessionNumber}
                  </span>
                  <span className="text-xs text-slate-500">{submission.files.length} file</span>
                </button>
                {expanded && (
                  <ul className="space-y-2 px-4 pb-3">
                    {submission.files.map((file) => {
                      const actionKey = `${submission.sessionNumber}-${file.id}`;
                      return (
                        <li
                          key={file.id}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
                        >
                          <FileCode2 className="h-4 w-4 shrink-0 text-slate-400" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-800 dark:text-slate-100">{file.name}</p>
                            <p className="text-xs text-slate-500">{formatFileSize(file.sizeBytes)}</p>
                          </div>
                          <button
                            type="button"
                            disabled={previewLoadingId === actionKey || downloadingId === actionKey}
                            onClick={() => handlePreview(submission, file)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="Xem nội dung"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {previewLoadingId === actionKey ? '…' : 'Xem'}
                          </button>
                          <button
                            type="button"
                            disabled={downloadingId === actionKey || previewLoadingId === actionKey}
                            onClick={() => handleDownload(submission, file)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {downloadingId === actionKey ? '…' : 'Tải'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name || 'Xem file'} size="lg">
        <pre className="max-h-[60vh] overflow-auto rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {preview?.content}
        </pre>
      </Modal>
    </>
  );
}
