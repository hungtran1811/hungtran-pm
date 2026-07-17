import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import {
  SPY_ACTIVE_STATUSES,
  SPY_BLANK_VOTE_ID,
  SPY_CREW_VOTE_RESOLVE_SECONDS,
  SPY_MAX_SPY_ASSIGNMENTS_PER_PLAYER,
  SPY_SABOTAGE_COOLDOWN_MAX_SECONDS,
  SPY_SABOTAGE_COOLDOWN_MIN_SECONDS,
  SPY_TIE_DEBATE_SECONDS,
} from '../lib/spyConstants.js';
import { validateWordPair } from '../data/spyWordBank.js';

const SESSIONS = 'spySessions';

function sessionsRef() {
  return collection(db, SESSIONS);
}

function sessionRef(sessionId) {
  return doc(db, SESSIONS, sessionId);
}

function participantsRef(sessionId) {
  return collection(db, SESSIONS, sessionId, 'participants');
}

function participantRef(sessionId, studentId) {
  return doc(db, SESSIONS, sessionId, 'participants', studentId);
}

function votesRef(sessionId) {
  return collection(db, SESSIONS, sessionId, 'votes');
}

function voteRef(sessionId, voterId) {
  return doc(db, SESSIONS, sessionId, 'votes', voterId);
}

function taskProgressRef(sessionId, studentId) {
  return doc(db, SESSIONS, sessionId, 'taskProgress', studentId);
}

function taskProgressCollectionRef(sessionId) {
  return collection(db, SESSIONS, sessionId, 'taskProgress');
}

function classDocRef(classCode) {
  return doc(db, 'classes', classCode);
}

function sessionBump(fields = {}) {
  return { ...fields, stateVersion: increment(1) };
}

function fisherYatesShuffle(ids) {
  const arr = [...ids];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeSpyAssignmentCounts(raw) {
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

function bumpSpyAssignmentCounts(assignmentCounts, spyIds) {
  const next = { ...normalizeSpyAssignmentCounts(assignmentCounts) };
  for (const id of spyIds) {
    next[id] = (next[id] || 0) + 1;
  }
  return next;
}

export function shouldSkipSpyVoteRound(votes = [], participants = [], eliminatedIds = []) {
  const blankCount = votes.filter((vote) => vote.targetStudentId === SPY_BLANK_VOTE_ID).length;
  if (!blankCount) return false;
  const { tally } = tallySpyVotes(votes, participants, eliminatedIds);
  const topPlayerCount = tally[0]?.count ?? 0;
  return blankCount >= topPlayerCount;
}

export function getActiveParticipants(participants = [], eliminatedIds = []) {
  const eliminated = new Set(eliminatedIds || []);
  return participants.filter((p) => !eliminated.has(p.id) && !p.eliminated);
}

function normalizeTieRevoteBaseline(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [voterId, targetId] of Object.entries(raw)) {
    if (typeof voterId === 'string' && typeof targetId === 'string' && targetId) {
      out[voterId] = targetId;
    }
  }
  return out;
}

function normalizeLastTieBreak(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    candidateIds: Array.isArray(raw.candidateIds) ? raw.candidateIds.filter(Boolean) : [],
    pickedId: raw.pickedId || '',
    pickedName: raw.pickedName || '',
    method: raw.method === 'random' ? 'random' : 'random',
    votesChanged: Boolean(raw.votesChanged),
  };
}

function normalizeStringList(raw) {
  return Array.isArray(raw) ? raw.filter((v) => typeof v === 'string' && v) : [];
}

