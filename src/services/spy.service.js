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
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { SPY_ACTIVE_STATUSES } from '../lib/spyConstants.js';
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

function classDocRef(classCode) {
  return doc(db, 'classes', classCode);
}

function sessionBump(fields = {}) {
  return { ...fields, stateVersion: increment(1) };
}

function shuffleIds(ids) {
  return [...ids].sort(() => Math.random() - 0.5);
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
    describeOrder: Array.isArray(data.describeOrder) ? data.describeOrder : [],
    describeIndex: Number(data.describeIndex) || 0,
    civilianWord: data.civilianWord || '',
    spyWord: data.spyWord || '',
    revealedSpyIds: Array.isArray(data.revealedSpyIds) ? data.revealedSpyIds : [],
    createdAt: data.createdAt || null,
    startedAt: data.startedAt || null,
    finishedAt: data.finishedAt || null,
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

async function setClassActiveSpyPointer(classCode, sessionId) {
  if (!classCode) return;
  try {
    await updateDoc(classDocRef(classCode), { activeSpySessionId: sessionId });
  } catch {
    // non-fatal
  }
}

async function clearClassActiveSpyPointer(classCode, sessionId) {
  if (!classCode) return;
  try {
    const snap = await getDoc(classDocRef(classCode));
    if (snap.exists() && snap.data().activeSpySessionId === sessionId) {
      await updateDoc(classDocRef(classCode), { activeSpySessionId: null });
    }
  } catch {
    // non-fatal
  }
}

export async function createSpySession({ classCode, presentStudentIds, impostorCount }) {
  if (!classCode) throw new Error('Chọn lớp trước.');
  const present = [...new Set(presentStudentIds || [])];
  if (present.length < impostorCount + 2) {
    throw new Error('Cần đủ học sinh có mặt (ít nhất 2 dân + số gián điệp).');
  }

  const sessionDoc = await addDoc(sessionsRef(), {
    classCode,
    status: 'draft',
    impostorCount: Number(impostorCount) || 1,
    presentStudentIds: present,
    describeOrder: [],
    describeIndex: 0,
    civilianWord: '',
    spyWord: '',
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

  const shuffled = shuffleIds(participantIds);
  const spyIds = new Set(shuffled.slice(0, Number(session.impostorCount) || 1));
  const describeOrder = shuffleIds(participantIds);

  const batch = writeBatch(db);
  partsSnap.docs.forEach((partDoc) => {
    const isSpy = spyIds.has(partDoc.id);
    batch.update(participantRef(sessionId, partDoc.id), {
      isSpy,
      assignedWord: isSpy ? validated.spy : validated.civilian,
    });
  });

  batch.update(sessionRef(sessionId), sessionBump({
    status: 'describe',
    describeOrder,
    describeIndex: 0,
    startedAt: serverTimestamp(),
  }));

  await batch.commit();
}

export async function advanceSpyDescribe(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = snap.data();
  if (session.status !== 'describe') throw new Error('Không trong vòng mô tả.');

  const order = session.describeOrder || [];
  const nextIndex = Number(session.describeIndex) + 1;
  if (nextIndex >= order.length) {
    await updateDoc(sessionRef(sessionId), sessionBump({
      status: 'vote',
      describeIndex: nextIndex,
    }));
    return { advanced: true, phase: 'vote' };
  }

  await updateDoc(sessionRef(sessionId), sessionBump({ describeIndex: nextIndex }));
  return { advanced: true, phase: 'describe', describeIndex: nextIndex };
}

export async function openSpyVote(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  if (!snap.exists()) throw new Error('Không tìm thấy phòng.');
  if (snap.data().status !== 'describe') throw new Error('Chưa xong vòng mô tả.');
  await updateDoc(sessionRef(sessionId), sessionBump({ status: 'vote' }));
}

export async function submitSpyVote(sessionId, { voterId, targetStudentId }) {
  if (!voterId || !targetStudentId) throw new Error('Chọn người nghi ngờ.');
  if (voterId === targetStudentId) throw new Error('Không thể vote chính mình.');

  const sessionSnap = await getDoc(sessionRef(sessionId));
  if (!sessionSnap.exists()) throw new Error('Không tìm thấy phòng.');
  const session = sessionSnap.data();
  if (session.status !== 'vote') throw new Error('Chưa đến lượt bỏ phiếu.');
  if (!(session.presentStudentIds || []).includes(voterId)) {
    throw new Error('Bạn không trong danh sách chơi.');
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
      throw new Error('Bạn đã bỏ phiếu.');
    }
    throw err;
  }
}

export async function revealSpyRound(sessionId, { civilianWord, spyWord }) {
  const validated = validateWordPair(civilianWord, spyWord);
  if (validated.error) throw new Error(validated.error);

  const partsSnap = await getDocs(participantsRef(sessionId));
  const revealedSpyIds = partsSnap.docs.filter((d) => d.data().isSpy).map((d) => d.id);

  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'reveal',
    civilianWord: validated.civilian,
    spyWord: validated.spy,
    revealedSpyIds,
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
    });
  });
  batch.update(sessionRef(sessionId), sessionBump({
    status: 'lobby',
    describeOrder: [],
    describeIndex: 0,
    civilianWord: '',
    spyWord: '',
    revealedSpyIds: [],
    finishedAt: null,
  }));
  await batch.commit();

  await setClassActiveSpyPointer(snap.data().classCode, sessionId);
}

export async function cancelSpySession(sessionId) {
  const snap = await getDoc(sessionRef(sessionId));
  await updateDoc(sessionRef(sessionId), sessionBump({
    status: 'finished',
    finishedAt: serverTimestamp(),
  }));
  if (snap.exists()) {
    await clearClassActiveSpyPointer(snap.data().classCode, sessionId);
  }
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

export function subscribeSpyParticipant(sessionId, studentId, onData, onError) {
  if (!sessionId || !studentId) return () => {};
  return onSnapshot(participantRef(sessionId, studentId), (snap) => {
    onData(snap.exists() ? normalizeSpyParticipant(snap.id, snap.data()) : null);
  }, onError);
}

export function subscribeSpyVotes(sessionId, onData, onError) {
  if (!sessionId) return () => {};
  return onSnapshot(votesRef(sessionId), (snap) => {
    onData(snap.docs.map((d) => normalizeSpyVote(d.id, d.data())));
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
  if (!session || session.status !== 'describe') return null;
  const id = session.describeOrder?.[session.describeIndex];
  return id || null;
}

export function tallySpyVotes(votes = [], participants = []) {
  const counts = new Map();
  for (const vote of votes) {
    const id = vote.targetStudentId;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const nameById = new Map(participants.map((p) => [p.id, p.studentName]));
  return [...counts.entries()]
    .map(([studentId, count]) => ({
      studentId,
      studentName: nameById.get(studentId) || studentId,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.studentName.localeCompare(b.studentName, 'vi'));
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
  return {
    session,
    participants,
    votes,
    tally: tallySpyVotes(votes, participants),
    spies: participants.filter((p) => p.isSpy),
  };
}
