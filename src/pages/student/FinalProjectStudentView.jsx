import { useState } from 'react';
import { BookOpen, CircleHelp, ClipboardList, History } from 'lucide-react';
import { ProgressReportView } from './ProgressReportView.jsx';
import { ProgressReportHistory } from './ProgressReportHistory.jsx';
import { LessonsView } from './LessonsView.jsx';
import { GUIDE_SECTIONS, ProjectSubmissionGuide } from './ProjectSubmissionGuide.jsx';

const FINAL_PROJECT_TABS = [
  { id: 'report', label: 'Báo cáo', icon: ClipboardList },
  { id: 'history', label: 'Lịch sử', icon: History },
  { id: 'lessons', label: 'Bài giảng', icon: BookOpen },
  { id: 'guide', label: 'Hướng dẫn', icon: CircleHelp },
];

export function FinalProjectStudentView({
  classDoc,
  program,
  student,
  submittedLessonIds,
  onFeedbackSubmitted,
  onQuizFocusChange,
  onUpdateStudent,
}) {
  const [activeTab, setActiveTab] = useState('report');
  const [guideSection, setGuideSection] = useState(GUIDE_SECTIONS.overview);

  const openGuide = (section = GUIDE_SECTIONS.overview) => {
    setGuideSection(section);
    setActiveTab('guide');
  };

  return (
    <div className="space-y-5">
      <article className="card overflow-hidden">
        <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/50 sm:px-3">
          {FINAL_PROJECT_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition sm:gap-2 sm:px-4 ${
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

        <div className={activeTab === 'lessons' ? 'p-4 sm:p-5' : 'p-5 sm:p-6'}>
          {activeTab === 'report' && (
            <ProgressReportView
              classDoc={classDoc}
              student={student}
              onUpdateStudent={onUpdateStudent}
              onOpenGuide={openGuide}
              embedded
            />
          )}
          {activeTab === 'guide' && (
            <ProjectSubmissionGuide initialSection={guideSection} embedded />
          )}
          {activeTab === 'history' && (
            <ProgressReportHistory studentId={student.id} embedded />
          )}
          {activeTab === 'lessons' && (
            <LessonsView
              classDoc={classDoc}
              program={program}
              student={student}
              submittedLessonIds={submittedLessonIds}
              isFinalPhase
              embedded
              onFeedbackSubmitted={onFeedbackSubmitted}
              onQuizFocusChange={onQuizFocusChange}
            />
          )}
        </div>
      </article>
    </div>
  );
}
