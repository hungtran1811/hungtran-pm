import { describe, expect, it } from 'vitest';
import {
  buildPendingQuizSubmissionResponses,
  buildQuizLatestGradeFields,
  deriveGradingStatus,
  normalizeQuizCodeAnswer,
} from './quizSubmissionContract.js';

describe('quiz submission contract helpers', () => {
  it('builds pending responses without answer keys or correctness', () => {
    const quiz = {
      questions: [
        { id: 'q1', type: 'mcq', prompt: 'Pick one', options: ['A', 'B'], correctIndex: 1 },
        { id: 'q2', type: 'code', prompt: 'Write code', starterCode: 'print("start")' },
      ],
    };

    const result = buildPendingQuizSubmissionResponses(quiz, {
      q1: 1,
      q2: 'print("done")',
    });

    expect(result.gradingStatus).toBe('pending');
    expect(result.mcqCorrect).toBe(0);
    expect(result.responses).toHaveLength(2);
    expect(result.responses[0]).toMatchObject({
      questionId: 'q1',
      questionType: 'mcq',
      selectedIndex: 1,
      isCorrect: null,
    });
    expect(result.responses[0]).not.toHaveProperty('correctIndex');
    expect(result.responses[1]).toMatchObject({
      questionId: 'q2',
      questionType: 'code',
      autoGraded: false,
      isCorrect: null,
    });
  });

  it('treats unchanged starter code as unanswered', () => {
    expect(normalizeQuizCodeAnswer('print("start")', 'print("start")')).toBe('');
    expect(normalizeQuizCodeAnswer(' print("done") ', 'print("start")')).toBe('print("done")');
  });

  it('derives partial status when some code answers are still pending', () => {
    const responses = [
      { questionType: 'mcq', isCorrect: true },
      { questionType: 'code', isCorrect: true },
      { questionType: 'code', isCorrect: null },
    ];

    expect(deriveGradingStatus(responses)).toBe('partial');
    expect(buildQuizLatestGradeFields({
      mcqCorrect: 1,
      mcqTotal: 1,
      mcqPercent: 100,
      codeCorrect: 1,
      codeGraded: 1,
      gradedCorrect: 2,
      gradedTotal: 2,
      gradedPercent: 100,
    }, responses)).toMatchObject({
      pendingCodeCount: 1,
      gradingStatus: 'partial',
    });
  });
});
