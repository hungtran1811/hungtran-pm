import { Download } from 'lucide-react';
import { formatUploadSize, normalizeLessonResources } from '../../lib/lessonResources.js';

export function LessonResourcesCard({ sessionNumber, resources }) {
  const rows = normalizeLessonResources(resources);
  if (!rows.length) return null;

  return (
    <section
      className="mb-5 rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 dark:border-brand-500/30 dark:bg-brand-500/10"
      aria-label={`Tài nguyên buổi ${sessionNumber}`}
    >
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Tài nguyên buổi {sessionNumber}
      </p>
      <ul className="mt-2 space-y-1.5">
        {rows.map((item) => (
          <li key={item.id}>
            <a
              href={item.downloadUrl}
              download={item.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 w-full items-center gap-2 rounded-lg px-1 text-sm font-medium text-brand-700 transition hover:bg-white/70 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-300 dark:hover:bg-slate-900/40"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{item.title || item.fileName}</span>
              {item.size ? (
                <span className="ml-auto shrink-0 text-xs font-normal text-slate-500">
                  {formatUploadSize(item.size)}
                </span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
