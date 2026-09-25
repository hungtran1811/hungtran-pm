import { useEffect, useMemo, useState } from 'react';
import { CircleHelp, ClipboardList, GitBranch, Upload } from 'lucide-react';
import { ProgressReportView } from './ProgressReportView.jsx';
import { ProgressReportHistory } from './ProgressReportHistory.jsx';
import { GUIDE_SECTIONS, ProjectSubmissionGuide } from './ProjectSubmissionGuide.jsx';
import { ProductWaterfallPanel } from './ProductWaterfallPanel.jsx';
import { DriveSubmitPage } from './DriveSubmitPage.jsx';
import { ProjectExtrasPanel } from './ProjectExtrasPanel.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Field, Select } from '../../ui/components/Field.jsx';
import { ProjectSummaryDisclosure } from '../../ui/components/ProjectSummaryDisclosure.jsx';
import { FEATURE_DRIVE_SUBMISSION_ENABLED } from '../../config/features.js';
import { isProjectNameApproved } from '../../lib/classFinalMode.js';
import { STAGES } from '../../constants/index.js';
import { buildStudentLessonOptions, defaultLessonKey } from '../../lib/submissionLessons.js';

const FINAL_PROJECT_TABS = [
  { id: 'work', label: 'Báo cáo & nộp', icon: ClipboardList },
  { id: 'process', label: 'Quy trình', icon: GitBranch },
  { id: 'guide', label: 'Hướng dẫn', icon: CircleHelp },
];

export function FinalProjectStudentView({ classDoc, program, student, onOpenLessons, onUpdateStudent }) {
  const [activeTab, setActiveTab] = useState('work');
  const [guideSection, setGuideSection] = useState(GUIDE_SECTIONS.overview);
  const [reportStagePrefill, setReportStagePrefill] = useState(null);
  const lessonOptions = useMemo(() => buildStudentLessonOptions(classDoc, program), [classDoc, program]);
  const [workspaceLessonKey, setWorkspaceLessonKey] = useState(() => defaultLessonKey(classDoc, program));
  const [links, setLinks] = useState({
    githubUrl: student?.projectGithubUrl || '',
    canvaUrl: student?.projectCanvaUrl || '',
  });

  useEffect(() => {
    setLinks({
      githubUrl: student?.projectGithubUrl || '',
      canvaUrl: student?.projectCanvaUrl || '',
    });
  }, [student?.id, student?.projectGithubUrl, student?.projectCanvaUrl]);

  useEffect(() => {
    setWorkspaceLessonKey((prev) => {
      if (lessonOptions.some((option) => option.value === prev)) return prev;
      return defaultLessonKey(classDoc, program);
    });
  }, [lessonOptions, classDoc, program]);

  const currentStage =
    student?.currentStage && STAGES.includes(student.currentStage)
      ? student.currentStage
      : STAGES[0];
  const nameApproved = isProjectNameApproved(student);
  const selectedLesson = lessonOptions.find((item) => item.value === workspaceLessonKey);

  const openGuide = (section = GUIDE_SECTIONS.overview) => {
    setGuideSection(section);
    setActiveTab('guide');
  };

  const adoptStage = (stage) => {
    setReportStagePrefill(stage);
    setActiveTab('work');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white px-4 py-3 dark:border-brand-500/30 dark:from-brand-500/10 dark:to-slate-900 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">Sản phẩm cuối khóa</Badge>
          {!nameApproved ? <Badge tone="amber">Chưa có tên dự án được duyệt</Badge> : null}
        </div>
        {nameApproved ? (
          <ProjectSummaryDisclosure student={{ ...student, currentStage }} className="mt-2" />
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{currentStage}</p>
        )}
      </div>

      <article className="card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/50 sm:px-3">
          {FINAL_PROJECT_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-[4.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition sm:min-w-0 sm:gap-2 sm:px-3 ${
                  activeTab === tab.id
                    ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'work' && (
            <div className="space-y-5">
              {lessonOptions.length ? (
                <Field label="Buổi đang làm" required>
                  <Select
                    value={workspaceLessonKey}
                    onChange={(event) => setWorkspaceLessonKey(event.target.value)}
                  >
                    {lessonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                  Giáo viên chưa đặt buổi hiện tại cho lớp. Chưa gửi được báo cáo hay file.
                </p>
              )}

              <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/30 sm:p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bước 1</p>
                  <h3 className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">
                    Viết báo cáo
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedLesson?.label || 'Chọn buổi'}</p>
                  <div className="mt-4">
                    <ProgressReportView
                      classDoc={classDoc}
                      program={program}
                      student={student}
                      onUpdateStudent={onUpdateStudent}
                      onOpenGuide={openGuide}
                      onOpenProcess={() => setActiveTab('process')}
                      stagePrefill={reportStagePrefill}
                      onStagePrefillConsumed={() => setReportStagePrefill(null)}
                      embedded
                      hideLessonSelect
                      hideHistory
                      hideExtras
                      lessonKey={workspaceLessonKey}
                      onLessonKeyChange={setWorkspaceLessonKey}
                      links={links}
                      onChangeLink={(key, value) => setLinks((prev) => ({ ...prev, [key]: value }))}
                    />
                  </div>
                </section>

                {FEATURE_DRIVE_SUBMISSION_ENABLED ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40 sm:p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bước 2</p>
                    <h3 className="mt-1 flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                      <Upload className="h-4 w-4" />
                      Nộp file sản phẩm
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Cùng buổi với báo cáo. Có thể nộp lại file nếu cần.
                    </p>
                    <div className="mt-4 space-y-5">
                      <DriveSubmitPage
                        embedded
                        hideLessonSelect
                        lessonKey={workspaceLessonKey}
                        onLessonKeyChange={setWorkspaceLessonKey}
                      />
                      <ProjectExtrasPanel
                        classDoc={classDoc}
                        student={student}
                        links={links}
                        onChangeLink={(key, value) => setLinks((prev) => ({ ...prev, [key]: value }))}
                        onOpenGuide={openGuide}
                      />
                    </div>
                  </section>
                ) : (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/40 sm:p-5">
                    <ProjectExtrasPanel
                      classDoc={classDoc}
                      student={student}
                      links={links}
                      onChangeLink={(key, value) => setLinks((prev) => ({ ...prev, [key]: value }))}
                      onOpenGuide={openGuide}
                    />
                  </section>
                )}
              </div>

              <ProgressReportHistory
                studentId={student.id}
                latestReportId={student.latestReportId}
                embedded
              />
            </div>
          )}
          {activeTab === 'process' && (
            <ProductWaterfallPanel
              student={student}
              onAdoptStage={adoptStage}
              onOpenLessons={onOpenLessons}
              onOpenSubmitGuide={() => openGuide(GUIDE_SECTIONS.overview)}
            />
          )}
          {activeTab === 'guide' && (
            <ProjectSubmissionGuide initialSection={guideSection} embedded />
          )}
        </div>
      </article>
    </div>
  );
}