export function normalizeSpySession(id, data) {
  if (!data) return null;
  return {
    id,
    classCode: data.classCode || '',
    status: data.status || 'draft',
    stateVersion: Number(data.stateVersion) || 0,
    impostorCount: Number(data.impostorCount) || 1,
    presentStudentIds: Array.isArray(data.presentStudentIds) ? data.presentStudentIds : [],
    activePlayerIds: Array.isArray(data.activePlayerIds) ? data.activePlayerIds : [],
    describeOrder: Array.isArray(data.describeOrder) ? data.describeOrder : [],
    describeIndex: Number(data.describeIndex) || 0,
    describeRoundTotal: Math.min(20, Math.max(1, Number(data.describeRoundTotal) || 1)),
    describeRoundCurrent: Math.max(1, Number(data.describeRoundCurrent) || 1),
    eliminatedIds: Array.isArray(data.eliminatedIds) ? data.eliminatedIds : [],
    voteRound: Number(data.voteRound) || 0,
    lastEliminatedId: data.lastEliminatedId || '',
    outcome: data.outcome || null,
    civilianWord: data.civilianWord || '',
    spyWord: data.spyWord || '',
    revealedSpyIds: Array.isArray(data.revealedSpyIds) ? data.revealedSpyIds : [],
    tieCandidateIds: Array.isArray(data.tieCandidateIds) ? data.tieCandidateIds : [],
    tieDebateIndex: Number(data.tieDebateIndex) || 0,
    tieDebateEndsAt: data.tieDebateEndsAt || null,
    tieRevoteBaseline: normalizeTieRevoteBaseline(data.tieRevoteBaseline),
    lastTieBreak: normalizeLastTieBreak(data.lastTieBreak),
    mode: data.mode === 'crew' ? 'crew' : 'word',
    taskPerPlayer: Number(data.taskPerPlayer) || 5,
    crewTaskTarget: Number(data.crewTaskTarget) || 0,
    crewTaskExtraById: data.crewTaskExtraById && typeof data.crewTaskExtraById === 'object'
      ? Object.fromEntries(
        Object.entries(data.crewTaskExtraById)
          .filter(([k, v]) => typeof k === 'string' && Number(v) > 0)
          .map(([k, v]) => [k, Number(v)]),
      )
      : {},
    sabotageActive: Boolean(data.sabotageActive),
    sabotageById: data.sabotageById || '',
    sabotageAt: data.sabotageAt || null,
    sabotageCooldownUntil: data.sabotageCooldownUntil || null,
    reportedByIds: normalizeStringList(data.reportedByIds),
    meetingOpenedBy: ['report', 'admin', 'sabotage'].includes(data.meetingOpenedBy)
      ? data.meetingOpenedBy
      : '',
    meetingReporterId: data.meetingReporterId || '',
    crewVoteResolveEndsAt: data.crewVoteResolveEndsAt || null,
    crewEliminationAnnounceUntil: data.crewEliminationAnnounceUntil || null,
    crewSkipVoteAnnounceUntil: data.crewSkipVoteAnnounceUntil || null,
    spyAssignmentCounts: normalizeSpyAssignmentCounts(data.spyAssignmentCounts),
    createdAt: data.createdAt || null,
    startedAt: data.startedAt || null,
    finishedAt: data.finishedAt || null,
  };
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

function clearTieFields() {
  return {
    tieCandidateIds: [],
    tieDebateIndex: 0,
    tieDebateEndsAt: null,
    tieRevoteBaseline: {},
  };
}

function clearCrewRoundFields() {
  return {
    sabotageActive: false,
    sabotageById: '',
    sabotageAt: null,
    meetingOpenedBy: '',
    meetingReporterId: '',
    crewVoteResolveEndsAt: null,
    crewSkipVoteAnnounceUntil: null,
  };
}

function tieDebateEndsAtFromNow(seconds = SPY_TIE_DEBATE_SECONDS) {
  return Timestamp.fromMillis(Date.now() + seconds * 1000);
}

export function randomSabotageCooldownSeconds() {
  const span = SPY_SABOTAGE_COOLDOWN_MAX_SECONDS - SPY_SABOTAGE_COOLDOWN_MIN_SECONDS + 1;
  return SPY_SABOTAGE_COOLDOWN_MIN_SECONDS + Math.floor(Math.random() * span);
}

function sabotageCooldownUntilFromNow(seconds = randomSabotageCooldownSeconds()) {
  return Timestamp.fromMillis(Date.now() + seconds * 1000);
}

function countActivePlayersFromSession(session) {
  const eliminated = new Set(session.eliminatedIds || []);
  const ids = session.activePlayerIds?.length
    ? session.activePlayerIds
    : (session.presentStudentIds || []);
  return ids.filter((id) => !eliminated.has(id)).length;
}

function withPostVoteSabotageCooldown(fields) {
  return {
    ...fields,
    sabotageCooldownUntil: sabotageCooldownUntilFromNow(),
  };
}

/** @param {Array<{ id: string }>} activeParticipants */
export function pickCrewSabotageVictim(activeParticipants, spyId) {
  const candidates = activeParticipants.filter((p) => p.id !== spyId);
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Chia nhiệm vụ còn lại của người bị loại đều cho dân thường còn sống.
 * @returns {{ studentId: string, extra: number }[]}
 */
export function planCrewTaskRedistribution({
  eliminatedId,
  participants = [],
  progressRows = [],
  eliminatedIds = [],
  taskPerPlayer = 5,
  existingExtras = {},
}) {
  const progressById = new Map((progressRows || []).map((row) => [row.id, row]));
  const victimProgress = progressById.get(eliminatedId);
  const victimExtra = Number(existingExtras?.[eliminatedId] || 0);
  const victimTotal = Number(
    victimProgress?.total
    || (Number(taskPerPlayer) || 5) + victimExtra,
  );
  const unfinished = Math.max(0, victimTotal - Number(victimProgress?.completedCount || 0));
  if (unfinished <= 0) return [];

  const eliminated = new Set(eliminatedIds || []);
  const receivers = (participants || []).filter(
    (p) => !p.isSpy && !eliminated.has(p.id) && !p.eliminated,
  );
  if (!receivers.length) return [];

  const base = Math.floor(unfinished / receivers.length);
  let remainder = unfinished % receivers.length;
  return receivers.map((p) => {
    const extra = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return { studentId: p.id, extra };
  }).filter((row) => row.extra > 0);
}

export function mergeCrewTaskExtras(existingExtras = {}, additions = []) {
  const next = { ...(existingExtras || {}) };
  for (const row of additions) {
    if (!row?.studentId || !row.extra) continue;
    next[row.studentId] = Number(next[row.studentId] || 0) + Number(row.extra || 0);
  }
  return next;
}

export function getCrewTaskTotalForStudent(session, studentId, progressRow = null) {
  const base = Number(progressRow?.total)
    || Number(session?.taskPerPlayer || 5)
    || 5;
  const extra = Number(session?.crewTaskExtraById?.[studentId] || 0);
  // progress.total có thể đã được ghi khi extra tăng; lấy max để không bị tụt.
  return Math.max(base, Number(session?.taskPerPlayer || 5) + extra);
}

export function normalizeSpyParticipant(id, data) {
  if (!data) return null;
  return {
    id,
    studentName: data.studentName || '',
    joinedAt: data.joinedAt || null,
    assignedWord: data.assignedWord || '',
    isSpy: Boolean(data.isSpy),
    eliminated: Boolean(data.eliminated),
  };
}

export function normalizeSpyVote(id, data) {
  if (!data) return null;
  return {
    id,
    voterId: id,
    targetStudentId: data.targetStudentId || '',
    votedAt: data.votedAt || null,
  };
}

export function normalizeSpyTaskProgress(id, data) {
  if (!data) return null;
  return {
    id,
    total: Number(data.total) || 0,
    completedCount: Number(data.completedCount) || 0,
    updatedAt: data.updatedAt || null,
  };
}

function checkSpyWinOutcome(activeParticipants) {
  return evaluateSpyOutcome(activeParticipants);
}

export function evaluateSpyOutcome(activeParticipants) {
  const spies = activeParticipants.filter((p) => p.isSpy);
  const civilians = activeParticipants.filter((p) => !p.isSpy);
  if (spies.length === 0) return 'civilians';
  if (civilians.length <= spies.length) return 'spies';
  return null;
}


async function setClassActiveSpyPointer(classCode, sessionId) {
  if (!classCode) return;
  try {
    await updateDoc(classDocRef(classCode), { activeSpySessionId: sessionId });
  } catch (error) {
    console.warn('[spy.service] Failed to set class active session pointer', error);
  }
}

async function clearClassActiveSpyPointer(classCode, sessionId) {
  if (!classCode) return;
  try {
    const snap = await getDoc(classDocRef(classCode));
    if (snap.exists() && snap.data().activeSpySessionId === sessionId) {
      await updateDoc(classDocRef(classCode), { activeSpySessionId: null });
    }
  } catch (error) {
    console.warn('[spy.service] Failed to clear class active session pointer', error);
  }
}

export async function createSpySession({
  classCode,
  presentStudentIds,
  impostorCount,
  describeRoundTotal = 1,
  mode = 'word',
  taskPerPlayer = 5,
}) {
  if (!classCode) throw new Error('Chọn lớp trước.');
  const present = [...new Set(presentStudentIds || [])];
  if (present.length < impostorCount + 2) {
    throw new Error('Cần đủ học sinh có mặt (ít nhất 2 dân + số gián điệp).');
  }

  const rounds = Math.min(20, Math.max(1, Number(describeRoundTotal) || 1));

  const sessionDoc = await addDoc(sessionsRef(), {
    classCode,
    status: 'draft',
    mode: mode === 'crew' ? 'crew' : 'word',
    impostorCount: Number(impostorCount) || 1,
    presentStudentIds: present,
    activePlayerIds: [],
    describeRoundTotal: rounds,
    describeRoundCurrent: 1,
    describeOrder: [],
    describeIndex: 0,
    eliminatedIds: [],
    voteRound: 0,
    lastEliminatedId: '',
    outcome: null,
    civilianWord: '',
    spyWord: '',
    revealedSpyIds: [],
    tieCandidateIds: [],
    tieDebateIndex: 0,
    tieDebateEndsAt: null,
    tieRevoteBaseline: {},
    lastTieBreak: null,
    taskPerPlayer: Math.min(20, Math.max(1, Number(taskPerPlayer) || 5)),
    crewTaskTarget: 0,
    sabotageActive: false,
    sabotageById: '',
    sabotageAt: null,
    sabotageCooldownUntil: null,
    reportedByIds: [],
    meetingOpenedBy: '',
    meetingReporterId: '',
    spyAssignmentCounts: {},
    stateVersion: 0,
    createdAt: serverTimestamp(),
    startedAt: null,
    finishedAt: null,
  });

  return sessionDoc.id;
}

export async function openSpyLobby(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  await updateDoc(sessionRef(sessionId), sessionBump({ status: 'lobby' }));
  await setClassActiveSpyPointer(snap.data().classCode, sessionId);
}

export async function syncSpyClassPointer(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) return;
  const { classCode, status } = snap.data();
  if (SPY_ACTIVE_STATUSES.includes(status)) {
    await setClassActiveSpyPointer(classCode, sessionId);
  } else {
    await clearClassActiveSpyPointer(classCode, sessionId);
  }
}

export async function joinSpySession(sessionId, { studentId, studentName }) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = sessionSnap.data();
  if (session.status !== 'lobby') throw new Error('Phòng không còn mở để tham gia.');
  const present = session.presentStudentIds || [];
  if (!present.includes(studentId)) {
    throw new Error('Bạn không nằm trong danh sách có mặt. Nhờ giáo viên tick điểm danh.');
  }

  const existing = await getDoc(participantRef(sessionId, studentId));
  if (existing.exists()) return;

  await setDoc(participantRef(sessionId, studentId), {
    studentName,
    joinedAt: serverTimestamp(),
    assignedWord: '',
    isSpy: false,
    eliminated: false,
  });
}

