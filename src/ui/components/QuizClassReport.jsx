import { Link } from 'react-router-dom';
import { Badge } from './Badge.jsx';
import { EmptyState } from './EmptyState.jsx';
import { Field, Select } from './Field.jsx';
import { PanelSummaryGrid, PanelSummaryStat, ProgressMiniBar } from './SubmissionDisplay.jsx';
import {
  buildClassQuizQuestionStats,
  buildClassQuizScoreRows,
  scoreTone,
} from '../../lib/quizAdminScores.js';

function QuestionStatList({ title, items, tone = 'slate', emptyText }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h4>
      {!items.length ? (
        <p className="mt-2 text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg bg-white p-3 dark:bg-slate-900/50">
              <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{item.prompt}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={tone}>
                  {tone === 'green'
                    ? `${item.correct}/${item.total} đúng (${item.correctRate}%)`
                    : `${item.wrong}/${item.total} sai (${item.wrongRate}%)`}
                </Badge>
                <span className="text-xs text-slate-400">
                  {item.type === 'code' ? 'Code' : 'Trắc nghiệm'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuizClassReport({
  submissions,
  classes,
  classCode,
  onClassChange,
  sessionNumber,
  showClassPicker = true,
  showScoreTable = false,
  linkToScores = true,
}) {
  const selectedClass = classes.find((c) => c.classCode === classCode);
  const session =
    sessionNumber != null && sessionNumber !== ''
      ? Number(sessionNumber)
      : Number(selectedClass?.curriculumCurrentSession ?? 0);

  const stats = buildClassQuizQuestionStats(submissions, {
    classCode,
    sessionNumber: session > 0 ? session : null,
  });

  const scoreRows =
    classCode && session > 0
      ? buildClassQuizScoreRows(submissions, { classCode, sessionNumber: session })
      : [];

  if (!classCode) {
    return (
      <EmptyState
        title="Chọn lớp để xem báo cáo quiz"
        description="Báo cáo gồm điểm trung bình, câu làm tốt và câu sai nhiều."
      />
    );
  }

  if (stats.submissionCount === 0) {
    return (
      <div className="space-y-4">
        {showClassPicker && (
          <Field label="Lớp">
            <Select value={classCode} onChange={(e) => onClassChange?.(e.target.value)}>
              {classes.map((c) => (
                <option key={c.classCode} value={c.classCode}>
                  {c.classCode}
                  {c.className ? ` · ${c.className}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <EmptyState
          title="Chưa có bài quiz nộp"
          description={session > 0 ? `Chưa có học sinh nộp quiz buổi ${session}.` : undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {showClassPicker ? (
          <Field label="Lớp" className="min-w-[12rem] flex-1">
            <Select value={classCode} onChange={(e) => onClassChange?.(e.target.value)}>
              {classes.map((c) => (
                <option key={c.classCode} value={c.classCode}>
                  {c.classCode}
                  {c.className ? ` · ${c.className}` : ''}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {classCode}
              {selectedClass?.className ? ` · ${selectedClass.className}` : ''}
            </p>
            {session > 0 && <p className="text-xs text-slate-500">Buổi {session}</p>}
          </div>
        )}
        {linkToScores && (
          <Link
            to={`/admin/scores?tab=quiz&class=${encodeURIComponent(classCode)}${session > 0 ? `&session=${session}` : ''}`}
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
          >
            Xem bảng điểm chi tiết
          </Link>
        )}
      </div>

      <PanelSummaryGrid className="mb-0 sm:grid-cols-2 lg:grid-cols-3">
        <PanelSummaryStat
          label="Điểm trung bình lớp"
          value={stats.averagePercent != null ? `${stats.averagePercent}%` : '—'}
          tone={stats.averagePercent != null ? scoreTone(stats.averagePercent) : 'slate'}
        />
        <PanelSummaryStat label="Đã nộp quiz" value={stats.submissionCount} tone="brand" />
        <PanelSummaryStat label="Số câu trong đề" value={stats.questions.length} />
      </PanelSummaryGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <QuestionStatList
          title="Câu làm đúng nhiều nhất"
          items={stats.mostCorrect}
          tone="green"
          emptyText="Chưa đủ dữ liệu."
        />
        <QuestionStatList
          title="Câu sai nhiều nhất"
          items={stats.mostWrong}
          tone="red"
          emptyText="Chưa có câu nào sai."
        />
      </div>

      {showScoreTable && scoreRows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Điểm từng học sinh</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-2.5">Học sinh</th>
                  <th className="px-4 py-2.5">Điểm</th>
                  <th className="hidden px-4 py-2.5 sm:table-cell">Tiến độ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {scoreRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {row.studentName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={scoreTone(row.score.percent)}>
                        {row.score.correct}/{row.score.total} ({row.score.percent}%)
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <ProgressMiniBar percent={row.score.percent} className="max-w-[8rem]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
