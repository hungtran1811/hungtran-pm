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
  SPY_CREW_TASK_PROGRESS_CAP,
  SPY_SABOTAGE_COOLDOWN_MAX_SECONDS,
  SPY_SABOTAGE_COOLDOWN_MIN_SECONDS,
  SPY_TIE_DEBATE_SECONDS,
} from '../lib/spyConstants.js';
import { validateWordPair } from '../data/spyWordBank.js';
import { advanceSpyHint } from '../lib/spyHints.js';
import {
  assertSpyLobbyRosterMatched,
  bumpSpyAssignmentCounts,
  checkCrewTaskWin,
  checkSpyWinOutcome,
  fisherYatesShuffle,
  getActiveParticipants,
  normalizeSpyAssignmentCounts,
  pickCrewSabotageVictim,
  pickFairSpyIds,
  shouldSkipSpyVoteRound,
  tallySpyVotes,
  validateSpyPresentRosterChange,
  votesChangedFromBaseline,
} from '../lib/spyGameLogic.js';

export {
  checkCrewTaskWin,
  evaluateSpyOutcome,
  getActiveParticipants,
  getCurrentSpeaker,
  getDescribeRoundTotal,
  getTieDebateEndsAtMs,
  getTieDebateSpeakerName,
  isSpyLobbyRosterReady,
  pickCrewSabotageVictim,
  pickFairSpyIds,
  rankCrewMvp,
  shouldSkipSpyVoteRound,
  tallySpyVotes,
  validateSpyPresentRosterChange,
  votesChangedFromBaseline,
} from '../lib/spyGameLogic.js';

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
    crewTeamCompleted: Number(data.crewTeamCompleted) || 0,
    spyHintLevel: Number(data.spyHintLevel) || 0,
    spyHintText: data.spyHintText || '',
    spyHintSpyId: data.spyHintSpyId || '',
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

