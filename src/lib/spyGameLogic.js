import {
  SPY_BLANK_VOTE_ID,
  SPY_MAX_SPY_ASSIGNMENTS_PER_PLAYER,
} from './spyConstants.js';

export function fisherYatesShuffle(ids) {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function normalizeSpyAssignmentCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const counts = {};
  for (const [studentId, value] of Object.entries(raw)) {
    const n = Number(value);
    if (studentId && Number.isFinite(n) && n > 0) counts[studentId] = Math.floor(n);
  }
  return counts;
}

/** Chọn gián điệp — không chọn quá 3 lần/người trừ khi không còn lựa chọn khác. */
export function pickFairSpyIds(participantIds, impostorCount, assignmentCounts = {}) {
  const need = Math.max(1, Number(impostorCount) || 1);
  const ids = [...new Set(participantIds.filter(Boolean))];
  if (!ids.length) return [];

  const counts = normalizeSpyAssignmentCounts(assignmentCounts);
  let eligible = ids.filter((id) => (counts[id] || 0) < SPY_MAX_SPY_ASSIGNMENTS_PER_PLAYER);
  if (eligible.length < need) {
    const minCount = Math.min(...ids.map((id) => counts[id] || 0));
    eligible = ids.filter((id) => (counts[id] || 0) <= minCount);
  }

  return fisherYatesShuffle(eligible).slice(0, need);
}

export function bumpSpyAssignmentCounts(assignmentCounts, spyIds) {
  const next = { ...normalizeSpyAssignmentCounts(assignmentCounts) };
  for (const id of spyIds) {
    next[id] = (next[id] || 0) + 1;
  }
  return next;
}

export function getActiveParticipants(participants = [], eliminatedIds = []) {
  const eliminated = new Set(eliminatedIds || []);
  return participants.filter((p) => !eliminated.has(p.id) && !p.eliminated);
}

export function evaluateSpyOutcome(activeParticipants) {
  const spies = activeParticipants.filter((p) => p.isSpy);
  const civilians = activeParticipants.filter((p) => !p.isSpy);
  if (spies.length === 0) return 'civilians';
  if (civilians.length <= spies.length) return 'spies';
  return null;
}

export function checkSpyWinOutcome(activeParticipants) {
  return evaluateSpyOutcome(activeParticipants);
}

