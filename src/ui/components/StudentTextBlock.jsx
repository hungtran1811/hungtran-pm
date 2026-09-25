import { parseStudentPlainText } from '../../lib/studentPlainText.js';

export function StudentFormattedText({ text, className = '' }) {
  const blocks = parseStudentPlainText(text);
  if (!blocks.length) return null;

  return (
    <div className={`space-y-3 whitespace-pre-wrap ${className}`}>
      {blocks.map((block, index) =>
        block.type === 'list' ? (
          <ul key={index} className="list-disc space-y-1.5 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={`${index}-${itemIndex}`}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={index} className="whitespace-pre-wrap">
            {block.text}
          </p>
        ),
      )}
    </div>
  );
}

export function StudentTextBlock({ label, children, emptyLabel = '— Chưa có nội dung' }) {
  const text = String(children || '').trim();
  const blocks = parseStudentPlainText(text);

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-900">
      {label ? (
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
      ) : null}
      {blocks.length ? (
        <StudentFormattedText
          text={text}
          className={`${label ? 'mt-2' : ''} text-base leading-7 text-slate-800 dark:text-slate-100`}
        />
      ) : (
        <p className={`${label ? 'mt-2' : ''} text-sm italic text-slate-400`}>{emptyLabel}</p>
      )}
    </section>
  );
}
