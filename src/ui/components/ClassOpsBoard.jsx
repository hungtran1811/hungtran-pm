import { Link } from 'react-router-dom';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { Badge } from './Badge.jsx';
import { EmptyState } from './EmptyState.jsx';
import {
  classSessionLabel,
  formatFileRatio,
  formatReportRatio,
} from '../../lib/dashboardStats.js';
import { driveFolderUrl } from '../../lib/submissionAdmin.js';

function phaseSessionText(row) {
  const phase = row.phase === 'final' ? 'Làm sản phẩm' : 'Học';
  return `${phase} · ${classSessionLabel(row.currentSession)}`;
}

function rowSurfaceClass(row) {
  if (row.badge?.id === 'support') {
    return 'bg-red-50/80 dark:bg-red-500/10';
  }
  if (row.badge?.id && row.badge.id !== 'ok') {
    return 'bg-amber-50/70 dark:bg-amber-500/10';
  }
  return '';
}

function cardAccentClass(row) {
  if (row.badge?.id === 'support') return 'border-l-red-500';
  if (row.badge?.id && row.badge.id !== 'ok') return 'border-l-amber-400';
  return 'border-l-emerald-400';
}

function RatioValue({ text, missing = false }) {
  if (text === '—') {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <span
      className={`tabular-nums font-medium ${
        missing ? 'text-amber-700 dark:text-amber-300' : 'text-slate-800 dark:text-slate-100'
      }`}
    >
      {text}
    </span>
  );
}

function ClassTitle({ row }) {
  return (
    <Link
      to={row.reportsHref}
      className="block min-w-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <span className="font-medium text-brand-600 hover:underline dark:text-brand-300">{row.classCode}</span>
      {row.className ? (
        <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{row.className}</span>
      ) : null}
    </Link>
  );
}

function DriveFolderLink({ folderId }) {
  const href = driveFolderUrl(folderId);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-300"
    >
      Drive
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function SupportValue({ count }) {
  if (count > 0) {
    return <Badge tone="red">{count}</Badge>;
  }
  return <span className="tabular-nums text-slate-400">0</span>;
}

function FileValue({ row }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span title={row.filesUnavailable ? 'Không tải được bài nộp Drive' : undefined}>
        <RatioValue text={formatFileRatio(row)} missing={row.fileMissing > 0} />
      </span>
      <DriveFolderLink folderId={row.driveFolderId} />
    </div>
  );
}

function ClassOpsCard({ row, driveEnabled }) {
  return (
    <article className={`card space-y-3 border-l-4 p-4 ${cardAccentClass(row)}`}>
      <div className="flex items-start justify-between gap-3">
        <ClassTitle row={row} />
        <Badge tone={row.badge?.tone || 'green'}>{row.badge?.label || 'OK'}</Badge>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">{phaseSessionText(row)}</p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-slate-500">HS</dt>
          <dd className="tabular-nums font-medium text-slate-800 dark:text-slate-100">{row.students}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Hỗ trợ</dt>
          <dd className="mt-0.5">
            <SupportValue count={row.needSupport} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Báo cáo</dt>
          <dd>
            <RatioValue text={formatReportRatio(row)} missing={row.reportMissing > 0} />
          </dd>
        </div>
        {driveEnabled ? (
          <div>
            <dt className="text-xs text-slate-500">File buổi này</dt>
            <dd className="mt-0.5">
              <FileValue row={row} />
            </dd>
          </div>
        ) : null}
      </dl>
      <Link
        to={row.reportsHref}
        className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-300"
      >
        Mở báo cáo
        <ChevronRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

export function OpsAttentionList({ items, hasOpenClasses }) {
  if (!hasOpenClasses) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        Chưa có lớp đang mở.
      </p>
    );
  }

  if (!items.length) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
        Mọi lớp đang ổn.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {items.map((item) => (
        <li key={`${item.classCode}-${item.id}`} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
          <Link
            to={item.href}
            className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40 dark:hover:bg-slate-800/50"
          >
            <Badge tone={item.tone}>{item.label}</Badge>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-800 dark:text-slate-100">{item.classCode}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ClassOpsBoard({ rows, driveEnabled = false }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="Chưa có lớp đang mở"
        description="Khi có lớp active, bảng này hiện buổi, hỗ trợ, báo cáo và file buổi hiện tại."
      />
    );
  }

  return (
    <>
      <div className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <ClassOpsCard key={row.classCode} row={row} driveEnabled={driveEnabled} />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 lg:block">
        <div className="max-h-[min(640px,calc(100vh-16rem))] overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                <th className="bg-white px-3 py-2.5 dark:bg-slate-900">Lớp</th>
                <th className="bg-white px-3 py-2.5 dark:bg-slate-900">Buổi</th>
                <th className="bg-white px-3 py-2.5 dark:bg-slate-900">HS</th>
                <th className="bg-white px-3 py-2.5 dark:bg-slate-900">Hỗ trợ</th>
                <th className="bg-white px-3 py-2.5 dark:bg-slate-900">Báo cáo</th>
                {driveEnabled ? (
                  <th className="bg-white px-3 py-2.5 dark:bg-slate-900">File</th>
                ) : null}
                <th className="bg-white px-3 py-2.5 dark:bg-slate-900">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.classCode}
                  className={`border-b border-slate-100 dark:border-slate-800 ${rowSurfaceClass(row)}`}
                >
                  <td className="px-3 py-2.5">
                    <ClassTitle row={row} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">
                    {phaseSessionText(row)}
                  </td>
                  <td className="px-3 py-2.5 tabular-nums">{row.students}</td>
                  <td className="px-3 py-2.5">
                    <SupportValue count={row.needSupport} />
                  </td>
                  <td className="px-3 py-2.5">
                    <RatioValue text={formatReportRatio(row)} missing={row.reportMissing > 0} />
                  </td>
                  {driveEnabled ? (
                    <td className="px-3 py-2.5">
                      <FileValue row={row} />
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5">
                    <Badge tone={row.badge?.tone || 'green'}>{row.badge?.label || 'OK'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