export async function startSpyGame(sessionId, { civilianWord, spyWord }) {
  const validated = validateWordPair(civilianWord, spyWord);
  if (validated.error) throw new Error(validated.error);

  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = sessionSnap.data();
  if (session.status !== 'lobby') throw new Error('Chỉ bắt đầu từ phòng chờ.');

  const partsSnap = await getDocs(participantsRef(sessionId));
  const participantIds = partsSnap.docs.map((d) => d.id);
  const minPlayers = Number(session.impostorCount) + 2;
  if (participantIds.length < minPlayers) {
    throw new Error(`Cần ít nhất ${minPlayers} học sinh vào phòng.`);
  }

  const presentSet = new Set(session.presentStudentIds || []);
  if (!participantIds.every((id) => presentSet.has(id))) {
    throw new Error('Có người chơi không nằm trong danh sách có mặt.');
  }

  const shuffled = fisherYatesShuffle(participantIds);
  const spyIds = new Set(pickFairSpyIds(participantIds, session.impostorCount, session.spyAssignmentCounts));
  const describeOrder = fisherYatesShuffle(participantIds);

  const batch = writeBatch(db);
  partsSnap.docs.forEach((partDoc) => {
    const isSpy = spyIds.has(partDoc.id);
    batch.update(participantRef(sessionId, partDoc.id), {
      isSpy,
      assignedWord: isSpy ? validated.spy : validated.civilian,
      eliminated: false,
    });
  });

  batch.update(sessionRef(sessionId), sessionBump({
    status: 'describe',
    describeOrder,
    describeIndex: 0,
    activePlayerIds: participantIds,
    describeRoundCurrent: 1,
    eliminatedIds: [],
    voteRound: 0,
    lastEliminatedId: '',
    outcome: null,
    civilianWord: validated.civilian,
    spyWord: validated.spy,
    revealedSpyIds: [],
    spyAssignmentCounts: bumpSpyAssignmentCounts(session.spyAssignmentCounts, [...spyIds]),
    ...clearTieFields(),
    lastTieBreak: null,
    startedAt: serverTimestamp(),
  }));

  await batch.commit();
}

export async function startCrewGame(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.status !== 'lobby') throw new Error('Chỉ bắt đầu từ phòng chờ.');

  const partsSnap = await getDocs(participantsRef(sessionId));
  const participantIds = partsSnap.docs.map((d) => d.id);
  const minPlayers = Number(session.impostorCount) + 2;
  if (participantIds.length < minPlayers) {
    throw new Error(`Cần ít nhất ${minPlayers} học sinh vào phòng.`);
  }

  const presentSet = new Set(session.presentStudentIds || []);
  if (!participantIds.every((id) => presentSet.has(id))) {
    throw new Error('Có người chơi không nằm trong danh sách có mặt.');
  }

  const spyIds = new Set(pickFairSpyIds(participantIds, session.impostorCount, session.spyAssignmentCounts));
  const civilianCount = participantIds.length - spyIds.size;

  const batch = writeBatch(db);
  partsSnap.docs.forEach((partDoc) => {
    const isSpy = spyIds.has(partDoc.id);
    batch.update(participantRef(sessionId, partDoc.id), {
      isSpy,
      assignedWord: '',
      eliminated: false,
    });
    batch.set(taskProgressRef(sessionId, partDoc.id), {
      total: session.taskPerPlayer,
      completedCount: 0,
      updatedAt: serverTimestamp(),
    });
  });

  batch.update(sessionRef(sessionId), sessionBump({
    status: 'playing',
    activePlayerIds: participantIds,
    describeOrder: [],
    describeIndex: 0,
    describeRoundCurrent: 1,
    eliminatedIds: [],
    voteRound: 0,
    lastEliminatedId: '',
    outcome: null,
    civilianWord: '',
    spyWord: '',
    revealedSpyIds: [],
    taskPerPlayer: session.taskPerPlayer,
    crewTaskTarget: civilianCount * session.taskPerPlayer,
    crewTaskExtraById: {},
    sabotageCooldownUntil: null,
    reportedByIds: [],
    spyAssignmentCounts: bumpSpyAssignmentCounts(session.spyAssignmentCounts, [...spyIds]),
    ...clearTieFields(),
    ...clearCrewRoundFields(),
    lastTieBreak: null,
    startedAt: serverTimestamp(),
  }));

  await batch.commit();
}

