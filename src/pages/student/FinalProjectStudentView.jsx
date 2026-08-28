import { useState } from 'react';
import { CircleHelp, ClipboardList, GitBranch } from 'lucide-react';
import { ProgressReportView } from './ProgressReportView.jsx';
import { GUIDE_SECTIONS, ProjectSubmissionGuide } from './ProjectSubmissionGuide.jsx';
import { ProductWaterfallPanel } from './ProductWaterfallPanel.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { isProjectNameApproved, projectNameDisplay } from '../../lib/classFinalMode.js';
import { STAGES } from '../../constants/index.js';

const FINAL_PROJECT_TABS = [
  { id: 'process', label: 'Quy trình', icon: GitBranch },
  { id: 'report', label: 'Báo cáo', icon: ClipboardList },
  { id: 'guide', label: 'Hướng dẫn nộp', icon: CircleHelp },
];

export function FinalProjectStudentView({ classDoc, student, onOpenLessons, onUpdateStudent }) {
  const [activeTab, setActiveTab] = useState('report');
  const [guideSection, setGuideSection] = useState(GUIDE_SECTIONS.overview);
  const [reportStagePrefill, setReportStagePrefill] = useState(null);

  const currentStage =
    student?.currentStage && STAGES.includes(student.currentStage)
      ? student.currentStage
      : STAGES[0];
  const displayName = projectNameDisplay(student);
  const nameApproved = isProjectNameApproved(student);

  const openGuide = (section = GUIDE_SECTIONS.overview) => {
    setGuideSection(section);
    setActiveTab('guide');
  };

  const adoptStage = (stage) => {
    setReportStagePrefill(stage);
    setActiveTab('report');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white px-4 py-3 dark:border-brand-500/30 dark:from-brand-500/10 dark:to-slate-900 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">Sản phẩm cuối khóa</Badge>
          {nameApproved && displayName ? (
            <Badge tone="green">{displayName}</Badge>
          ) : (
            <Badge tone="amber">Chưa có tên dự án được duyệt</Badge>
          )}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
          Bạn đang ở giai đoạn <strong>{currentStage}</strong>. Tab <strong>Báo cáo</strong> để cập
          nhật tiến độ; mở <strong>Quy trình</strong> khi cần hướng dẫn. Xem lại bài giảng từ thanh
          trên.
        </p>
        {nameApproved && (student.projectTopic || student.projectProblemSolution) && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-white/70 px-3 py-2.5 text-xs leading-5 text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
            {student.projectTopic && (
              <p>
                <span className="font-semibold text-slate-500">Chủ đề:</span> {student.projectTopic}
              </p>
            )}
            {student.projectProblemSolution && (
              <p className="line-clamp-2">
                <span className="font-semibold text-slate-500">Vấn đề:</span>{' '}
                {student.projectProblemSolution}
              </p>
            )}
          </div>
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

        <div className="p-5 sm:p-6">
          {activeTab === 'process' && (
            <ProductWaterfallPanel
              student={student}
              onAdoptStage={adoptStage}
              onOpenLessons={onOpenLessons}
              onOpenSubmitGuide={() => openGuide(GUIDE_SECTIONS.overview)}
            />
          )}
          {activeTab === 'report' && (
            <ProgressReportView
              classDoc={classDoc}
              student={student}
              onUpdateStudent={onUpdateStudent}
              onOpenGuide={openGuide}
              onOpenProcess={() => setActiveTab('process')}
              stagePrefill={reportStagePrefill}
              onStagePrefillConsumed={() => setReportStagePrefill(null)}
              embedded
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
