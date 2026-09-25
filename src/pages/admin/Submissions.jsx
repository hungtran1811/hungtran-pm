import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, FolderOpen, RefreshCw, Upload } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { Field, Input, Select } from '../../ui/components/Field.jsx';
import { LoadingCatState, SelectClassPrompt } from '../../ui/components/WaitingCatIllustration.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { FEATURE_DRIVE_SUBMISSION_ENABLED } from '../../config/features.js';
import { loadAdminClasses } from '../../lib/adminPanelData.js';
import { formatDateTime, getErrorMessage } from '../../lib/firestore.js';
import {
  driveFileViewUrl,
  driveFolderUrl,
  filterAdminSubmissions,
  uniqueLessonKeys,
} from '../../lib/submissionAdmin.js';
import { formatUploadSize } from '../../lib/submissionValidate.js';
import { formatLessonKey } from '../../lib/submissionFileName.js';
import { listCurriculumPrograms } from '../../services/curriculum.service.js';
import { listSubmissionsByClass } from '../../services/submissions.service.js';

const driveLinkClass =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300';

export function SubmissionsPage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const [classes, setClasses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [rows, setRows] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lessonKey, setLessonKey] = useState('');
  const [latestOnly, setLatestOnly] = useState(true);
  const [search, setSearch] = useState('');

  const selectedClassDoc = useMemo(
    () => classes.find((item) => item.classCode === selectedClass) ?? null,
    [classes, selectedClass],
  );

  useEffect(() => {
    loadAdminClasses()
      .then((list) => {
        setClasses(list);
        setLoadingClasses(false);
      })
      .catch((error) => {
        toastRef.current.error(getErrorMessage(error));
        setLoadingClasses(false);
      });
  }, []);

  useEffect(() => {
    listCurriculumPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, []);

  const loadRows = useCallback(async (classCode) => {
    if (!classCode) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const list = await listSubmissionsByClass(classCode);
      setRows(list);
    } catch (error) {
      toastRef.current.error(getErrorMessage(error));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedClass) {
      setRows([]);
      setLessonKey('');
      return;
    }
    let cancelled = false;
    setLessonKey('');
    setRows([]);
    setLoading(true);
    listSubmissionsByClass(selectedClass)
      .then((list) => {
        if (!cancelled) setRows(list);
      })
      .catch((error) => {
        if (!cancelled) {
          toastRef.current.error(getErrorMessage(error));
          setRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  const lessonOptions = useMemo(() => uniqueLessonKeys(rows), [rows]);
  const visible = useMemo(
    () => filterAdminSubmissions(rows, { lessonKey, latestOnly, search }),
    [rows, lessonKey, latestOnly, search],
  );
  const latestCount = rows.filter((row) => row.isLatest).length;
  const studentCount = new Set(rows.filter((row) => row.isLatest).map((row) => row.studentId)).size;
  const classFolderUrl = driveFolderUrl(selectedClassDoc?.driveFolderId);

  if (!FEATURE_DRIVE_SUBMISSION_ENABLED) {
    return (
      <AppShell title="Bài nộp Drive">
        <EmptyState
          icon={<Upload className="h-7 w-7" />}
          title="Chức năng nộp bài đang tắt"
          description="Bật FEATURE_DRIVE_SUBMISSION_ENABLED để xem bài nộp."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Bài nộp Drive"
      actions={
        selectedClass ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => loadRows(selectedClass)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Làm mới
          </Button>
        ) : null
      }
    >
      <div className="space-y-5">
        {loadingClasses ? (
          <LoadingCatState message="Đang tải danh sách lớp..." />
        ) : classes.length === 0 ? (
          <EmptyState icon={<Upload className="h-7 w-7" />} title="Chưa có lớp" />
        ) : (
          <>
            <ClassFilterBar
              classes={classes}
              programs={programs}
              value={selectedClass}
              onChange={(code) => {
                setSelectedClass(code);
                setRows([]);
                setLessonKey('');
                setLoading(Boolean(code));
              }}
              showArchived={showArchived}
              onShowArchivedChange={(checked) => {
                setShowArchived(checked);
                setSelectedClass('');
                setRows([]);
                setLessonKey('');
                setLoading(false);
              }}
              autoSelectFirst={false}
              showStudentCount
            />

            {!selectedClass ? (
              <SelectClassPrompt
                title="Chọn lớp để xem bài nộp"
                description="Học sinh không xem được danh sách này. File mở trên Drive của giáo viên."
              />
            ) : loading && !rows.length ? (
              <LoadingCatState message="Đang tải bài nộp..." />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge tone="brand">{studentCount} HS đã nộp</Badge>
                  <Badge tone="slate">{latestCount} bài mới nhất</Badge>
                  <Badge tone="slate">{rows.length} lần nộp</Badge>
                  {classFolderUrl ? (
                    <a
                      href={classFolderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Thư mục lớp trên Drive
                    </a>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Buổi">
                    <Select value={lessonKey} onChange={(event) => setLessonKey(event.target.value)}>
                      <option value="">Tất cả buổi</option>
                      {lessonOptions.map((key) => (
                        <option key={key} value={key}>
                          {key}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Tìm học sinh / file">
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Tên học sinh hoặc tên file"
                    />
                  </Field>
                  <label className="flex items-end gap-2 pb-2 text-sm text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300"
                      checked={latestOnly}
                      onChange={(event) => setLatestOnly(event.target.checked)}
                    />
                    Chỉ bản mới nhất
                  </label>
                </div>

                {!visible.length ? (
                  <EmptyState
                    icon={<Upload className="h-7 w-7" />}
                    title="Chưa có bài nộp"
                    description={
                      rows.length
                        ? 'Không khớp bộ lọc hiện tại.'
                        : 'Học sinh chưa nộp file cho lớp này.'
                    }
                  />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                    <div className="hidden grid-cols-[minmax(8rem,1.2fr)_4.5rem_minmax(8rem,1.4fr)_7rem_5.5rem_7rem] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500 md:grid dark:border-slate-700 dark:bg-slate-800/50">
                      <span>Học sinh</span>
                      <span>Buổi</span>
                      <span>File</span>
                      <span>Thời gian</span>
                      <span>Lần nộp</span>
                      <span className="text-right">Drive</span>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                      {visible.map((row) => {
                        const fileUrl = driveFileViewUrl(row.driveFileId);
                        const folderUrl = driveFolderUrl(row.driveFolderId);
                        return (
                          <li
                            key={row.id}
                            className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(8rem,1.2fr)_4.5rem_minmax(8rem,1.4fr)_7rem_5.5rem_7rem] md:items-center md:gap-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-800 dark:text-slate-100">
                                {row.studentName}
                              </p>
                              <p className="text-xs text-slate-500 md:hidden">{formatLessonKey(row.lessonKey)}</p>
                            </div>
                            <p className="hidden text-sm text-slate-600 md:block dark:text-slate-300">
                              {formatLessonKey(row.lessonKey)}
                            </p>
                            <div className="min-w-0">
                              <p className="truncate text-sm text-slate-700 dark:text-slate-200">
                                {row.originalFileName || row.storedFileName}
                              </p>
                              <p className="text-xs text-slate-500">{formatUploadSize(row.fileSize)}</p>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                              {formatDateTime(row.submittedAt)}
                            </p>
                            <div>
                              {row.isLatest ? (
                                <Badge tone="green">Mới nhất · {row.attempt}</Badge>
                              ) : (
                                <Badge tone="slate">Lần {row.attempt}</Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                              {fileUrl ? (
                                <a
                                  href={fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={driveLinkClass}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Mở file
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">Thiếu mã file</span>
                              )}
                              {folderUrl ? (
                                <a
                                  href={folderUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-10 items-center text-xs font-medium text-slate-500 hover:text-brand-700 dark:hover:text-brand-300"
                                >
                                  Thư mục
                                </a>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
