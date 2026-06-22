import { useState } from 'react';
import { ChevronDown, CircleHelp, FileCode2, Link2 } from 'lucide-react';
import { ProjectProductLinks } from './ProjectProductLinks.jsx';
import { SessionCodeUpload } from './SessionCodeUpload.jsx';
import { GUIDE_SECTIONS } from './ProjectSubmissionGuide.jsx';

function AccordionSection({ icon: Icon, title, hint, badge, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-slate-200 last:border-b-0 dark:border-slate-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</span>
            {badge}
          </span>
          {!open && hint && <span className="mt-0.5 block truncate text-xs text-slate-500">{hint}</span>}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">{children}</div>}
    </div>
  );
}

export function ProjectExtrasPanel({ classDoc, student, links, onChangeLink, onOpenGuide, disabled = false }) {
  const hasGithub = Boolean(student.projectGithubUrl?.trim());
  const hasCanva = Boolean(student.projectCanvaUrl?.trim());
  const linkHint =
    hasGithub && hasCanva
      ? 'GitHub · Canva'
      : hasGithub
        ? 'GitHub'
        : hasCanva
          ? 'Canva'
          : 'Chưa có liên kết';

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bổ sung dự án</p>
            <p className="mt-0.5 text-xs text-slate-400">Liên kết và file code — mở khi cần cập nhật</p>
          </div>
          {onOpenGuide && (
            <button
              type="button"
              onClick={() => onOpenGuide(GUIDE_SECTIONS.overview)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              <CircleHelp className="h-3.5 w-3.5" />
              Hướng dẫn
            </button>
          )}
        </div>
      </div>

      <AccordionSection
        icon={Link2}
        title="Liên kết sản phẩm"
        hint={linkHint}
        badge={
          hasGithub || hasCanva ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-500/15 dark:text-green-300">
              Đã lưu
            </span>
          ) : null
        }
      >
        <ProjectProductLinks
          student={student}
          links={links}
          onChange={onChangeLink}
          onOpenGuide={onOpenGuide}
          disabled={disabled}
          compact
        />
      </AccordionSection>

      <AccordionSection icon={FileCode2} title="Nộp file code theo buổi" hint=".py, .html, .css, .js, .ui">
        {onOpenGuide && (
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Chưa biết cách nộp?{' '}
            <button
              type="button"
              onClick={() => onOpenGuide(GUIDE_SECTIONS.code)}
              className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
            >
              Xem hướng dẫn file theo buổi
            </button>
          </p>
        )}
        <SessionCodeUpload classDoc={classDoc} student={student} compact />
      </AccordionSection>
    </div>
  );
}
