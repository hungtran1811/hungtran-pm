export function responsesToRawAnswers(responses = []) {
  const map = {};
  for (const r of responses) {
    if (r.questionType === 'code') {
      const raw = r.codeAnswer;
      if (raw && raw !== '(chưa trả lời)' && raw !== '(trống)') map[r.questionId] = raw;
      else map[r.questionId] = '';
    } else if (r.selectedIndex !== undefined && r.selectedIndex >= 0) {
      map[r.questionId] = r.selectedIndex;
    }
  }
  return map;
}

export function responsesToPracticeAnswers(responses = []) {
  const map = {};
  for (const r of responses) {
    if (r.selectedIndex !== undefined && r.selectedIndex >= 0) {
      map[r.questionId] = r.selectedIndex;
    }
  }
  return map;
}