export async function advanceSpyDescribe(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(snap.id, snap.data());
  if (session.status !== 'describe') throw new Error('Không trong vòng mô tả.');

  const order = session.describeOrder || [];
  const nextIndex = Number(session.describeIndex) + 1;

  if (nextIndex < order.length) {
    await updateDoc(sessionRef(sessionId), sessionBump({ describeIndex: nextIndex }));
    return { advanced: true, phase: 'describe', describeIndex: nextIndex };
  }

  const roundTotal = session.voteRound === 0
    ? session.describeRoundTotal
    : 1;

  if (session.describeRoundCurrent < roundTotal) {
    await updateDoc(sessionRef(sessionId), sessionBump({
      describeRoundCurrent: session.describeRoundCurrent + 1,
      describeIndex: 0,
      describeOrder: fisherYatesShuffle(order),
    }));
    return { advanced: true, phase: 'describe', describeRoundCurrent: session.describeRoundCurrent + 1 };
  }

  return { advanced: false, phase: 'describe', roundComplete: true };
}

export async function openSpyVote(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(snap.id, snap.data());
  if (session.status !== 'describe') throw new Error('Chưa xong vòng mô tả.');
  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'vote',
    voteRound: session.voteRound + 1,
    ...clearCrewRoundFields(),
    lastTieBreak: null,
    crewEliminationAnnounceUntil: null,
    crewVoteResolveEndsAt: null,
    ...clearTieFields(),
  }));
}

export async function openSpyMeeting(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(snap.id, snap.data());
  if (session.status !== 'playing') throw new Error('Chưa ở chế độ nhiệm vụ.');
  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'vote',
    voteRound: session.voteRound + 1,
    meetingOpenedBy: 'admin',
    meetingReporterId: '',
    sabotageActive: false,
    sabotageById: '',
    sabotageAt: null,
    lastTieBreak: null,
    crewEliminationAnnounceUntil: null,
    crewVoteResolveEndsAt: null,
    ...clearTieFields(),
  }));
}

export async function submitSpyVote(sessionId, { voterId, targetStudentId }) {
  if (!voterId || !targetStudentId) throw new Error('Chọn người nghi ngờ.');
  const isBlankVote = targetStudentId === SPY_BLANK_VOTE_ID;
  if (!isBlankVote && voterId === targetStudentId) throw new Error('Không thể vote chính mình.');

  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.status !== 'vote') throw new Error('Chưa đến lượt bỏ phiếu.');

  const eliminated = new Set(session.eliminatedIds);
  if (eliminated.has(voterId)) throw new Error('Bạn đã bị loại — không thể bỏ phiếu.');
  if (!isBlankVote && eliminated.has(targetStudentId)) throw new Error('Người này đã bị loại.');

  const voterPart = await getDoc(participantRef(sessionId, voterId));
  if (!voterPart.exists()) throw new Error('Bạn chưa vào phòng.');
  if (!isBlankVote) {
    const targetPart = await getDoc(participantRef(sessionId, targetStudentId));
    if (!targetPart.exists()) throw new Error('Người được chọn chưa vào phòng.');
  }

  const existing = await getDoc(voteRef(sessionId, voterId));
  if (existing.exists()) throw new Error('Bạn đã bỏ phiếu.');

  try {
    await setDoc(voteRef(sessionId, voterId), {
      targetStudentId,
      votedAt: serverTimestamp(),
    });
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error(isBlankVote
        ? 'Không gửi được phiếu trắng — thử tải lại trang hoặc báo giáo viên deploy rules.'
        : 'Bạn đã bỏ phiếu hoặc không có quyền.');
    }
    throw err;
  }

  try {
    await scheduleCrewVoteResolveIfReady(sessionId, { studentId: voterId });
  } catch (err) {
    console.warn('[spy.service] scheduleCrewVoteResolveIfReady failed', err);
  }
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

async function skipSpyVoteRound(sessionId, { session, participants, votesSnap }) {
  const batch = writeBatch(db);
  votesSnap.docs.forEach((voteDoc) => batch.delete(voteDoc.ref));
  const tieClear = clearTieFields();
  const announceUntil = Timestamp.fromMillis(Date.now() + SPY_CREW_VOTE_RESOLVE_SECONDS * 1000);

  if (session.mode === 'crew') {
    batch.update(sessionRef(sessionId), sessionBump(withPostVoteSabotageCooldown({
      status: 'playing',
      crewSkipVoteAnnounceUntil: announceUntil,
      crewEliminationAnnounceUntil: null,
      ...clearCrewRoundFields(),
      ...tieClear,
      lastTieBreak: null,
    })));
  } else {
    const remaining = getActiveParticipants(participants, session.eliminatedIds);
    const describeOrder = fisherYatesShuffle(remaining.map((p) => p.id));
    batch.update(sessionRef(sessionId), sessionBump({
      status: 'describe',
      activePlayerIds: remaining.map((p) => p.id),
      describeOrder,
      describeIndex: 0,
      describeRoundCurrent: 1,
      ...tieClear,
      lastTieBreak: null,
    }));
  }

  await batch.commit();
  return {
    phase: session.mode === 'crew' ? 'playing' : 'describe',
    skipped: true,
    eliminatedId: null,
    eliminatedName: null,
    outcome: null,
  };
}

