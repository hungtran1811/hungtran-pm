export function normalizeQuizCodeAnswer(rawValue, starterCode) {
  const text = String(rawValue ?? '').trim();
  const starter = String(starterCode ?? '').trim();
  if (!text) return '';
  if (starter && text === starter) return '';
  return text;
}

export function buildPendingQuizSubmissionResponses(quiz, rawAnswers) {
  const responses = [];
  let mcqTotal = 0;
  let unansweredCount = 0;

  for (const q of quiz.questions) {
    const type = q.type === 'code' ? 'code' : 'mcq';
    if (type === 'code') {
      const codeAnswer = normalizeQuizCodeAnswer(rawAnswers[q.id], q.starterCode);
      if (!codeAnswer) unansweredCount += 1;
      responses.push({
        questionId: q.id,
        questionType: 'code',
        prompt: q.prompt,
        codeAnswer: codeAnswer || '(chưa trả lời)',
        isCorrect: null,
        autoGraded: false,
      });
      continue;
    }

    mcqTotal += 1;
    const hasAnswer = rawAnswers[q.id] !== undefined && rawAnswers[q.id] !== null;
    if (!hasAnswer) unansweredCount += 1;
    const selectedIndex = hasAnswer ? Number(rawAnswers[q.id]) : -1;
    const selectedLabel = hasAnswer
      ? (q.options?.[selectedIndex] ?? `Đáp án ${selectedIndex + 1}`)
      : 'Chưa trả lời';
    responses.push({
      questionId: q.id,
      questionType: 'mcq',
      prompt: q.prompt,
      selectedIndex,
      selectedLabel,
      isCorrect: null,
    });
  }

  return {
    responses,
    mcqCorrect: 0,
    mcqTotal,
    mcqPercent: 0,
    codeCorrect: 0,
    codeGraded: 0,
    gradedCorrect: 0,
    gradedTotal: 0,
    gradedPercent: 0,
    unansweredCount,
    gradingStatus: 'pending',
  };
}

export function countPendingCodeGrades(responses = []) {
  return responses.filter(
    (r) => r.questionType === 'code' && r.isCorrect !== true && r.isCorrect !== false,
  ).length;
}

export function deriveGradingStatus(responses = []) {
  const codeResponses = responses.filter((r) => r.questionType === 'code');
  if (!codeResponses.length) return 'complete';
  const pending = countPendingCodeGrades(codeResponses);
  if (pending === 0) return 'complete';
  const graded = codeResponses.length - pending;
  if (graded > 0) return 'partial';
  return 'pending';
}

export function buildQuizLatestGradeFields(scores, responses) {
  const pendingCodeCount = countPendingCodeGrades(responses);
  return {
    mcqCorrect: scores.mcqCorrect,
    mcqTotal: scores.mcqTotal,
    mcqPercent: scores.mcqPercent,
    codeCorrect: scores.codeCorrect,
    codeGraded: scores.codeGraded,
    gradedCorrect: scores.gradedCorrect,
    gradedTotal: scores.gradedTotal,
    gradedPercent: scores.gradedPercent,
    pendingCodeCount,
    gradingStatus: deriveGradingStatus(responses),
  };
}