/** @param {Array<{ id: string }>} activeParticipants */
export function pickCrewSabotageVictim(activeParticipants, spyId) {
  const candidates = activeParticipants.filter((p) => p.id !== spyId && !p.isSpy);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function tallySpyVotes(votes = [], participants = [], eliminatedIds = []) {
  const eliminated = new Set(eliminatedIds || []);
  const activeIds = new Set(
    participants.filter((p) => !eliminated.has(p.id)).map((p) => p.id),
  );
  const counts = new Map();
  let blankCount = 0;
  for (const vote of votes) {
    const id = vote.targetStudentId;
    if (id === SPY_BLANK_VOTE_ID) {
      blankCount += 1;
      continue;
    }
    if (!activeIds.has(id)) continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const nameById = new Map(participants.map((p) => [p.id, p.studentName]));
  const tally = [...counts.entries()]
    .map(([studentId, count]) => ({
      studentId,
      studentName: nameById.get(studentId) || studentId,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.studentName.localeCompare(b.studentName, 'vi'));

  const topCount = tally[0]?.count ?? 0;
  const topCandidates = topCount > 0
    ? tally.filter((row) => row.count === topCount)
    : [];

  return { tally, topCandidates, topCount, blankCount };
}

export function shouldSkipSpyVoteRound(votes = [], participants = [], eliminatedIds = []) {
  const blankCount = votes.filter((vote) => vote.targetStudentId === SPY_BLANK_VOTE_ID).length;
  if (!blankCount) return false;
  const { tally } = tallySpyVotes(votes, participants, eliminatedIds);
  const topPlayerCount = tally[0]?.count ?? 0;
  return blankCount >= topPlayerCount;
}

export function votesChangedFromBaseline(votes = [], baseline = {}) {
  const current = {};
  for (const vote of votes) {
    if (vote?.voterId && vote?.targetStudentId) {
      current[vote.voterId] = vote.targetStudentId;
    }
  }
  const baselineKeys = Object.keys(baseline || {});
  const currentKeys = Object.keys(current);
  if (baselineKeys.length !== currentKeys.length) return true;
  for (const voterId of baselineKeys) {
    if (current[voterId] !== baseline[voterId]) return true;
  }
  return false;
}

export function checkCrewTaskWin(session, participants = [], progressRows = []) {
  if (!session || session.mode !== 'crew') return false;
  const target = Number(session.crewTaskTarget || 0);
  if (target <= 0) return false;
  if (Number(session.crewTeamCompleted) >= target) return true;
  const progressById = new Map(progressRows.map((row) => [row.id, row]));
  let total = 0;
  for (const participant of participants) {
    if (participant.isSpy) continue;
    total += Number(progressById.get(participant.id)?.completedCount || 0);
  }
  return total >= target;
}

/** @returns {{ studentId: string, studentName: string, completedCount: number }[]} */
export function rankCrewMvp(participants = [], progressRows = []) {
  const progressById = new Map(progressRows.map((row) => [row.id, row]));
  return participants
    .filter((p) => !p.isSpy)
    .map((p) => ({
      studentId: p.id,
      studentName: p.studentName || p.id,
      completedCount: Number(progressById.get(p.id)?.completedCount || 0),
    }))
    .sort((a, b) => b.completedCount - a.completedCount
      || a.studentName.localeCompare(b.studentName, 'vi'));
}

export function isSpyLobbyRosterReady(participantIds = [], presentStudentIds = []) {
  const present = [...new Set((presentStudentIds || []).filter(Boolean))];
  const joined = [...new Set((participantIds || []).filter(Boolean))];
  if (!present.length || joined.length !== present.length) return false;
  const presentSet = new Set(present);
  return joined.every((id) => presentSet.has(id));
}

export function validateSpyPresentRosterChange({
  status,
  impostorCount,
  presentStudentIds,
  joinedIds = [],
} = {}) {
  if (status !== 'lobby') return 'Chỉ sửa danh sách có mặt khi đang ở lobby.';
  const present = [...new Set((presentStudentIds || []).filter(Boolean))];
  if (present.length < Number(impostorCount) + 2) {
    return 'Cần đủ học sinh có mặt (ít nhất 2 dân + số gián điệp).';
  }
  const presentSet = new Set(present);
  if ((joinedIds || []).some((id) => !presentSet.has(id))) {
    return 'Không thể bỏ khỏi điểm danh người đã vào phòng.';
  }
  return null;
}

export function assertSpyLobbyRosterMatched(participantIds, presentStudentIds, impostorCount) {
  const minPlayers = Number(impostorCount) + 2;
  if ((participantIds || []).length < minPlayers) {
    throw new Error(`Cần ít nhất ${minPlayers} học sinh vào phòng.`);
  }
  if (!isSpyLobbyRosterReady(participantIds, presentStudentIds)) {
    throw new Error(
      'Chưa đủ người trong danh sách có mặt vào phòng. Đồng bộ theo người đã vào hoặc đợi thêm.',
    );
  }
}

export function getCurrentSpeaker(session) {
  if (!session) return null;
  if (session.status === 'describe') {
    return session.describeOrder?.[session.describeIndex] || null;
  }
  if (session.status === 'tie_debate') {
    return session.tieCandidateIds?.[session.tieDebateIndex] || null;
  }
  return null;
}

export function getTieDebateSpeakerName(session, participants = []) {
  const speakerId = getCurrentSpeaker(session);
  if (!speakerId) return '';
  return participants.find((p) => p.id === speakerId)?.studentName || '';
}

export function getTieDebateEndsAtMs(session) {
  const endsAt = session?.tieDebateEndsAt;
  if (!endsAt) return null;
  if (typeof endsAt.toMillis === 'function') return endsAt.toMillis();
  if (endsAt instanceof Date) return endsAt.getTime();
  if (typeof endsAt.seconds === 'number') return endsAt.seconds * 1000;
  return null;
}

export function getDescribeRoundTotal(session) {
  if (!session) return 1;
  return session.voteRound === 0 ? session.describeRoundTotal : 1;
}
