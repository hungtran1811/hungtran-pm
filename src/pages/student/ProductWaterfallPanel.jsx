import { useState } from 'react';
import { ArrowRight, BookOpen, CircleHelp, Lightbulb, ListOrdered } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { STAGES } from '../../constants/index.js';
import { getWaterfallStage, waterfallStageIndex } from '../../data/productWaterfall.js';

export function ProductWaterfallPanel({
  student,
  onAdoptStage,
  onOpenLessons,
  onOpenSubmitGuide,
}) {
  const currentStage = student?.currentStage && STAGES.includes(student.currentStage)
    ? student.currentStage
    : STAGES[0];
  const [selectedStage, setSelectedStage] = useState(currentStage);
  const guide = getWaterfallStage(selectedStage);
  const selectedIndex = waterfallStageIndex(selectedStage);
  const currentIndex = waterfallStageIndex(currentStage);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Quy trình làm sản phẩm
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Làm phần mềm theo thứ tự giúp bạn lên ý tưởng rõ rồi mới code. Nên đi lần lượt,
          nhưng vẫn được xem trước các giai đoạn sau.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {STAGES.map((stage, index) => {
          const meta = getWaterfallStage(stage);
          const isSelected = stage === selectedStage;
          const isCurrent = stage === currentStage;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => setSelectedStage(stage)}
              className={`flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl px-1 py-2 text-center transition sm:min-h-[3.5rem] sm:px-2 ${
                isSelected
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {index + 1}
              </span>
              <span className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight sm:text-xs">
                {meta.shortLabel}
              </span>
              {isCurrent && !isSelected && (
                <span className="mt-1 h-1 w-1 rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">
            Bước {selectedIndex + 1}/{STAGES.length}
          </Badge>
          {selectedStage === currentStage && <Badge tone="green">Bạn đang ở đây</Badge>}
          {selectedIndex > currentIndex && (
            <Badge tone="slate">Xem trước — nên hoàn thành bước trước</Badge>
          )}
        </div>

        <h4 className="mt-3 text-lg font-semibold text-slate-900 dark:text-slate-50">
          {selectedStage}
        </h4>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{guide.meaning}</p>

        <div className="mt-4">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <ListOrdered className="h-3.5 w-3.5" />
            Cách lên ý tưởng & thực hiện
          </p>
          <ul className="mt-2 space-y-2">
            {guide.howTo.map((item) => (
              <li
                key={item}
                className="flex gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200"
              >
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{guide.tip}</p>
        </div>

        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {guide.lessonsHint}
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            size="lg"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => onAdoptStage?.(selectedStage)}
          >
            Đang làm giai đoạn này
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="min-h-11"
            onClick={() => onOpenLessons?.()}
          >
            <BookOpen className="h-4 w-4" />
            Xem lại bài giảng
          </Button>
          {selectedIndex >= STAGES.length - 2 && (
            <Button
              variant="subtle"
              size="lg"
              className="min-h-11"
              onClick={() => onOpenSubmitGuide?.()}
            >
              <CircleHelp className="h-4 w-4" />
              Hướng dẫn nộp
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