export async function adminSkipCrewVoteRound(sessionId) {
  const [sessionSnap, partsSnap, votesSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDocs(participantsRef(sessionId)),
    getDocs(votesRef(sessionId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.mode !== 'crew' || session.status !== 'vote') {
    throw new Error('Chỉ bỏ qua vote khi đang họp khẩn (mode Phi hành đoàn).');
  }
  const participants = partsSnap.docs.map((d) => normalizeSpyParticipant(d.id, d.data()));
  return skipSpyVoteRound(sessionId, { session, participants, votesSnap });
}

export async function resolveSpyVoteRound(sessionId) {
  const [sessionSnap, partsSnap, votesSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDocs(participantsRef(sessionId)),
    getDocs(votesRef(sessionId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.status !== 'vote') throw new Error('Chưa trong vòng bỏ phiếu.');

  const participants = partsSnap.docs.map((d) => normalizeSpyParticipant(d.id, d.data()));
  const votes = votesSnap.docs.map((d) => normalizeSpyVote(d.id, d.data()));

  if (!votes.length) throw new Error('Chưa có phiếu nào.');

  if (shouldSkipSpyVoteRound(votes, participants, session.eliminatedIds)) {
    return skipSpyVoteRound(sessionId, { session, participants, votesSnap });
  }

  const { topCandidates } = tallySpyVotes(votes, participants, session.eliminatedIds);
  if (!topCandidates.length) throw new Error('Không có phiếu hợp lệ.');

  if (topCandidates.length > 1) {
    return beginTieDebate(sessionId, topCandidates.map((c) => c.studentId));
  }

  return applySpyElimination(sessionId, {
    session,
    participants,
    votesSnap,
    eliminatedId: topCandidates[0].studentId,
    eliminatedName: topCandidates[0].studentName,
    tied: false,
    lastTieBreak: null,
  });
}

export async function beginTieDebate(sessionId, candidateIds) {
  const ids = [...new Set((candidateIds || []).filter(Boolean))];
  if (ids.length < 2) throw new Error('Cần ít nhất 2 người hòa phiếu.');

  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(snap.id, snap.data());
  if (session.status !== 'vote' && session.status !== 'tie_debate') {
    throw new Error('Chưa trong vòng bỏ phiếu.');
  }

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'tie_debate',
    tieCandidateIds: ids,
    tieDebateIndex: 0,
    tieDebateEndsAt: tieDebateEndsAtFromNow(),
    tieRevoteBaseline: {},
    lastTieBreak: null,
  }));

  return {
    phase: 'tie_debate',
    tied: true,
    tieCandidateIds: ids,
    eliminatedId: null,
    eliminatedName: null,
    outcome: null,
  };
}

export async function advanceTieDebate(sessionId) {
  const [sessionSnap, votesSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDocs(votesRef(sessionId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.status !== 'tie_debate') throw new Error('Không trong vòng biện luận hòa.');

  const candidates = session.tieCandidateIds || [];
  if (!candidates.length) throw new Error('Không có danh sách hòa phiếu.');

  const nextIndex = session.tieDebateIndex + 1;
  if (nextIndex < candidates.length) {
    await updateDoc(sessionRef(sessionId), sessionBump({
      tieDebateIndex: nextIndex,
      tieDebateEndsAt: tieDebateEndsAtFromNow(),
    }));
    return {
      phase: 'tie_debate',
      tieDebateIndex: nextIndex,
      speakerId: candidates[nextIndex],
      openedRevote: false,
    };
  }

  const baseline = {};
  votesSnap.docs.forEach((voteDoc) => {
    const data = voteDoc.data();
    if (data?.targetStudentId) baseline[voteDoc.id] = data.targetStudentId;
  });

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'tie_revote',
    tieDebateEndsAt: null,
    tieRevoteBaseline: baseline,
  }));

  return {
    phase: 'tie_revote',
    openedRevote: true,
    speakerId: null,
  };
}

export async function changeSpyVote(sessionId, { voterId, targetStudentId }) {
  if (!voterId || !targetStudentId) throw new Error('Chọn người nghi ngờ.');
  if (voterId === targetStudentId) throw new Error('Không thể vote chính mình.');

  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.status !== 'tie_revote') throw new Error('Chỉ đổi phiếu trong vòng đổi phiếu hòa.');

  const eliminated = new Set(session.eliminatedIds);
  if (eliminated.has(voterId)) throw new Error('Bạn đã bị loại — không thể bỏ phiếu.');
  if (eliminated.has(targetStudentId)) throw new Error('Người này đã bị loại.');

  const [voterPart, targetPart, existing] = await Promise.all([
    getDoc(participantRef(sessionId, voterId)),
    getDoc(participantRef(sessionId, targetStudentId)),
    getDoc(voteRef(sessionId, voterId)),
  ]);
  if (!voterPart.exists()) throw new Error('Bạn chưa vào phòng.');
  if (!targetPart.exists()) throw new Error('Người được chọn chưa vào phòng.');
  if (!existing.exists()) throw new Error('Bạn chưa có phiếu để đổi.');

  try {
    await updateDoc(voteRef(sessionId, voterId), {
      targetStudentId,
      votedAt: serverTimestamp(),
    });
  } catch (err) {
    if (err?.code === 'permission-denied') {
      throw new Error('Không có quyền đổi phiếu.');
    }
    throw err;
  }
}

