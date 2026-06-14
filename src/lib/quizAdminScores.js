/** Điểm quiz = trắc nghiệm + code khớp đáp án mẫu (tự chấm khi nộp). */
export function computeAdminQuizScore(submission) {
  const gradedCorrect = Number(submission?.gradedCorrect ?? 0);
  const gradedTotal = Number(submission?.gradedTotal ?? 0);
  const percent = gradedTotal > 0 ? Math.round((gradedCorrect / gradedTotal) * 100) : 0;

  return {
    correct: gradedCorrect,
    total: gradedTotal,
    percent,
    mcqCorrect: Number(submission?.mcqCorrect ?? 0),
    mcqTotal: Number(submission?.mcqTotal ?? 0),
    mcqPercent: Number(submission?.mcqPercent ?? 0),
  };
}

export function scoreTone(percent) {
  if (percent >= 80) return 'green';
  if (percent >= 50) return 'amber';
  return 'red';
}

export function groupLatestQuizSubmissions(submissions) {
  const map = new Map();
  submissions.forEach((sub) => {
    const key = `${sub.classCode}__${sub.studentId}__${sub.lessonId}`;
    const existing = map.get(key);
    if (!existing || (sub.attemptNumber ?? 0) >= (existing.attemptNumber ?? 0)) {
      map.set(key, sub);
    }
  });
  return [...map.values()];
}

function scopeLatestSubmissions(submissions, { classCode, sessionNumber = null } = {}) {
  let latest = groupLatestQuizSubmissions(submissions);
  if (classCode) latest = latest.filter((s) => s.classCode === classCode);
  if (sessionNumber != null && sessionNumber !== '') {
    latest = latest.filter((s) => Number(s.sessionNumber) === Number(sessionNumber));
  }
  return latest;
}

/** Bảng điểm theo lớp — mỗi HS một dòng (lần nộp mới nhất / buổi). */
export function buildClassQuizScoreRows(submissions, { classCode, sessionNumber = null } = {}) {
  const latest = scopeLatestSubmissions(submissions, { classCode, sessionNumber });

  return latest
    .map((sub) => {
      const score = computeAdminQuizScore(sub);
      return {
        id: `${sub.studentId}__${sub.lessonId}`,
        studentId: sub.studentId,
        studentName: sub.studentName,
        classCode: sub.classCode,
        sessionNumber: sub.sessionNumber,
        quizTitle: sub.quizTitle,
        submittedAt: sub.submittedAt,
        attemptNumber: sub.attemptNumber,
        score,
        submission: sub,
      };
    })
    .sort((a, b) => {
      const sessionDiff = Number(b.sessionNumber) - Number(a.sessionNumber);
      if (sessionDiff !== 0) return sessionDiff;
      return a.studentName.localeCompare(b.studentName, 'vi');
    });
}

function isGradableResponse(response) {
  if (response.questionType === 'mcq') return true;
  if (response.questionType === 'code') {
    return response.isCorrect === true || response.isCorrect === false;
  }
  return false;
}

/** Thống kê câu hỏi theo lớp/buổi — câu đúng/sai nhiều nhất. */
export function buildClassQuizQuestionStats(submissions, { classCode, sessionNumber = null } = {}) {
  const latest = scopeLatestSubmissions(submissions, { classCode, sessionNumber });
  const byQuestion = new Map();

  latest.forEach((sub) => {
    (sub.responses ?? []).forEach((response, index) => {
      if (!isGradableResponse(response)) return;

      const key = response.questionId || `q-${index}-${response.prompt?.slice(0, 40)}`;
      const entry = byQuestion.get(key) || {
        id: key,
        prompt: response.prompt || `Câu ${index + 1}`,
        type: response.questionType,
        correct: 0,
        wrong: 0,
        total: 0,
      };

      entry.total += 1;
      if (response.isCorrect === true) entry.correct += 1;
      else entry.wrong += 1;
      byQuestion.set(key, entry);
    });
  });

  const questions = [...byQuestion.values()].map((q) => ({
    ...q,
    correctRate: q.total ? Math.round((q.correct / q.total) * 100) : 0,
    wrongRate: q.total ? Math.round((q.wrong / q.total) * 100) : 0,
  }));

  const averagePercent =
    latest.length > 0
      ? Math.round(
          latest.reduce((sum, sub) => sum + computeAdminQuizScore(sub).percent, 0) / latest.length,
        )
      : null;

  return {
    submissionCount: latest.length,
    averagePercent,
    questions,
    mostCorrect: [...questions]
      .sort((a, b) => b.correct - a.correct || b.correctRate - a.correctRate)
      .slice(0, 5),
    mostWrong: [...questions]
      .sort((a, b) => b.wrong - a.wrong || b.wrongRate - a.wrongRate)
      .slice(0, 5),
  };
}

export function summarizeQuizScoresByClass(submissions, activeClasses) {
  const latest = groupLatestQuizSubmissions(submissions);
  return activeClasses.map((cls) => {
    const classSubs = latest.filter((s) => s.classCode === cls.classCode);
    const currentSession = Number(cls.curriculumCurrentSession ?? 0);
    const sessionSubs = classSubs.filter((s) => Number(s.sessionNumber) === currentSession);
    const avg =
      sessionSubs.length > 0
        ? Math.round(
            sessionSubs.reduce((sum, s) => sum + computeAdminQuizScore(s).percent, 0) /
              sessionSubs.length,
          )
        : null;

    return {
      classCode: cls.classCode,
      className: cls.className,
      currentSession,
      submissionCount: sessionSubs.length,
      totalSubmissions: classSubs.length,
      averagePercent: avg,
    };
  });
}
