import { ClipboardList, Code2, Sparkles } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { Badge } from './Badge.jsx';
import { Button } from './Button.jsx';
import { EmptyState } from './EmptyState.jsx';
import { countPendingCodeGrades } from '../../services/quiz.service.js';
import { formatDateTime } from '../../lib/firestore.js';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return s ? `${m}p ${s}s` : `${m}p`;
}

function AttemptResponse({ response, index, submission, saving, onGradeCode }) {
  const isCode = response.questionType === 'code';
  const isGraded = response.isCorrect === true || response.isCorrect === false;

  return (
    <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
      <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
        {index + 1}. {response.prompt}
      </p>
      {isCode ? (
        <>
          <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-slate-950 p-2 font-mono text-[11px] text-green-400">
            {response.codeAnswer || '(trống)'}
          </pre>
          {isGraded && (
            <Badge tone={response.isCorrect ? 'green' : 'red'} className="mt-1 inline-flex">
              {response.isCorrect
                ? response.manuallyGraded
                  ? 'Đúng (chấm tay)'
                  : 'Đúng (tự chấm)'
                : response.manuallyGraded
                  ? 'Sai (chấm tay)'
                  : 'Sai (tự chấm)'}
            </Badge>
          )}
          {onGradeCode && (
            <div className="mt-1.5 flex gap-2">
              <Button
                size="sm"
                variant={response.isCorrect === true ? 'primary' : 'secondary'}
                disabled={saving}
                onClick={() => onGradeCode(submission, index, true)}
              >
                Đúng
              </Button>
              <Button
                size="sm"
                variant={response.isCorrect === false ? 'danger' : 'secondary'}
                disabled={saving}
                onClick={() => onGradeCode(submission, index, false)}
              >
                Sai
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          {response.selectedLabel}
          {response.selectedLabel === 'Chưa trả lời' ? (
            <Badge tone="slate" className="ml-1.5 inline-flex">
              Bỏ trống
            </Badge>
          ) : response.isCorrect !== undefined ? (
            <Badge tone={response.isCorrect ? 'green' : 'red'} className="ml-1.5 inline-flex">
              {response.isCorrect ? 'Đúng' : 'Sai'}
            </Badge>
          ) : null}
        </p>
      )}
      {isCode && !isGraded && !onGradeCode && (
        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-400">
          <Code2 className="h-3 w-3" />
          Chờ chấm code
        </p>
      )}
    </div>
  );
}

export function QuizAttemptHistoryModal({
  studentName,
  sessionNumber,
  quizTitle,
  attempts,
  onGradeCode,
  onReautoGrade,
  actionLoading,
  onClose,
}) {
  const sorted = [...attempts].sort((a, b) => (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0));
  const maxAttempts = sorted[0]?.maxAttempts || sorted.length;

  return (
    <Modal open onClose={onClose} title={`Lịch sử quiz · ${studentName}`} size="xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>Buổi {sessionNumber}</span>
        {quizTitle && <span>· {quizTitle}</span>}
        <Badge tone="brand">
          {sorted.length}/{maxAttempts} lần đã làm
        </Badge>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-7 w-7" />} title="Chưa có lần làm nào" />
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {sorted.map((sub) => {
            const pending = countPendingCodeGrades(sub.responses);
            const saving = actionLoading === sub.id;
            return (
              <div
                key={sub.id}
                className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      Lần {sub.attemptNumber}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatDateTime(sub.submittedAt)}
                      {sub.durationSeconds > 0 ? ` · ${formatDuration(sub.durationSeconds)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {onReautoGrade && (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={actionLoading === `reauto-${sub.id}`}
                        onClick={() => onReautoGrade(sub)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Tự chấm
                      </Button>
                    )}
                    {sub.timedOut && <Badge tone="amber">Hết giờ</Badge>}
                    {pending > 0 && <Badge tone="amber">{pending} code chờ</Badge>}
                    {sub.gradedTotal > 0 ? (
                      <Badge
                        tone={
                          sub.gradedPercent >= 80
                            ? 'green'
                            : sub.gradedPercent >= 50
                              ? 'amber'
                              : 'red'
                        }
                      >
                        {sub.gradedCorrect}/{sub.gradedTotal} ({sub.gradedPercent}%)
                      </Badge>
                    ) : sub.mcqTotal > 0 ? (
                      <Badge
                        tone={
                          sub.mcqPercent >= 80 ? 'green' : sub.mcqPercent >= 50 ? 'amber' : 'red'
                        }
                      >
                        TN: {sub.mcqCorrect}/{sub.mcqTotal} ({sub.mcqPercent}%)
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {sub.responses.map((r, i) => (
                    <AttemptResponse
                      key={`${sub.id}-${i}`}
                      response={r}
                      index={i}
                      submission={sub}
                      saving={saving}
                      onGradeCode={r.questionType === 'code' ? onGradeCode : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
