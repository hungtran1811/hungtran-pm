import { formatDateTime } from '../../../lib/firestore.js';
import { findStudentSubmissionNote } from '../../../lib/submissionStudentNotes.js';
import { lessonKeysEqual } from '../../../lib/submissionFileName.js';

function NoteLine({ note }) {
  const timeLabel = note.submittedAt ? formatDateTime(note.submittedAt) : '';
  return (
    <p className="text-sm text-emerald-800 dark:text-emerald-300">
      Đã nộp{timeLabel ? ` lúc ${timeLabel}` : ''}
      {note.originalFileName ? (
        <>
          {' '}
          · File <span className="font-medium">{note.originalFileName}</span>
        </>
      ) : null}
      {note.attempt > 1 ? ` · Lần ${note.attempt}` : null}
    </p>
  );
}

export function SelectedLessonNote({ notes, lessonKey }) {
  const note = findStudentSubmissionNote(notes, lessonKey);
  if (!note) return null;
  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <NoteLine note={note} />
    </div>
  );
}

export function StudentSubmissionNotes({ notes, lessonOptions = [] }) {
  if (!notes.length) return null;
  const lessonLabel = (lessonKey) =>
    lessonOptions.find((item) => lessonKeysEqual(item.value, lessonKey))?.label || lessonKey;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
      <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100">Buổi đã nộp</h3>
      <ul className="mt-2 space-y-2">
        {notes.map((note) => (
          <li key={note.lessonKey} className="text-sm">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {lessonLabel(note.lessonKey)}
            </p>
            <NoteLine note={note} />
          </li>
        ))}
      </ul>
    </section>
  );
}