export async function submitCrewTaskProgress(sessionId, {
  studentId,
  total,
  completedCount,
}) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.mode !== 'crew' || session.status !== 'playing') {
    throw new Error('Chưa ở chế độ nhiệm vụ.');
  }
  if (!session.presentStudentIds.includes(studentId)) throw new Error('Bạn không có trong danh sách có mặt.');
  const partSnap = await getDoc(participantRef(sessionId, studentId));
  if (!partSnap.exists()) throw new Error('Bạn chưa vào phòng.');
  if (partSnap.data()?.eliminated) throw new Error('Bạn đã bị loại.');
  await setDoc(taskProgressRef(sessionId, studentId), {
    total: Math.max(1, Number(total) || session.taskPerPlayer || 1),
    completedCount: Math.max(0, Number(completedCount) || 0),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function sabotageCrewSystem(sessionId, { spyId }) {
  const [sessionSnap, partSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDoc(participantRef(sessionId, spyId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.mode !== 'crew' || session.status !== 'playing') throw new Error('Chưa ở chế độ nhiệm vụ.');
  if (session.sabotageActive) throw new Error('Hệ thống đang bị xâm nhập — chờ chuyển sang họp.');
  if (!partSnap.exists() || !partSnap.data()?.isSpy) throw new Error('Chỉ gián điệp mới được phá hệ thống.');
  if (partSnap.data()?.eliminated) throw new Error('Bạn đã bị loại.');
  const cooldownUntil = session.sabotageCooldownUntil?.toMillis?.() ?? 0;
  if (cooldownUntil > Date.now()) throw new Error('Phải chờ thêm trước khi phá hệ thống tiếp.');

  const participantIds = session.activePlayerIds.length
    ? session.activePlayerIds
    : session.presentStudentIds;
  const [participantSnaps, taskSnap] = await Promise.all([
    Promise.all(participantIds.map((studentId) => getDoc(participantRef(sessionId, studentId)))),
    getDocs(taskProgressCollectionRef(sessionId)),
  ]);
  const participants = participantSnaps
    .filter((snap) => snap.exists())
    .map((snap) => normalizeSpyParticipant(snap.id, snap.data()));
  const progressRows = taskSnap.docs.map((d) => normalizeSpyTaskProgress(d.id, d.data()));
  const active = getActiveParticipants(participants, session.eliminatedIds);
  const victim = pickCrewSabotageVictim(active, spyId);
  if (!victim) throw new Error('Không còn ai để loại.');

  const newEliminatedIds = [...session.eliminatedIds, victim.id];
  const remaining = getActiveParticipants(participants, newEliminatedIds);
  const outcome = checkSpyWinOutcome(remaining);
  const tieClear = clearTieFields();
  const redistribute = planCrewTaskRedistribution({
    eliminatedId: victim.id,
    participants,
    progressRows,
    eliminatedIds: newEliminatedIds,
    taskPerPlayer: session.taskPerPlayer,
    existingExtras: session.crewTaskExtraById,
  });

  const batch = writeBatch(db);
  // Không ghi participant.eliminated ở đây — học sinh không có quyền update participant.
  // UI và win-check dùng session.eliminatedIds.

  const updates = {
    eliminatedIds: newEliminatedIds,
    lastEliminatedId: victim.id,
    activePlayerIds: remaining.map((p) => p.id),
    sabotageById: spyId,
    sabotageAt: serverTimestamp(),
    sabotageCooldownUntil: sabotageCooldownUntilFromNow(),
    meetingReporterId: '',
    meetingOpenedBy: '',
    crewTaskExtraById: mergeCrewTaskExtras(session.crewTaskExtraById, redistribute),
    ...tieClear,
  };

  if (outcome) {
    updates.status = 'reveal';
    updates.outcome = outcome;
    updates.revealedSpyIds = participants.filter((p) => p.isSpy).map((p) => p.id);
    updates.sabotageActive = false;
  } else {
    // Giữ mọi client trên cùng màn cảnh báo đỏ trước khi vào vote.
    updates.status = 'sabotage_alert';
    updates.sabotageActive = true;
    updates.crewEliminationAnnounceUntil = null;
  }

  batch.update(sessionRef(sessionId), sessionBump(updates));
  await batch.commit();

  return {
    victimId: victim.id,
    victimName: victim.studentName,
    outcome,
    phase: outcome ? 'reveal' : 'sabotage_alert',
    redistributed: redistribute.reduce((sum, row) => sum + row.extra, 0),
  };
}

/** Mọi client đồng bộ: thoát cảnh báo phá hệ thống → vào vote cùng lúc. */
export async function acknowledgeCrewSabotage(sessionId, { studentId } = {}) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.mode !== 'crew') throw new Error('Không phải mode Phi hành đoàn.');
  if (session.status !== 'sabotage_alert') {
    if (session.status === 'vote') return { phase: 'vote', already: true };
    throw new Error('Không ở giai đoạn cảnh báo phá hệ thống.');
  }

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'vote',
    voteRound: session.voteRound + 1,
    meetingOpenedBy: 'sabotage',
    sabotageActive: false,
    crewVoteResolveEndsAt: null,
    crewSabotageAckById: studentId || '',
  }));

  return { phase: 'vote', already: false };
}

export async function scheduleCrewVoteResolveIfReady(sessionId, { studentId } = {}) {
  const [sessionSnap, votesSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDocs(votesRef(sessionId)),
  ]);
  if (!sessionSnap.exists()) return;
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.mode !== 'crew' || session.status !== 'vote' || session.crewVoteResolveEndsAt) return;

  const activeCount = countActivePlayersFromSession(session);
  if (!activeCount) return;
  if (votesSnap.docs.length < activeCount) return;

  await updateDoc(sessionRef(sessionId), sessionBump({
    crewVoteResolveEndsAt: Timestamp.fromMillis(Date.now() + SPY_CREW_VOTE_RESOLVE_SECONDS * 1000),
    crewVoteQuorumById: studentId || '',
  }));
}

export async function clearCrewSabotage(sessionId) {
  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.mode !== 'crew') throw new Error('Không phải mode Phi hành đoàn.');
  await updateDoc(sessionRef(sessionId), sessionBump({
    sabotageActive: false,
    sabotageById: '',
    sabotageAt: null,
  }));
}

export async function reportCrewMeeting(sessionId, { studentId }) {
  const [sessionSnap, partSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDoc(participantRef(sessionId, studentId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.mode !== 'crew' || session.status !== 'playing') throw new Error('Chưa ở chế độ nhiệm vụ.');
  if ((session.reportedByIds || []).includes(studentId)) throw new Error('Bạn đã dùng lượt Report.');
  if (!partSnap.exists()) throw new Error('Bạn chưa vào phòng.');
  if (partSnap.data()?.eliminated) throw new Error('Bạn đã bị loại.');

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'vote',
    voteRound: session.voteRound + 1,
    reportedByIds: [...(session.reportedByIds || []), studentId],
    meetingOpenedBy: 'report',
    meetingReporterId: studentId,
    sabotageActive: false,
    sabotageById: '',
    sabotageAt: null,
    lastTieBreak: null,
    crewEliminationAnnounceUntil: null,
    crewVoteResolveEndsAt: null,
    ...clearTieFields(),
  }));
}

export function checkCrewTaskWin(session, participants = [], progressRows = []) {
  if (!session || session.mode !== 'crew') return false;
  const progressById = new Map(progressRows.map((row) => [row.id, row]));
  let total = 0;
  for (const participant of participants) {
    // Giữ tiến độ dân thường đã làm kể cả khi bị loại — phần còn lại đã chia lại cho đội.
    if (participant.isSpy) continue;
    total += Number(progressById.get(participant.id)?.completedCount || 0);
  }
  return total >= Number(session.crewTaskTarget || 0);
}

