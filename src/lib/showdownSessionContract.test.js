import { describe, expect, it } from 'vitest';
import {
  computeShowdownPoints,
  isShowdownTimerWaiting,
  normalizeShowdownParticipant,
  normalizeShowdownResponse,
  normalizeShowdownSession,
  pendingQuestionTimerFields,
  rankedShowdownSpeedBonus,
  resolveQuestionDeadlineMs,
  resolveShowdownRoundSeconds,
} from './showdownSessionContract.js';

describe('showdown session contract helpers', () => {
  it('normalizes session, participant, and response snapshots', () => {
    const session = normalizeShowdownSession('session-1', {
      classCode: 'PY101',
      currentRound: 'obstacle',
      questionIndex: '2',
      stateVersion: '5',
      config: { matrix: { rounds: { obstacle: { seconds: 45 } } } },
    });
    const participant = normalizeShowdownParticipant('student-1', {
      studentName: 'An',
      totalScore: '12',
    });
    const response = normalizeShowdownResponse('response-1', {
      studentId: 'student-1',
      questionIndex: '3',
      pointsEarned: '10',
      responseMs: '2000',
    });

    expect(session).toMatchObject({
      id: 'session-1',
      classCode: 'PY101',
      currentRound: 'obstacle',
      questionIndex: 2,
      stateVersion: 5,
      roundMode: 'device',
    });
    expect(participant).toMatchObject({
      id: 'student-1',
      studentName: 'An',
      totalScore: 12,
    });
    expect(response).toMatchObject({
      id: 'response-1',
      studentId: 'student-1',
      questionIndex: 3,
      pointsEarned: 10,
      responseMs: 2000,
    });
  });

  it('resolves timer state from server anchored timestamps', () => {
    const startedAt = new Date('2026-06-29T08:00:00.000Z');
    const session = {
      status: 'playing',
      questionDurationSeconds: 30,
      serverStartedAt: startedAt,
      questionDeadlineAt: new Date('2026-06-29T09:00:00.000Z'),
    };

    expect(resolveQuestionDeadlineMs(session)).toBe(startedAt.getTime() + 30000);
    expect(isShowdownTimerWaiting(session)).toBe(false);
    expect(isShowdownTimerWaiting({
      status: 'playing',
      questionDurationSeconds: 30,
      serverStartedAt: null,
    })).toBe(true);
  });

  it('uses fallback deadline when a timer has no active server start', () => {
    const fallback = new Date('2026-06-29T08:05:00.000Z');

    expect(resolveQuestionDeadlineMs({
      status: 'reveal',
      questionDurationSeconds: 0,
      serverStartedAt: null,
      questionDeadlineAt: fallback,
    })).toBe(fallback.getTime());
  });

  it('builds pending timer fields without starting the countdown', () => {
    expect(pendingQuestionTimerFields(45)).toEqual({
      questionDurationSeconds: 45,
      serverStartedAt: null,
      questionDeadlineAt: null,
      roundStartedAt: null,
    });
  });

  it('resolves round seconds and scoring rules', () => {
    const session = {
      config: {
        matrix: {
          rounds: {
            obstacle: { seconds: 50, points: 25 },
          },
        },
      },
    };

    expect(resolveShowdownRoundSeconds(session, 'obstacle')).toBe(50);
    expect(computeShowdownPoints(session, 'obstacle', true, null)).toBe(25);
    expect(computeShowdownPoints(session, 'obstacle', false, null)).toBe(0);
    expect(computeShowdownPoints(session, 'finish', true, 20)).toBe(20);
    expect(computeShowdownPoints(session, 'finish', true, 99)).toBe(0);
  });

  it('maps ranked speed bonus tiers', () => {
    expect(rankedShowdownSpeedBonus(0, [5, 3, 1])).toBe(5);
    expect(rankedShowdownSpeedBonus(2, [5, 3, 1])).toBe(1);
    expect(rankedShowdownSpeedBonus(3, [5, 3, 1])).toBe(0);
  });
});
