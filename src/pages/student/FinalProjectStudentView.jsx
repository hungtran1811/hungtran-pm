import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleHelp, ClipboardList } from 'lucide-react';
import { ProgressReportView } from './ProgressReportView.jsx';
import { ProgressReportHistory } from './ProgressReportHistory.jsx';
import { GUIDE_SECTIONS, ProjectSubmissionGuide } from './ProjectSubmissionGuide.jsx';
import { DriveSubmitPage } from './DriveSubmitPage.jsx';
import { ProjectProductLinks } from './ProjectProductLinks.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Field, Select } from '../../ui/components/Field.jsx';
import { ProjectSummaryDisclosure } from '../../ui/components/ProjectSummaryDisclosure.jsx';
import { FEATURE_DRIVE_SUBMISSION_ENABLED } from '../../config/features.js';
import { isProjectNameApproved } from '../../lib/classFinalMode.js';
import { STAGES, STAGE_TONES } from '../../constants/index.js';
import { buildStudentLessonOptions, defaultLessonKey } from '../../lib/submissionLessons.js';

const FINAL_PROJECT_TABS = [
  { id: 'work', label: 'Báo cáo & nộp', icon: ClipboardList },
  { id: 'guide', label: 'Hướng dẫn', icon: CircleHelp },
];

export function FinalProjectStudentView({ classDoc, program, student, onUpdateStudent }) {
  const submitPanelRef = useRef(null);
  const [activeTab, setActiveTab] = useState('work');
  const [guideSection, setGuideSection] = useState(GUIDE_SECTIONS.overview);
  const lessonOptions = useMemo(() => buildStudentLessonOptions(classDoc, program), [classDoc, program]);
  const [workspaceLessonKey, setWorkspaceLessonKey] = useState(() => defaultLessonKey(classDoc, program));
  const [links, setLinks] = useState({
    githubUrl: student?.projectGithubUrl || '',
    canvaUrl: student?.projectCanvaUrl || '',
    slidesUrl: student?.projectSlidesUrl || '',
    otherUrl: student?.projectOtherUrl || '',
  });

  useEffect(() => {
    setLinks({
      githubUrl: student?.projectGithubUrl || '',
      canvaUrl: student?.projectCanvaUrl || '',
      slidesUrl: student?.projectSlidesUrl || '',
      otherUrl: student?.projectOtherUrl || '',
    });
  }, [student?.id, student?.projectGithubUrl, student?.projectCanvaUrl, student?.projectSlidesUrl, student?.projectOtherUrl]);

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
  const progressPercent = Number(student?.currentProgressPercent) || 0;

  const openGuide = (section = GUIDE_SECTIONS.overview) => {
    setGuideSection(section);
    setActiveTab('guide');
  };

  const scrollToSubmit = () => {
    submitPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white px-4 py-4 dark:border-brand-500/30 dark:from-brand-500/10 dark:to-slate-900 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Sản phẩm cuối khóa
          </p>
          {nameApproved ? (
            <span className="text-xl font-bold tabular-nums text-brand-600 dark:text-brand-300">
              {progressPercent}%
            </span>
          ) : null}
        </div>
        {!nameApproved ? (
          <div className="mt-2">
            <Badge tone="amber">Chưa có tên dự án được duyệt</Badge>
          </div>
        ) : null}
        {nameApproved ? (
          <ProjectSummaryDisclosure student={{ ...student, currentStage }} className="mt-2" />
        ) : (
          <div className="mt-2">
            <Badge tone={STAGE_TONES[currentStage] || 'slate'}>{currentStage}</Badge>
          </div>
        )}
      </div>

      <article className="card overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/50 sm:px-3">
          {FINAL_PROJECT_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-w-[4.5rem] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium motion-safe:transition sm:min-w-0 sm:gap-2 sm:px-3 ${
                  active
                    ? 'bg-white text-brand-700 shadow-sm motion-safe:scale-[1.02] dark:bg-slate-900 dark:text-brand-300'
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

              <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
                <section className="min-w-0">
                  <h3 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">
                    Viết báo cáo
                  </h3>
                  <ProgressReportView
                    classDoc={classDoc}
                    program={program}
                    student={student}
                    onUpdateStudent={onUpdateStudent}
                    onOpenGuide={openGuide}
                    embedded
                    hideLessonSelect
                    hideHistory
                    hideExtras
                    unstickFooter
                    lessonKey={workspaceLessonKey}
                    onLessonKeyChange={setWorkspaceLessonKey}
                    links={links}
                    onChangeLink={(key, value) => setLinks((prev) => ({ ...prev, [key]: value }))}
                    onContinueAfterSubmit={scrollToSubmit}
                  />
                </section>

                <section
                  ref={submitPanelRef}
                  id="student-submit-panel"
                  className="min-w-0 space-y-5"
                >
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {FEATURE_DRIVE_SUBMISSION_ENABLED ? 'Nộp file & liên kết' : 'Liên kết sản phẩm'}
                  </h3>
                  {FEATURE_DRIVE_SUBMISSION_ENABLED ? (
                    <DriveSubmitPage
                      embedded
                      hideLessonSelect
                      lessonKey={workspaceLessonKey}
                      onLessonKeyChange={setWorkspaceLessonKey}
                      onOpenGuide={openGuide}
                    />
                  ) : null}
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Liên kết sản phẩm
                      </p>
                    </div>
                    <div className="px-4 py-4">
                      <ProjectProductLinks
                        student={student}
                        links={links}
                        onChange={(key, value) => setLinks((prev) => ({ ...prev, [key]: value }))}
                        onOpenGuide={openGuide}
                        compact
                      />
                    </div>
                  </div>
                </section>
              </div>

              <ProgressReportHistory
                studentId={student.id}
                latestReportId={student.latestReportId}
                embedded
              />
            </div>
          )}
          {activeTab === 'guide' && (
            <div className="student-panel-in">
              <ProjectSubmissionGuide initialSection={guideSection} embedded />
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
