import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, FolderOpen, TrendingUp } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SelectClassPrompt, LoadingCatState } from '../../ui/components/WaitingCatIllustration.jsx';
import { ClassFilterBar } from '../../ui/components/ClassFilterBar.jsx';
import { Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { StudentHistoryModal } from '../../ui/components/StudentHistoryModal.jsx';
import { ClassCodeSubmissionsOverview } from '../../ui/components/ClassCodeSubmissionsOverview.jsx';
import { ClassCompletionRoster } from '../../ui/components/ClassCompletionRoster.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { ALL_CLASSES_VALUE, resolveScopedClasses } from '../../lib/classFilterScope.js';
import { invalidateAdminSnapshots, loadAdminClasses, loadReportsPanelSnapshot } from '../../lib/adminPanelData.js';
import { AdminSnapshotControls } from '../../ui/components/AdminSnapshotControls.jsx';
import { getErrorMessage } from '../../lib/firestore.js';
import { listCurriculumPrograms } from '../../services/curriculum.service.js';
import { reportFromStudentSnapshot } from '../../services/reports.service.js';
import {
  buildClassExport,
  copyToClipboard,
  formatProgressReport,
} from '../../utils/exportText.js';
import {
  listCodeSubmissionsByClass,
  summarizeCodeSubmissions,
} from '../../services/codeSubmissions.service.js';
import { FEATURE_CODE_UPLOAD_ENABLED, FEATURE_DRIVE_SUBMISSION_ENABLED } from '../../config/features.js';
import { deleteProgressReportsAsAdmin, listReportsByClass } from '../../services/reports.service.js';
import {
  deleteDriveSubmissionAsAdmin,
  deleteDriveSubmissionsAsAdmin,
  listSubmissionsByClass,
} from '../../services/submissions.service.js';
import {
  driveFolderUrl,
  summarizeDriveSubmissionsByStudent,
  uniqueLessonKeys,
} from '../../lib/submissionAdmin.js';
import {
  hasOverlappingLesson,
  latestReportForLesson,
  latestReportsByStudentLesson,
  reportsForStudentLesson,
  scopeDriveToLesson,
} from '../../lib/progressReports.js';
import { buildLessonOptions, defaultLessonKey } from '../../lib/submissionLessons.js';
import {
  classRequiresProgressAndProduct,
  findProgramForClass,
} from '../../lib/studentWorkspace.js';
import { sortByRecentActivity } from '../../lib/reportSignals.js';

function matchesCompletionFilter(item, filter) {
  if (filter === 'done') return item.isComplete;
  if (filter === 'missing') return !item.isComplete;
  return true;
}

function readCompletionFilter(params) {
  const value = params.get('filter');
  return value === 'missing' || value === 'done' ? value : 'all';
}

function shortLessonLabel(option) {
  if (option.sessionNumber) return String(option.sessionNumber);
  const match = String(option.value || '').match(/^B0*(\d+)$/i);
  return match ? match[1] : option.value;
}

function FilterChip({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-xl px-3 text-sm font-medium transition ${
        active
          ? 'bg-brand-600 text-white shadow-sm'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

export function ReportsPanel({
  selectedClass: selectedClassProp,
  onSelectedClassChange,
  showArchived: showArchivedProp,
  onShowArchivedChange,
  completionFilter: completionFilterProp,
  onCompletionFilterChange,
}) {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classes, setClasses] = useState([]);
  const [internalClass, setInternalClass] = useState('');
  const [internalArchived, setInternalArchived] = useState(false);
  const [latestByStudent, setLatestByStudent] = useState(() => new Map());
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [search, setSearch] = useState('');
  const [historyTarget, setHistoryTarget] = useState(null);
  const [codeByStudent, setCodeByStudent] = useState(() => new Map());
  const [programs, setPrograms] = useState([]);
  const [driveRows, setDriveRows] = useState([]);
  const [classReports, setClassReports] = useState([]);
  const [reviewLessonKey, setReviewLessonKey] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isControlled = selectedClassProp !== undefined;
  const selectedClass = isControlled ? selectedClassProp : internalClass;
  const setSelectedClass = onSelectedClassChange ?? setInternalClass;
  const showArchived = showArchivedProp ?? internalArchived;
  const setShowArchived = onShowArchivedChange ?? setInternalArchived;
  const completionFilter = completionFilterProp ?? readCompletionFilter(searchParams);

  const setCompletionFilter = (value) => {
    if (onCompletionFilterChange) {
      onCompletionFilterChange(value);
      return;
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === 'missing' || value === 'done') next.set('filter', value);
      else next.delete('filter');
      return next;
    }, { replace: true });
  };

  const scopedClasses = useMemo(
    () => resolveScopedClasses(classes, selectedClass, showArchived),
    [classes, selectedClass, showArchived],
  );
  const classCodes = useMemo(() => scopedClasses.map((c) => c.classCode), [scopedClasses]);
  const isAllClasses = selectedClass === ALL_CLASSES_VALUE;
  const selectedClassDoc = useMemo(
    () => classes.find((c) => c.classCode === selectedClass) ?? null,
    [classes, selectedClass],
  );
  const selectedProgram = useMemo(
    () => findProgramForClass(selectedClassDoc, programs),
    [selectedClassDoc, programs],
  );
  const requiresBoth = classRequiresProgressAndProduct(selectedClassDoc, selectedProgram);
  const classByCode = useMemo(() => {
    const map = new Map();
    for (const cls of classes) map.set(cls.classCode, cls);
    return map;
  }, [classes]);
  const hasAnyFinalProjectClass = useMemo(
    () =>
      scopedClasses.some((cls) =>
        classRequiresProgressAndProduct(cls, findProgramForClass(cls, programs)),
      ),
    [scopedClasses, programs],
  );
  const showReports = Boolean(selectedClass) && (isAllClasses ? hasAnyFinalProjectClass : requiresBoth);
  const showCodeOverview =
    FEATURE_CODE_UPLOAD_ENABLED &&
    !isAllClasses &&
    selectedClassDoc?.curriculumPhase === 'final' &&
    selectedClassDoc?.finalMode !== 'exam';

  const toggleArchived = (checked) => {
    setShowArchived(checked);
    if (!isControlled) setSelectedClass('');
  };

  useEffect(() => {
    loadAdminClasses()
      .then((list) => {
        setClasses(list);
        setLoadingClasses(false);
        if (isControlled) return;
        setSelectedClass((prev) => {
          const fromUrl = searchParams.get('class');
          if (fromUrl && (fromUrl === ALL_CLASSES_VALUE || list.some((c) => c.classCode === fromUrl))) {
            return fromUrl;
          }
          if (prev === ALL_CLASSES_VALUE) return prev;
          if (prev && list.some((c) => c.classCode === prev)) return prev;
          return '';
        });
      })
      .catch((error) => {
        toast.error(getErrorMessage(error));
        setLoadingClasses(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isControlled]);

  useEffect(() => {
    listCurriculumPrograms()
      .then(setPrograms)
      .catch(() => setPrograms([]));
  }, []);

  const showDriveOverview =
    FEATURE_DRIVE_SUBMISSION_ENABLED && Boolean(selectedClass) && !isAllClasses;

  const loadSnapshot = useCallback(
    async ({ force = false, initial = false } = {}) => {
      if (!classCodes.length) {
        setLatestByStudent(new Map());
        setStudents([]);
        setDriveRows([]);
        setClassReports([]);
        return;
      }
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const [data, drive, reports] = await Promise.all([
          loadReportsPanelSnapshot(classCodes, {
            force,
            includeLatestReports: !selectedClass || selectedClass === ALL_CLASSES_VALUE,
          }),
          FEATURE_DRIVE_SUBMISSION_ENABLED && selectedClass && selectedClass !== ALL_CLASSES_VALUE
            ? listSubmissionsByClass(selectedClass)
            : Promise.resolve([]),
          selectedClass && selectedClass !== ALL_CLASSES_VALUE
            ? listReportsByClass(selectedClass, 400)
            : Promise.resolve([]),
        ]);
        setStudents(data.students);
        setLatestByStudent(data.latestByStudent);
        setDriveRows(drive);
        setClassReports(reports);
        setLastLoadedAt(Date.now());
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [classCodes, selectedClass, toast],
  );

  useEffect(() => {
    loadSnapshot({ initial: true });
  }, [loadSnapshot]);

  useEffect(() => {
    setReviewLessonKey(
      selectedClass && selectedClass !== ALL_CLASSES_VALUE
        ? defaultLessonKey(selectedClassDoc, selectedProgram)
        : '',
    );
  }, [selectedClass, selectedClassDoc, selectedProgram]);

  useEffect(() => {
    if (!showCodeOverview || !selectedClass) {
      setCodeByStudent(new Map());
      return;
    }
    let cancelled = false;
    listCodeSubmissionsByClass(selectedClass)
      .then((rows) => {
        if (!cancelled) setCodeByStudent(summarizeCodeSubmissions(rows));
      })
      .catch((error) => {
        if (!cancelled) toast.error(getErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClass, showCodeOverview, toast]);

  const handleRefresh = () => {
    invalidateAdminSnapshots();
    loadSnapshot({ force: true });
    if (showCodeOverview && selectedClass) {
      listCodeSubmissionsByClass(selectedClass)
        .then((rows) => setCodeByStudent(summarizeCodeSubmissions(rows)))
        .catch((error) => toast.error(getErrorMessage(error)));
    }
  };

  const resolveReport = useCallback(
    (student) => latestByStudent.get(student.id) ?? reportFromStudentSnapshot(student),
    [latestByStudent],
  );

  const driveByStudent = useMemo(
    () => summarizeDriveSubmissionsByStudent(driveRows),
    [driveRows],
  );
  const reportsByStudentLesson = useMemo(
    () => latestReportsByStudentLesson(classReports),
    [classReports],
  );
  const reviewLessonOptions = useMemo(() => {
    const fromProgram = buildLessonOptions(selectedClassDoc, selectedProgram);
    const extra = uniqueLessonKeys([...driveRows, ...classReports]).filter(
      (key) => !fromProgram.some((option) => option.value === key),
    );
    return [...fromProgram, ...extra.map((value) => ({ value, label: value }))];
  }, [selectedClassDoc, selectedProgram, driveRows, classReports]);
  const scanned = useMemo(() => {
    let list = students.map((student) => {
      const fallbackReport = resolveReport(student);
      const allDrive = driveByStudent.get(student.id) || null;
      const lessons = reportsByStudentLesson.get(student.id);

      const lessonReports = reportsForStudentLesson(classReports, student.id, reviewLessonKey)
        .slice()
        .sort((left, right) => (right.submittedAt?.getTime?.() || 0) - (left.submittedAt?.getTime?.() || 0));
      const reportCount = lessonReports.length;
      const history = {
        reportHistory: isAllClasses ? undefined : lessonReports,
        driveHistory: isAllClasses ? null : allDrive,
      };

      if (isAllClasses) {
        const hasReport = Boolean(fallbackReport) || Boolean(student.lastReportedAt);
        return {
          student,
          report: fallbackReport,
          drive: null,
          hasReport,
          hasFile: false,
          isComplete: hasReport,
          reportCount,
          showClass: true,
          ...history,
        };
      }

      if (requiresBoth) {
        const report = latestReportForLesson(lessons, reviewLessonKey) || (!reviewLessonKey ? fallbackReport : null);
        const drive = scopeDriveToLesson(allDrive, reviewLessonKey);
        const hasReport = Boolean(latestReportForLesson(lessons, reviewLessonKey));
        const hasFile = Boolean(drive);
        const isComplete = reviewLessonKey
          ? hasReport && hasFile
          : hasOverlappingLesson(lessons, allDrive);
        return {
          student,
          report,
          drive,
          hasReport,
          hasFile,
          isComplete,
          reportCount,
          showClass: false,
          ...history,
        };
      }

      const drive = scopeDriveToLesson(allDrive, reviewLessonKey);
      const hasFile = Boolean(drive);
      return {
        student,
        report: fallbackReport,
        drive,
        hasReport: Boolean(student.lastReportedAt),
        hasFile,
        isComplete: hasFile,
        reportCount,
        showClass: false,
        ...history,
      };
    });

    if (isAllClasses) {
      list = list.filter((item) => {
        const cls = classByCode.get(item.student.classCode);
        return classRequiresProgressAndProduct(cls, findProgramForClass(cls, programs));
      });
    }

    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((item) => item.student.fullName.toLowerCase().includes(query));
    }

    return sortByRecentActivity(list);
  }, [
    students,
    resolveReport,
    search,
    isAllClasses,
    driveByStudent,
    classByCode,
    programs,
    requiresBoth,
    reportsByStudentLesson,
    reviewLessonKey,
    classReports,
  ]);

  const visible = useMemo(
    () => scanned.filter((item) => matchesCompletionFilter(item, completionFilter)),
    [scanned, completionFilter],
  );

  const reportsForCopy = useMemo(
    () => scanned
      .filter((item) => item.report && !item.report.snapshotOnly)
      .map((item) => ({ report: item.report, displayName: item.student.fullName })),
    [scanned],
  );

  const completeCount = useMemo(
    () => scanned.filter((item) => item.isComplete).length,
    [scanned],
  );
  const missingCount = scanned.length - completeCount;
  const completePercent = scanned.length ? Math.round((completeCount / scanned.length) * 100) : 0;
  const currentLessonKey = selectedClassDoc
    ? defaultLessonKey(selectedClassDoc, selectedProgram)
    : '';
  const classFolderHref = driveFolderUrl(selectedClassDoc?.driveFolderId);
  const doneLabel = requiresBoth || isAllClasses ? 'đủ' : 'đã nộp';

  const openHistory = (student, report) => {
    setHistoryTarget({
      id: student.id,
      fullName: student.fullName,
      classId: student.classId || student.classCode || selectedClass,
      classCode: student.classCode || student.classId || selectedClass,
      currentProgressPercent: report?.progressPercent ?? student.currentProgressPercent,
      projectGithubUrl: student.projectGithubUrl,
      projectCanvaUrl: student.projectCanvaUrl,
    });
  };

  const copyAll = async () => {
    if (!reportsForCopy.length) return;
    const lessonSuffix = reviewLessonKey ? ` · Buổi ${reviewLessonKey}` : '';
    const header = isAllClasses
      ? `BÁO CÁO TIẾN ĐỘ - TẤT CẢ LỚP${lessonSuffix}`
      : (() => {
          const cls = classes.find((c) => c.classCode === selectedClass);
          return `BÁO CÁO TIẾN ĐỘ - ${selectedClass}${cls?.className ? ` (${cls.className})` : ''}${lessonSuffix}`;
        })();
    const text = buildClassExport(
      header,
      reportsForCopy,
      (item) => formatProgressReport(item.report, { displayName: item.displayName }),
    );
    try {
      await copyToClipboard(text);
      toast.success(`Đã sao chép ${reportsForCopy.length} báo cáo.`);
    } catch {
      toast.error('Không sao chép được.');
    }
  };

  const canDeleteRecords = Boolean(selectedClass) && !isAllClasses;

  const deleteTitle = pendingDelete?.type === 'file'
    ? 'Xóa file nộp'
    : pendingDelete?.type === 'report'
      ? 'Xóa báo cáo'
      : 'Xóa bản ghi buổi này';

  const deleteMessage = pendingDelete?.type === 'file'
    ? `Xóa bản ghi file "${pendingDelete.file?.originalFileName || 'này'}" của ${pendingDelete.item?.student?.fullName}? File trên Drive vẫn còn trong thư mục lớp.`
    : pendingDelete?.type === 'report'
      ? `Xóa báo cáo mới nhất của ${pendingDelete.item?.student?.fullName}? Học sinh có thể gửi lại bản khác.`
      : `Xóa toàn bộ file và báo cáo buổi ${reviewLessonKey} của ${pendingDelete?.item?.student?.fullName}? File trên Drive vẫn còn.`;

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.type === 'file') {
        await deleteDriveSubmissionAsAdmin(
          pendingDelete.file,
          pendingDelete.item.driveHistory?.files || pendingDelete.item.drive?.files || [],
        );
      } else if (pendingDelete.type === 'report') {
        await deleteProgressReportsAsAdmin([pendingDelete.report], {
          student: pendingDelete.item.student,
          remainingReports: classReports,
        });
      } else if (pendingDelete.type === 'lesson') {
        const files = pendingDelete.item.drive?.files || [];
        const reports = reportsForStudentLesson(
          classReports,
          pendingDelete.item.student.id,
          reviewLessonKey,
        );
        if (files.length) await deleteDriveSubmissionsAsAdmin(files);
        if (reports.length) {
          await deleteProgressReportsAsAdmin(reports, {
            student: pendingDelete.item.student,
            remainingReports: classReports,
          });
        }
      }
      toast.success('Đã xóa bản ghi.');
      setPendingDelete(null);
      invalidateAdminSnapshots();
      await loadSnapshot({ force: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {loadingClasses ? (
        <LoadingCatState message="Đang tải danh sách lớp..." />
      ) : classes.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-7 w-7" />} title="Chưa có lớp" />
      ) : (
        <>
          <div className="mb-4 space-y-3">
            <ClassFilterBar
              classes={classes}
              programs={programs}
              value={selectedClass}
              onChange={setSelectedClass}
              showArchived={showArchived}
              onShowArchivedChange={toggleArchived}
              allowAll
              autoSelectFirst={false}
              allLabel={`Tất cả lớp${showArchived ? ' lưu trữ' : ' đang hoạt động'}`}
              showStudentCount
            />
            {selectedClass && !isAllClasses && reviewLessonOptions.length ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">Buổi</p>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Chọn buổi">
                  <FilterChip
                    active={!reviewLessonKey}
                    onClick={() => setReviewLessonKey('')}
                  >
                    Tất cả
                  </FilterChip>
                  {reviewLessonOptions.map((option) => (
                    <FilterChip
                      key={option.value}
                      active={reviewLessonKey === option.value}
                      title={option.label}
                      onClick={() => setReviewLessonKey(option.value)}
                    >
                      <span className="tabular-nums">{shortLessonLabel(option)}</span>
                      {option.value === currentLessonKey ? (
                        <span
                          className="ml-1 h-1.5 w-1.5 rounded-full bg-current opacity-80"
                          aria-label="Buổi hiện tại"
                        />
                      ) : null}
                    </FilterChip>
                  ))}
                </div>
              </div>
            ) : null}
            {selectedClass ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lọc hoàn thành">
                  <FilterChip active={completionFilter === 'all'} onClick={() => setCompletionFilter('all')}>
                    Tất cả · {scanned.length}
                  </FilterChip>
                  <FilterChip
                    active={completionFilter === 'missing'}
                    onClick={() => setCompletionFilter('missing')}
                  >
                    Thiếu · {missingCount}
                  </FilterChip>
                  <FilterChip
                    active={completionFilter === 'done'}
                    onClick={() => setCompletionFilter('done')}
                  >
                    {requiresBoth || isAllClasses ? 'Đủ' : 'Đã nộp'} · {completeCount}
                  </FilterChip>
                </div>
                <Input
                  aria-label="Tìm học sinh"
                  placeholder="Tìm tên..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="sm:ml-auto sm:max-w-56"
                />
              </div>
            ) : null}
          </div>

          {!selectedClass ? (
            <SelectClassPrompt
              title="Chọn lớp để xem báo cáo hoặc bài nộp"
              description="Lớp sản phẩm cuối khóa hiện báo cáo tiến độ và file Drive. Lớp đang học kiến thức chỉ hiện file nộp."
            />
          ) : isAllClasses && !showReports ? (
            <EmptyState
              title="Không có lớp sản phẩm cuối khóa"
              description="Các lớp đang lọc là giai đoạn học kiến thức — không bắt buộc báo cáo tiến độ. Chọn một lớp để xem file nộp."
            />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <div className="min-w-[12rem] flex-1">
                  <div
                    className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={scanned.length}
                    aria-valuenow={completeCount}
                    aria-label={`Học sinh ${doneLabel}`}
                  >
                    <div
                      className={`h-full rounded-full ${
                        completeCount === scanned.length && scanned.length
                          ? 'bg-emerald-500'
                          : 'bg-brand-500'
                      }`}
                      style={{ width: `${completePercent}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {completeCount}/{scanned.length}
                    </span>{' '}
                    {doneLabel}
                    {missingCount > 0 ? (
                      <span className="text-amber-700 dark:text-amber-300">
                        {' '}
                        · {missingCount} thiếu
                      </span>
                    ) : scanned.length ? (
                      <span className="text-emerald-700 dark:text-emerald-300"> · đủ hết</span>
                    ) : null}
                  </p>
                </div>
                {classFolderHref ? (
                  <a
                    href={classFolderHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Thư mục Drive
                  </a>
                ) : null}
                {showReports ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={copyAll}
                    disabled={!reportsForCopy.length}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                    Copy cả lớp
                  </Button>
                ) : null}
              </div>

              <AdminSnapshotControls
                lastLoadedAt={lastLoadedAt}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                className="mb-3"
              />

              {loading ? (
                <LoadingCatState
                  message={showReports ? 'Đang tải báo cáo học sinh...' : 'Đang tải bài nộp...'}
                />
              ) : visible.length === 0 ? (
                <EmptyState
                  title={
                    search.trim() || completionFilter !== 'all'
                      ? 'Không có học sinh khớp bộ lọc'
                      : 'Chưa có học sinh'
                  }
                />
              ) : (
                <>
                  <ClassCompletionRoster
                    items={visible}
                    showDrive={showDriveOverview}
                    showReport={showReports}
                    lessonKey={reviewLessonKey}
                    canDelete={canDeleteRecords}
                    onDeleteFile={(item, file) => setPendingDelete({ type: 'file', item, file })}
                    onDeleteReport={(item, report) => setPendingDelete({ type: 'report', item, report })}
                    onDeleteLesson={(item) => setPendingDelete({ type: 'lesson', item })}
                  />
                  {showCodeOverview && (
                    <div className="mt-4">
                      <ClassCodeSubmissionsOverview
                        codeByStudent={codeByStudent}
                        students={visible.map(({ student }) => student)}
                        onSelectStudent={(student) => openHistory(student, resolveReport(student))}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}

      {historyTarget && (
        <StudentHistoryModal student={historyTarget} onClose={() => setHistoryTarget(null)} />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={deleteTitle}
        message={deleteMessage}
        confirmLabel="Xóa bản ghi"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => !deleting && setPendingDelete(null)}
      />
    </>
  );
}