/** Crew → playing + cooldown; word → describe (thứ tự mới). */
function buildPostVoteContinueFields(session, {
  participants = [],
  eliminatedIds = [],
  fields = {},
} = {}) {
  const tieClear = clearTieFields();
  if (session.mode === 'crew') {
    return withPostVoteSabotageCooldown({
      status: 'playing',
      ...fields,
      ...clearCrewRoundFields(),
      ...tieClear,
    });
  }
  const remaining = getActiveParticipants(participants, eliminatedIds);
  return {
    status: 'describe',
    activePlayerIds: remaining.map((p) => p.id),
    describeOrder: fisherYatesShuffle(remaining.map((p) => p.id)),
    describeIndex: 0,
    describeRoundCurrent: 1,
    ...fields,
    ...tieClear,
  };
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
  crewTaskTarget = 15,
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
    crewTaskTarget: mode === 'crew'
      ? Math.min(100, Math.max(5, Number(crewTaskTarget) || 15))
      : 0,
    crewTeamCompleted: 0,
    spyHintLevel: 0,
    spyHintText: '',
    spyHintSpyId: '',
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

/** Cập nhật điểm danh đã freeze — chỉ khi còn lobby. */
export async function updateSpyPresentRoster(sessionId, presentStudentIds) {
  const [sessionSnap, partsSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDocs(participantsRef(sessionId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  const joinedIds = partsSnap.docs.map((d) => d.id);
  const present = [...new Set((presentStudentIds || []).filter(Boolean))];
  const error = validateSpyPresentRosterChange({
    status: session.status,
    impostorCount: session.impostorCount,
    presentStudentIds: present,
    joinedIds,
  });
  if (error) throw new Error(error);

  await updateDoc(sessionRef(sessionId), sessionBump({ presentStudentIds: present }));
  return { presentStudentIds: present };
}

/** Đặt presentStudentIds = người đã vào lobby — giải over-attendance. */
export async function syncSpyPresentRosterToJoined(sessionId) {
  const [sessionSnap, partsSnap] = await Promise.all([
    getDoc(sessionRef(sessionId)),
    getDocs(participantsRef(sessionId)),
  ]);
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = normalizeSpySession(sessionSnap.id, sessionSnap.data());
  if (session.status !== 'lobby') throw new Error('Chỉ đồng bộ khi đang ở lobby.');
  const joinedIds = partsSnap.docs.map((d) => d.id);
  return updateSpyPresentRoster(sessionId, joinedIds);
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
  assertSpyLobbyRosterMatched(participantIds, session.presentStudentIds, session.impostorCount);

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
    spyHintLevel: 0,
    spyHintText: '',
    spyHintSpyId: '',
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
  assertSpyLobbyRosterMatched(participantIds, session.presentStudentIds, session.impostorCount);

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
      total: SPY_CREW_TASK_PROGRESS_CAP,
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
    crewTaskTarget: Math.max(
      5,
      Number(session.crewTaskTarget) || civilianCount * session.taskPerPlayer,
    ),
    crewTeamCompleted: 0,
    spyHintLevel: 0,
    spyHintText: '',
    spyHintSpyId: '',
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

async function skipSpyVoteRound(sessionId, { session, participants, votesSnap }) {
  const batch = writeBatch(db);
  votesSnap.docs.forEach((voteDoc) => batch.delete(voteDoc.ref));
  const announceUntil = Timestamp.fromMillis(Date.now() + SPY_CREW_VOTE_RESOLVE_SECONDS * 1000);
  const continueFields = buildPostVoteContinueFields(session, {
    participants,
    eliminatedIds: session.eliminatedIds,
    fields: {
      ...(session.mode === 'crew'
        ? {
          crewSkipVoteAnnounceUntil: announceUntil,
          crewEliminationAnnounceUntil: null,
        }
        : {}),
      lastTieBreak: null,
    },
  });
  batch.update(sessionRef(sessionId), sessionBump(continueFields));

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
  const [partSnap, progressSnap] = await Promise.all([
    getDoc(participantRef(sessionId, studentId)),
    getDoc(taskProgressRef(sessionId, studentId)),
  ]);
  if (!partSnap.exists()) throw new Error('Bạn chưa vào phòng.');
  if (partSnap.data()?.eliminated) throw new Error('Bạn đã bị loại.');

  const nextCompleted = Math.max(0, Number(completedCount) || 0);
  const prevCompleted = Number(progressSnap.data()?.completedCount || 0);
  const delta = Math.max(0, nextCompleted - prevCompleted);
  const isSpy = Boolean(partSnap.data()?.isSpy);

  const batch = writeBatch(db);
  batch.set(taskProgressRef(sessionId, studentId), {
    total: SPY_CREW_TASK_PROGRESS_CAP,
    completedCount: nextCompleted,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  if (delta > 0 && !isSpy) {
    batch.update(sessionRef(sessionId), {
      crewTeamCompleted: increment(delta),
      lastCrewProgressById: studentId,
      stateVersion: increment(1),
    });
  }
  await batch.commit();
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
  const [participantSnaps] = await Promise.all([
    Promise.all(participantIds.map((studentId) => getDoc(participantRef(sessionId, studentId)))),
  ]);
  const participants = participantSnaps
    .filter((snap) => snap.exists())
    .map((snap) => normalizeSpyParticipant(snap.id, snap.data()));
  const active = getActiveParticipants(participants, session.eliminatedIds);
  const victim = pickCrewSabotageVictim(active, spyId);
  if (!victim) throw new Error('Không còn ai để loại.');

  const newEliminatedIds = [...session.eliminatedIds, victim.id];
  const remaining = getActiveParticipants(participants, newEliminatedIds);
  const outcome = checkSpyWinOutcome(remaining);
  const tieClear = clearTieFields();
  const hintFields = advanceSpyHint({ participants, eliminatedIds: newEliminatedIds });

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
    ...hintFields,
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
  const eliminatedParticipant = participants.find((p) => p.id === eliminatedId);
  const hintFields = eliminatedParticipant && !eliminatedParticipant.isSpy
    ? advanceSpyHint({ participants, eliminatedIds: newEliminatedIds })
    : {};

  if (outcome) {
    const revealedSpyIds = participants.filter((p) => p.isSpy).map((p) => p.id);
    batch.update(sessionRef(sessionId), sessionBump({
      status: 'reveal',
      eliminatedIds: newEliminatedIds,
      lastEliminatedId: eliminatedId,
      outcome,
      revealedSpyIds,
      ...hintFields,
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

  batch.update(sessionRef(sessionId), sessionBump(buildPostVoteContinueFields(session, {
    participants,
    eliminatedIds: newEliminatedIds,
    fields: {
      eliminatedIds: newEliminatedIds,
      lastEliminatedId: eliminatedId,
      ...(session.mode === 'crew'
        ? {
          crewEliminationAnnounceUntil: Timestamp.fromMillis(
            Date.now() + SPY_CREW_VOTE_RESOLVE_SECONDS * 1000,
          ),
          crewSkipVoteAnnounceUntil: null,
        }
        : {}),
      ...hintFields,
      lastTieBreak,
    },
  })));
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
    crewTeamCompleted: 0,
    spyHintLevel: 0,
    spyHintText: '',
    spyHintSpyId: '',
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
