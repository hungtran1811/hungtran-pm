import { Badge } from './Badge.jsx';
import { STATUS_TONES } from '../../constants/index.js';
import { formatDateTime } from '../../lib/firestore.js';
import { ProjectLinksReadonly } from '../../pages/student/ProjectProductLinks.jsx';

export function productLinksOf(report, student) {
  return {
    githubUrl: String(report?.projectGithubUrl || student?.projectGithubUrl || '').trim(),
    canvaUrl: String(report?.projectCanvaUrl || student?.projectCanvaUrl || '').trim(),
  };
}

function FieldBlock({ label, children }) {
  if (children == null || children === '') return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        {children}
      </p>
    </div>
  );
}

export function StudentReportDetail({ report, student, showLinks = true }) {
  if (!report) return null;

  const snapshot = Boolean(report.snapshotOnly);
  const doneToday = snapshot ? '' : String(report.doneToday || '').trim();
  const nextGoal = snapshot ? '' : String(report.nextGoal || '').trim();
  const difficulties = String(report.difficulties || '').trim();
  const projectName = String(report.projectName || student?.projectName || '').trim();
  const links = productLinksOf(report, student);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {report.progressPercent != null ? (
          <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
            {report.progressPercent}%
          </span>
        ) : null}
        {report.status ? <Badge tone={STATUS_TONES[report.status] || 'slate'}>{report.status}</Badge> : null}
        {report.stage ? <Badge tone="slate">{report.stage}</Badge> : null}
        {report.lessonKey ? <Badge tone="slate">{report.lessonKey}</Badge> : null}
      </div>
      {projectName ? <FieldBlock label="Tên dự án">{projectName}</FieldBlock> : null}
      {doneToday ? <FieldBlock label="Đã làm được">{doneToday}</FieldBlock> : null}
      {nextGoal ? <FieldBlock label="Mục tiêu tiếp">{nextGoal}</FieldBlock> : null}
      {difficulties ? <FieldBlock label="Khó khăn">{difficulties}</FieldBlock> : null}
      {showLinks ? <ProjectLinksReadonly githubUrl={links.githubUrl} canvaUrl={links.canvaUrl} /> : null}
      {report.submittedAt ? (
        <p className="text-xs text-slate-400">{formatDateTime(report.submittedAt)}</p>
      ) : null}
    </div>
  );
}
