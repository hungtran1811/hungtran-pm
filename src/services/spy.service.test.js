import { describe, expect, it, vi } from 'vitest';
import { SPY_BLANK_VOTE_ID } from '../lib/spyConstants.js';

vi.mock('../config/firebase.js', () => ({
  db: {},
}));

import {
  checkCrewTaskWin,
  evaluateSpyOutcome,
  getActiveParticipants,
  getCurrentSpeaker,
  getDescribeRoundTotal,
  isSpyLobbyRosterReady,
  normalizeSpySession,
  pickCrewSabotageVictim,
  pickFairSpyIds,
  shouldSkipSpyVoteRound,
  tallySpyVotes,
  validateSpyPresentRosterChange,
  votesChangedFromBaseline,
} from './spy.service.js';

const participants = [
  { id: 'a', studentName: 'A', isSpy: false, eliminated: false },
  { id: 'b', studentName: 'B', isSpy: true, eliminated: false },
  { id: 'c', studentName: 'C', isSpy: false, eliminated: false },
  { id: 'd', studentName: 'D', isSpy: false, eliminated: true },
];

describe('getActiveParticipants', () => {
  it('filters eliminated ids', () => {
    const active = getActiveParticipants(participants, ['d']);
    expect(active.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('filters participant.eliminated flag', () => {
    const active = getActiveParticipants(
      [{ id: 'x', eliminated: true }, { id: 'y', eliminated: false }],
      [],
    );
    expect(active.map((p) => p.id)).toEqual(['y']);
  });
});

describe('tallySpyVotes', () => {
  const votes = [
    { targetStudentId: 'a' },
    { targetStudentId: 'b' },
    { targetStudentId: 'b' },
    { targetStudentId: 'd' },
  ];

  it('ignores eliminated targets and returns top candidates', () => {
    const { tally, topCandidates, topCount } = tallySpyVotes(votes, participants, ['d']);
    expect(tally.map((r) => r.studentId)).toEqual(['b', 'a']);
    expect(topCount).toBe(2);
    expect(topCandidates).toHaveLength(1);
    expect(topCandidates[0].studentId).toBe('b');
  });

  it('handles tie at top', () => {
    const tiedVotes = [
      { targetStudentId: 'a' },
      { targetStudentId: 'c' },
    ];
    const { topCandidates, topCount } = tallySpyVotes(tiedVotes, participants, ['d']);
    expect(topCount).toBe(1);
    expect(topCandidates).toHaveLength(2);
  });
});

describe('votesChangedFromBaseline', () => {
  it('returns false when votes match baseline', () => {
    const votes = [
      { voterId: 'a', targetStudentId: 'b' },
      { voterId: 'c', targetStudentId: 'b' },
    ];
    expect(votesChangedFromBaseline(votes, { a: 'b', c: 'b' })).toBe(false);
  });

  it('returns true when a target changed', () => {
    const votes = [
      { voterId: 'a', targetStudentId: 'c' },
      { voterId: 'c', targetStudentId: 'b' },
    ];
    expect(votesChangedFromBaseline(votes, { a: 'b', c: 'b' })).toBe(true);
  });

  it('returns true when voter count differs', () => {
    expect(votesChangedFromBaseline(
      [{ voterId: 'a', targetStudentId: 'b' }],
      { a: 'b', c: 'b' },
    )).toBe(true);
  });
});

describe('normalizeSpySession tie fields', () => {
  it('normalizes tie debate and lastTieBreak', () => {
    const session = normalizeSpySession('s1', {
      classCode: 'PY101',
      status: 'tie_debate',
      tieCandidateIds: ['a', 'c'],
      tieDebateIndex: 1,
      tieRevoteBaseline: { a: 'c', b: 'a' },
      lastTieBreak: {
        candidateIds: ['a', 'c'],
        pickedId: 'c',
        pickedName: 'C',
        method: 'random',
        votesChanged: false,
      },
    });
    expect(session.status).toBe('tie_debate');
    expect(session.tieCandidateIds).toEqual(['a', 'c']);
    expect(session.tieDebateIndex).toBe(1);
    expect(session.tieRevoteBaseline).toEqual({ a: 'c', b: 'a' });
    expect(session.lastTieBreak.pickedId).toBe('c');
    expect(session.lastTieBreak.votesChanged).toBe(false);
  });

  it('normalizes crew fields', () => {
    const session = normalizeSpySession('crew-1', {
      mode: 'crew',
      status: 'playing',
      taskPerPlayer: 5,
      crewTaskTarget: 10,
      sabotageActive: true,
      sabotageById: 'b',
      reportedByIds: ['a'],
      meetingOpenedBy: 'report',
      meetingReporterId: 'a',
    });
    expect(session.mode).toBe('crew');
    expect(session.status).toBe('playing');
    expect(session.crewTaskTarget).toBe(10);
    expect(session.sabotageActive).toBe(true);
    expect(session.reportedByIds).toEqual(['a']);
  });
});

describe('getCurrentSpeaker', () => {
  it('returns describe speaker', () => {
    expect(getCurrentSpeaker({
      status: 'describe',
      describeOrder: ['a', 'b'],
      describeIndex: 1,
    })).toBe('b');
  });

  it('returns tie debate speaker', () => {
    expect(getCurrentSpeaker({
      status: 'tie_debate',
      tieCandidateIds: ['a', 'c'],
      tieDebateIndex: 0,
    })).toBe('a');
  });
});

describe('evaluateSpyOutcome', () => {
  it('civilians win when no spies remain', () => {
    const active = [
      { id: '1', isSpy: false },
      { id: '2', isSpy: false },
    ];
    expect(evaluateSpyOutcome(active)).toBe('civilians');
  });

  it('spies win when civilians <= spies', () => {
    const active = [
      { id: '1', isSpy: true },
      { id: '2', isSpy: false },
    ];
    expect(evaluateSpyOutcome(active)).toBe('spies');
  });

  it('returns null when game continues', () => {
    const active = [
      { id: '1', isSpy: true },
      { id: '2', isSpy: false },
      { id: '3', isSpy: false },
    ];
    expect(evaluateSpyOutcome(active)).toBeNull();
  });
});

describe('getDescribeRoundTotal', () => {
  it('uses configured total before first vote', () => {
    expect(getDescribeRoundTotal({ voteRound: 0, describeRoundTotal: 3 })).toBe(3);
  });

  it('uses one round after elimination vote', () => {
    expect(getDescribeRoundTotal({ voteRound: 2, describeRoundTotal: 3 })).toBe(1);
  });
});

describe('pickFairSpyIds', () => {
  it('avoids students already picked 3 times when possible', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const counts = { a: 3, b: 3, c: 1, d: 0 };
    for (let i = 0; i < 20; i += 1) {
      const picked = pickFairSpyIds(ids, 1, counts);
      expect(picked).toHaveLength(1);
      expect(['c', 'd']).toContain(picked[0]);
    }
  });
});

describe('shouldSkipSpyVoteRound', () => {
  it('skips when blank votes tie or beat player votes', () => {
    const votes = [
      { targetStudentId: SPY_BLANK_VOTE_ID },
      { targetStudentId: SPY_BLANK_VOTE_ID },
      { targetStudentId: 'a' },
    ];
    expect(shouldSkipSpyVoteRound(votes, participants, ['d'])).toBe(true);
  });

  it('does not skip when a player clearly wins', () => {
    const votes = [
      { targetStudentId: SPY_BLANK_VOTE_ID },
      { targetStudentId: 'a' },
      { targetStudentId: 'a' },
    ];
    expect(shouldSkipSpyVoteRound(votes, participants, ['d'])).toBe(false);
  });
});

describe('pickCrewSabotageVictim', () => {
  it('never picks the sabotaging spy', () => {
    const active = [
      { id: 'spy', isSpy: true },
      { id: 'a', isSpy: false },
      { id: 'b', isSpy: false },
    ];
    for (let i = 0; i < 20; i += 1) {
      const victim = pickCrewSabotageVictim(active, 'spy');
      expect(victim.id).not.toBe('spy');
    }
  });

  it('never picks another spy', () => {
    const active = [
      { id: 'spy1', isSpy: true },
      { id: 'spy2', isSpy: true },
      { id: 'a', isSpy: false },
    ];
    for (let i = 0; i < 20; i += 1) {
      const victim = pickCrewSabotageVictim(active, 'spy1');
      expect(victim.isSpy).not.toBe(true);
    }
  });

  it('returns null when only spies remain', () => {
    expect(pickCrewSabotageVictim(
      [{ id: 'spy1', isSpy: true }, { id: 'spy2', isSpy: true }],
      'spy1',
    )).toBeNull();
  });

  it('returns null when only sabotaging spy remains', () => {
    expect(pickCrewSabotageVictim([{ id: 'spy', isSpy: true }], 'spy')).toBeNull();
  });
});

describe('checkCrewTaskWin', () => {
  it('counts civilian progress even after elimination', () => {
    const session = { mode: 'crew', crewTaskTarget: 5, eliminatedIds: ['c'] };
    const progress = [
      { id: 'a', completedCount: 2 },
      { id: 'b', completedCount: 99 },
      { id: 'c', completedCount: 3 },
    ];
    // a(2) + c(3) = 5, spy b ignored
    expect(checkCrewTaskWin(session, participants, progress)).toBe(true);
  });

  it('returns true when civilian target reached', () => {
    const session = { mode: 'crew', crewTaskTarget: 4, eliminatedIds: [] };
    const progress = [
      { id: 'a', completedCount: 2 },
      { id: 'b', completedCount: 99 },
      { id: 'c', completedCount: 2 },
    ];
    expect(checkCrewTaskWin(session, participants, progress)).toBe(true);
  });
});

describe('lobby roster readiness', () => {
  it('is ready only when joined matches present exactly', () => {
    expect(isSpyLobbyRosterReady(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(true);
    expect(isSpyLobbyRosterReady(['a', 'b'], ['a', 'b', 'c'])).toBe(false);
    expect(isSpyLobbyRosterReady([], ['a', 'b', 'c'])).toBe(false);
  });

  it('blocks roster edits outside lobby or when removing joined players', () => {
    expect(validateSpyPresentRosterChange({
      status: 'playing',
      impostorCount: 1,
      presentStudentIds: ['a', 'b', 'c'],
      joinedIds: ['a'],
    })).toMatch(/lobby/i);

    expect(validateSpyPresentRosterChange({
      status: 'lobby',
      impostorCount: 1,
      presentStudentIds: ['a', 'b', 'd'],
      joinedIds: ['a', 'c'],
    })).toMatch(/đã vào phòng/i);

    expect(validateSpyPresentRosterChange({
      status: 'lobby',
      impostorCount: 1,
      presentStudentIds: ['a', 'b', 'c'],
      joinedIds: ['a', 'b'],
    })).toBeNull();
  });
});