export async function resolveTieRevote(sessionId) {
  const [sessionSnap, partsSnap, votesSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDocs(participantsRef(sessionId)),
    getDocs(votesRef(sessionId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.status !== 'tie_revote') throw new Error('Chưa trong vòng đổi phiếu hòa.');

  const participants = partsSnap.docs.map((d) => normalizeSpyParticipant(d.id, d.data()));
  const votes = votesSnap.docs.map((d) => normalizeSpyVote(d.id, d.data()));

  if (!votes.length) throw new Error('Chưa có phiếu nào.');

  const { topCandidates } = tallySpyVotes(votes, participants, session.eliminatedIds);
  if (!topCandidates.length) throw new Error('Không có phiếu hợp lệ.');

  const votesChanged = votesChangedFromBaseline(votes, session.tieRevoteBaseline);
  const stillTied = topCandidates.length > 1;

  let pick = topCandidates[0];
  let lastTieBreak = null;

  if (stillTied) {
    pick = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    lastTieBreak = {
      candidateIds: topCandidates.map((c) => c.studentId),
      pickedId: pick.studentId,
      pickedName: pick.studentName,
      method: 'random',
      votesChanged,
    };
  }

  return applySpyElimination(sessionId, {
    session,
    participants,
    votesSnap,
    eliminatedId: pick.studentId,
    eliminatedName: pick.studentName,
    tied: stillTied,
    lastTieBreak,
    votesChanged,
  });
}

async function applySpyElimination(sessionId, {
  session,
  participants,
  votesSnap,
  eliminatedId,
  eliminatedName,
  tied = false,
  lastTieBreak = null,
  votesChanged = false,
}) {
  const newEliminatedIds = [...session.eliminatedIds, eliminatedId];

  const batch = writeBatch(db);
  batch.update(participantRef(sessionId, eliminatedId), { eliminated: true });
  votesSnap.docs.forEach((voteDoc) => batch.delete(voteDoc.ref));

  const remaining = getActiveParticipants(participants, newEliminatedIds);
  const outcome = checkSpyWinOutcome(remaining);
  const tieClear = clearTieFields();

  if (outcome) {
    const revealedSpyIds = participants.filter((p) => p.isSpy).map((p) => p.id);
    batch.update(sessionRef(sessionId), sessionBump({
      status: 'reveal',
      eliminatedIds: newEliminatedIds,
      lastEliminatedId: eliminatedId,
      outcome,
      revealedSpyIds,
      ...tieClear,
      lastTieBreak,
    }));
    await batch.commit();
    return {
      eliminatedId,
      eliminatedName,
      outcome,
      tied,
      votesChanged,
      lastTieBreak,
      phase: 'reveal',
    };
  }

  if (session.mode === 'crew') {
    const taskSnap = await getDocs(taskProgressCollectionRef(sessionId));
    const progressRows = taskSnap.docs.map((d) => normalizeSpyTaskProgress(d.id, d.data()));
    const redistribute = planCrewTaskRedistribution({
      eliminatedId,
      participants,
      progressRows,
      eliminatedIds: newEliminatedIds,
      taskPerPlayer: session.taskPerPlayer,
      existingExtras: session.crewTaskExtraById,
    });

    batch.update(sessionRef(sessionId), sessionBump(withPostVoteSabotageCooldown({
      status: 'playing',
      eliminatedIds: newEliminatedIds,
      lastEliminatedId: eliminatedId,
      activePlayerIds: remaining.map((p) => p.id),
      crewEliminationAnnounceUntil: Timestamp.fromMillis(Date.now() + SPY_CREW_VOTE_RESOLVE_SECONDS * 1000),
      crewSkipVoteAnnounceUntil: null,
      crewTaskExtraById: mergeCrewTaskExtras(session.crewTaskExtraById, redistribute),
      ...clearCrewRoundFields(),
      ...tieClear,
      lastTieBreak,
    })));
  } else {
    const describeOrder = fisherYatesShuffle(remaining.map((p) => p.id));
    batch.update(sessionRef(sessionId), sessionBump({
      status: 'describe',
      eliminatedIds: newEliminatedIds,
      lastEliminatedId: eliminatedId,
      activePlayerIds: remaining.map((p) => p.id),
      describeOrder,
      describeIndex: 0,
      describeRoundCurrent: 1,
      ...tieClear,
      lastTieBreak,
    }));
  }
  await batch.commit();

  return {
    eliminatedId,
    eliminatedName,
    outcome: null,
    tied,
    votesChanged,
    lastTieBreak,
    phase: session.mode === 'crew' ? 'playing' : 'describe',
  };
}

export async function revealSpyRound(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(snap.id, snap.data());

  const partsSnap = await getDocs(participantsRef(sessionId));
  const revealedSpyIds = partsSnap.docs.filter((d) => d.data().isSpy).map((d) => d.id);

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'reveal',
    civilianWord: session.civilianWord,
    spyWord: session.spyWord,
    revealedSpyIds,
  }));
}

export async function completeCrewGame(sessionId) {
  const [sessionSnap, partsSnap, taskSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDocs(participantsRef(sessionId)),
    getDocs(taskProgressCollectionRef(sessionId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.mode !== 'crew') throw new Error('Không phải mode Phi hành đoàn.');
  const participants = partsSnap.docs.map((d) => normalizeSpyParticipant(d.id, d.data()));
  const taskProgress = taskSnap.docs.map((d) => normalizeSpyTaskProgress(d.id, d.data()));
  const active = getActiveParticipants(participants, session.eliminatedIds);
  const outcome = checkCrewTaskWin(session, participants, taskProgress)
    ? 'civilians'
    : checkSpyWinOutcome(active);
  if (!outcome) throw new Error('Chưa đủ điều kiện công bố kết quả.');
  const revealedSpyIds = participants.filter((p) => p.isSpy).map((p) => p.id);
  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'reveal',
    outcome,
    revealedSpyIds,
    ...clearCrewRoundFields(),
  }));
}

export async function finishSpySession(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'finished',
    finishedAt: serverTimestamp(),
  }));
  if (snap.exists()) {
    await clearClassActiveSpyPointer(snap.data().classCode, sessionId);
  }
}

