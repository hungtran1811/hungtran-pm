import { useState } from 'react';
import { Code2, Mic, Zap } from 'lucide-react';
import { Markdown } from '../Markdown.jsx';
import {
  formatShowdownPromptForDisplay,
  getQuestionDisplayMeta,
  startupPerStudentCount,
} from '../../../lib/showdownQuestionEngine.js';

const ROUND_INTRO = [
  {
    id: 'startup',
    title: 'Vòng 1',
    subtitle: 'Khởi động',
    icon: Mic,
    accent: 'from-cyan-500/30 to-cyan-600/10 border-cyan-400/40',
    rules: (startupCount) => [
      'Vấn đáp miệng — giáo viên đọc câu hỏi và chấm trực tiếp.',
      `Mỗi học sinh trả lời ${startupCount} câu theo lượt.`,
      'Không nộp bài trên thiết bị.',
    ],
  },
  {
    id: 'obstacle',
    title: 'Vòng 2',
    subtitle: 'Chướng ngại',
    icon: Zap,
    accent: 'from-amber-500/30 to-amber-600/10 border-amber-400/40',
    rules: () => [
      'Cả lớp làm chung trên thiết bị.',
      'Trắc nghiệm / dự đoán output — nộp trong thời gian quy định.',
      'Trả lời đúng và nộp sớm được thưởng tốc độ.',
    ],
  },
  {
    id: 'finish',
    title: 'Vòng 3',
    subtitle: 'Về đích',
    icon: Code2,
    accent: 'from-violet-500/30 to-violet-600/10 border-violet-400/40',
    rules: () => [
      'Mỗi học sinh chọn một gói: 10đ (Dễ), 20đ (TB) hoặc 30đ (Khó).',
      'Viết code trên thiết bị — giáo viên chấm tay.',
      'Mỗi học sinh chỉ trả lời 1 câu trong lượt về đích của mình.',
    ],
  },
];

function FlipCard({ round, rules, presenting, flipped, onFlip }) {
  const Icon = round.icon;
  return (
    <button
      type="button"
      onClick={onFlip}
      className={`group relative w-full [perspective:1000px] ${presenting ? 'min-h-[11rem]' : 'min-h-[9rem]'}`}
      aria-pressed={flipped}
    >
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          flipped ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border bg-gradient-to-br p-4 text-center [backface-visibility:hidden] ${round.accent}`}
        >
          <Icon className={`text-white/90 ${presenting ? 'h-10 w-10' : 'h-8 w-8'}`} />
          <p className={`font-bold text-white ${presenting ? 'text-xl' : 'text-base'}`}>{round.title}</p>
          <p className={`text-white/80 ${presenting ? 'text-lg' : 'text-sm'}`}>{round.subtitle}</p>
          <p className={`mt-1 text-white/50 ${presenting ? 'text-sm' : 'text-xs'}`}>Bấm để xem luật</p>
        </div>
        <div
          className={`absolute inset-0 flex flex-col justify-center rounded-2xl border border-white/20 bg-slate-900/90 p-4 text-left [backface-visibility:hidden] [transform:rotateY(180deg)]`}
        >
          <p className={`mb-2 font-bold text-cyan-200 ${presenting ? 'text-base' : 'text-sm'}`}>
            {round.title} · {round.subtitle}
          </p>
          <ul className={`list-disc space-y-1.5 pl-4 text-white/85 ${presenting ? 'text-sm' : 'text-xs'}`}>
            {rules.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className={`mt-2 text-white/40 ${presenting ? 'text-xs' : 'text-[10px]'}`}>Bấm để lật lại</p>
        </div>
      </div>
    </button>
  );
}

export function ShowdownRoundIntroCards({ session, presenting = false }) {
  const [flipped, setFlipped] = useState({});
  const startupCount = startupPerStudentCount(session);

  const toggle = (id) => {
    setFlipped((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={`grid w-full gap-3 ${presenting ? 'max-w-4xl sm:grid-cols-3' : 'max-w-lg sm:grid-cols-3'}`}>
      {ROUND_INTRO.map((round) => (
        <FlipCard
          key={round.id}
          round={round}
          rules={round.rules(startupCount)}
          presenting={presenting}
          flipped={Boolean(flipped[round.id])}
          onFlip={() => toggle(round.id)}
        />
      ))}
    </div>
  );
}

export function ShowdownQuestionMetaBar({ question, variant = 'dark', size = 'md' }) {
  const meta = getQuestionDisplayMeta(question);
  if (!meta?.id && !meta?.topic && !meta?.difficulty) return null;

  const isDark = variant === 'dark';
  const pillClass = isDark
    ? 'border-white/20 bg-black/30 text-white/80'
    : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
  const textSize = size === 'lg' ? 'text-sm' : 'text-xs';

  return (
    <div className={`flex flex-wrap items-center justify-center gap-2 ${textSize}`}>
      {meta.id && (
        <span className={`rounded-full border px-2.5 py-0.5 font-mono font-semibold ${pillClass}`}>
          {meta.id}
        </span>
      )}
      {meta.topic && (
        <span className={`rounded-full border px-2.5 py-0.5 ${pillClass}`}>{meta.topic}</span>
      )}
      {meta.difficulty && (
        <span
          className={`rounded-full border px-2.5 py-0.5 font-semibold ${
            isDark
              ? 'border-amber-300/40 bg-amber-400/15 text-amber-100'
              : 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200'
          }`}
        >
          {meta.difficulty}
        </span>
      )}
    </div>
  );
}

export function ShowdownQuestionBody({
  question,
  variant = 'dark',
  size = 'md',
  className = '',
}) {
  if (!question) return null;

  const isDark = variant === 'dark';
  const { text, code } = formatShowdownPromptForDisplay(question.prompt);
  const codeBlock = code || question.code || null;
  const isLarge = size === 'lg';
  const isSmall = size === 'sm';

  const proseClass = isDark
    ? '!text-white [&_*]:!text-white [&_code]:!bg-black/40 [&_code]:!text-cyan-200 [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 whitespace-pre-wrap'
    : 'whitespace-pre-wrap';

  const textBoxClass = isDark
    ? `card-prose mx-auto rounded-3xl border border-white/15 bg-white/10 shadow-2xl backdrop-blur-sm ${
        isLarge ? 'max-w-5xl px-10 py-8 text-4xl font-semibold leading-snug' : 'max-w-3xl px-5 py-4 text-xl'
      }`
    : `card-prose ${isSmall ? 'text-sm' : isLarge ? 'text-lg' : 'text-base'}`;

  const codeClass = isDark
    ? `mx-auto overflow-x-auto rounded-2xl border border-emerald-400/20 bg-black/70 text-left text-emerald-300 whitespace-pre-wrap ${
        isLarge ? 'max-w-4xl p-7 text-2xl leading-relaxed' : 'max-w-2xl p-4 text-sm'
      }`
    : `overflow-x-auto rounded-xl bg-slate-900 p-3 text-emerald-300 whitespace-pre-wrap ${isSmall ? 'text-xs' : 'text-sm'}`;

  return (
    <div className={`space-y-4 ${className}`}>
      {text ? (
        <div className={textBoxClass}>
          <Markdown content={text} className={proseClass} />
        </div>
      ) : null}
      {codeBlock ? (
        <pre className={codeClass}>
          <code>{codeBlock}</code>
        </pre>
      ) : null}
    </div>
  );
}
