const DRAFT_PREFIXES = ['quizExamDraft:', 'showdown-submission:', 'olympia-submission:'];

export function clearLocalDrafts() {
  let removed = 0;
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && DRAFT_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    keys.forEach((key) => localStorage.removeItem(key));
    removed = keys.length;
  } catch {
    /* ignore */
  }
  return removed;
}