/** Giữ nguyên phòng & học sinh đã vào; xóa phiếu và reset về lobby cho ván mới. */
export async function restartSpyRound(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = snap.data();
  if (session.status !== 'reveal' && session.status !== 'finished') {
    throw new Error('Chỉ bắt đầu ván mới sau khi công bố kết quả.');
  }

  const [partsSnap, votesSnap] = await Promise.all([
    getDocs(participantsRef(sessionId)),
    getDocs(votesRef(sessionId)),
  ]);

  if (!partsSnap.docs.length) {
    throw new Error('Chưa có học sinh trong phòng.');
  }

  const batch = writeBatch(db);
  votesSnap.docs.forEach((voteDoc) => batch.delete(voteDoc.ref));
  partsSnap.docs.forEach((partDoc) => {
    batch.update(participantRef(sessionId, partDoc.id), {
      assignedWord: '',
      isSpy: false,
      eliminated: false,
    });
  });
  batch.update(sessionRef(sessionId), sessionBump({
    status: 'lobby',
    mode: session.mode === 'crew' ? 'crew' : 'word',
    describeOrder: [],
    describeIndex: 0,
    activePlayerIds: partsSnap.docs.map((d) => d.id),
    describeRoundCurrent: 1,
    eliminatedIds: [],
    voteRound: 0,
    lastEliminatedId: '',
    outcome: null,
    civilianWord: '',
    spyWord: '',
    revealedSpyIds: [],
    crewTaskTarget: 0,
    crewTaskExtraById: {},
    sabotageCooldownUntil: null,
    reportedByIds: [],
    ...clearCrewRoundFields(),
    ...clearTieFields(),
    lastTieBreak: null,
    finishedAt: null,
  }));
  await batch.commit();

  await setClassActiveSpyPointer(snap.data().classCode, sessionId);
}

/** @deprecated Dùng finishSpySession — hành vi giống nhau. */
export async function cancelSpySession(sessionId) {
  return finishSpySession(sessionId);
}

export async function fetchSpySession(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) return null;
  return normalizeSpySession(snap.id, snap.data());
}

export function subscribeSpySession(sessionId, onData, onError) {
  if (!sessionId) return () => {};
  return onSnapshot(sessionRef(sessionId), (snap) => {
    onData(snap.exists() ? normalizeSpySession(snap.id, snap.data()) : null);
  }, onError);
}

export function subscribeSpyParticipants(sessionId, onData, onError) {
  if (!sessionId) return () => {};
  return onSnapshot(participantsRef(sessionId), (snap) => {
    const rows = snap.docs.map((d) => normalizeSpyParticipant(d.id, d.data()));
    rows.sort((a, b) => a.studentName.localeCompare(b.studentName, 'vi'));
    onData(rows);
  }, onError);
}

/** Listen từng participant doc (get) — dùng khi list bị chặn hoặc cần roster theo điểm danh. */
export function subscribeSpyParticipantsByIds(sessionId, studentIds = [], onData, onError) {
  if (!sessionId) return () => {};
  const ids = [...new Set((studentIds || []).filter(Boolean))];
  if (!ids.length) {
    onData([]);
    return () => {};
  }

  const byId = new Map();

  const emit = () => {
    const rows = [...byId.values()];
    rows.sort((a, b) => a.studentName.localeCompare(b.studentName, 'vi'));
    onData(rows);
  };

  const unsubs = ids.map((id) => onSnapshot(
    participantRef(sessionId, id),
    (snap) => {
      if (snap.exists()) byId.set(id, normalizeSpyParticipant(snap.id, snap.data()));
      else byId.delete(id);
      emit();
    },
    onError,
  ));

  return () => unsubs.forEach((unsub) => unsub());
}

export function subscribeSpyParticipant(sessionId, studentId, onData, onError) {
  if (!sessionId || !studentId) return () => {};
  return onSnapshot(participantRef(sessionId, studentId), (snap) => {
    onData(snap.exists() ? normalizeSpyParticipant(snap.id, snap.data()) : null);
  }, onError);
}

export function subscribeSpyVote(sessionId, voterId, onData, onError) {
  if (!sessionId || !voterId) return () => {};
  return onSnapshot(voteRef(sessionId, voterId), (snap) => {
    onData(snap.exists() ? normalizeSpyVote(snap.id, snap.data()) : null);
  }, onError);
}

export function subscribeSpyVotes(sessionId, onData, onError) {
  if (!sessionId) return () => {};
  return onSnapshot(votesRef(sessionId), (snap) => {
    onData(snap.docs.map((d) => normalizeSpyVote(d.id, d.data())));
  }, onError);
}

export function subscribeCrewTaskProgress(sessionId, onData, onError) {
  if (!sessionId) return () => {};
  return onSnapshot(taskProgressCollectionRef(sessionId), (snap) => {
    const rows = snap.docs.map((d) => normalizeSpyTaskProgress(d.id, d.data()));
    onData(rows);
  }, onError);
}

export function subscribeActiveSpyForClass(classCode, onData, onError) {
  if (!classCode) return () => {};
  const q = query(
    sessionsRef(),
    where('classCode', '==', classCode),
    where('status', 'in', SPY_ACTIVE_STATUSES),
  );
  return onSnapshot(q, (snap) => {
    const active = snap.docs
      .map((d) => normalizeSpySession(d.id, d.data()))
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    onData(active[0] || null);
  }, onError);
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

function publicBaseUrl() {
  const configured = import.meta.env?.VITE_PUBLIC_BASE_URL;
  if (configured) return String(configured).replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function getSpyPortalLink(classCode, sessionId) {
  return `${publicBaseUrl()}/c/${encodeURIComponent(classCode)}?spy=${sessionId}`;
}

export function getSpyPresentLink(sessionId) {
  return `${publicBaseUrl()}/present/spy/${sessionId}`;
}

export async function getSpySessionResults(sessionId) {
  const [partsSnap, votesSnap, session] = await Promise.all([
    getDocs(participantsRef(sessionId)),
    getDocs(votesRef(sessionId)),
    fetchSpySession(sessionId),
  ]);
  const participants = partsSnap.docs.map((d) => normalizeSpyParticipant(d.id, d.data()));
  const votes = votesSnap.docs.map((d) => normalizeSpyVote(d.id, d.data()));
  const { tally } = tallySpyVotes(votes, participants, session?.eliminatedIds);
  return {
    session,
    participants,
    votes,
    tally,
    spies: participants.filter((p) => p.isSpy),
  };
}
