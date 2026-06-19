import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { SHOWDOWN_SEED_BANK } from '../data/showdownSeedBank.js';
import { DEFAULT_SHOWDOWN_MATRIX } from '../data/showdownDefaultMatrix.js';
import { normalizeDifficulty } from '../lib/showdownConstants.js';

const QUESTIONS = 'showdownQuestions';
const MATRICES = 'showdownMatrices';

function questionsRef() {
  return collection(db, QUESTIONS);
}

function questionRef(id) {
  return doc(db, QUESTIONS, id);
}

function matricesRef() {
  return collection(db, MATRICES);
}

function matrixRef(id) {
  return doc(db, MATRICES, id);
}

function normalizeQuestion(id, data) {
  if (!data) return null;
  return {
    id,
    subject: data.subject || 'Python',
    level: data.level || 'Basic',
    topic: data.topic || 'custom',
    round: data.round || 'obstacle',
    difficulty: normalizeDifficulty(data.difficulty),
    questionType: data.questionType || 'multiple_choice',
    prompt: data.prompt || '',
    codeSnippet: data.codeSnippet || null,
    options: Array.isArray(data.options) ? data.options : [],
    correctAnswer: data.correctAnswer ?? '',
    correctIndex: data.correctIndex ?? null,
    starterCode: data.starterCode ?? '',
    referenceSolution: data.referenceSolution ?? '',
    explanation: data.explanation || '',
    timeLimitSeconds: Number(data.timeLimitSeconds) || null,
    points: Number(data.points) || null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function normalizeMatrix(id, data) {
  if (!data) return null;
  return {
    id,
    name: data.name || '',
    subject: data.subject || 'Python',
    level: data.level || 'Basic',
    isDefault: Boolean(data.isDefault),
    rounds: data.rounds || {},
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

export async function listShowdownQuestions() {
  const snap = await getDocs(questionsRef());
  return snap.docs.map((d) => normalizeQuestion(d.id, d.data()));
}

export async function createShowdownQuestion(payload) {
  const ref = await addDoc(questionsRef(), {
    ...payload,
    correctIndex: payload.correctIndex ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateShowdownQuestion(id, payload) {
  await updateDoc(questionRef(id), { ...payload, updatedAt: serverTimestamp() });
}

export async function deleteShowdownQuestion(id) {
  await deleteDoc(questionRef(id));
}

export async function listShowdownMatrices() {
  const snap = await getDocs(matricesRef());
  return snap.docs.map((d) => normalizeMatrix(d.id, d.data()));
}

export async function getShowdownMatrix(id) {
  const snap = await getDoc(matrixRef(id));
  return snap.exists() ? normalizeMatrix(snap.id, snap.data()) : null;
}

export async function saveShowdownMatrix(id, payload) {
  if (id) {
    await updateDoc(matrixRef(id), { ...payload, updatedAt: serverTimestamp() });
    return id;
  }
  const ref = await addDoc(matricesRef(), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteShowdownMatrix(id) {
  await deleteDoc(matrixRef(id));
}

/** One-time import of the in-memory seed bank + default matrix into Firestore. */
export async function seedShowdownBankToFirestore() {
  const existing = await getDocs(questionsRef());
  if (!existing.empty) {
    return { questionsAdded: 0, alreadySeeded: true };
  }

  const batch = writeBatch(db);
  SHOWDOWN_SEED_BANK.forEach((q) => {
    const { id, sourceOlympiaId, bankRound, ...rest } = q;
    batch.set(questionRef(id), {
      ...rest,
      sourceOlympiaId: sourceOlympiaId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();

  await setDoc(matrixRef(DEFAULT_SHOWDOWN_MATRIX.id), {
    name: DEFAULT_SHOWDOWN_MATRIX.name,
    subject: DEFAULT_SHOWDOWN_MATRIX.subject,
    level: DEFAULT_SHOWDOWN_MATRIX.level,
    isDefault: true,
    rounds: DEFAULT_SHOWDOWN_MATRIX.rounds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return { questionsAdded: SHOWDOWN_SEED_BANK.length, alreadySeeded: false };
}

/**
 * Replace the Firestore bank with the bundled official matrix bank.
 * Deletes all existing showdown questions first (clears stale MCQ/old content),
 * then imports the current SHOWDOWN_SEED_BANK and refreshes the default matrix.
 */
export async function reseedShowdownBankToFirestore() {
  const existing = await getDocs(questionsRef());
  let deleteBatch = writeBatch(db);
  let ops = 0;
  let removed = 0;
  for (const d of existing.docs) {
    deleteBatch.delete(d.ref);
    ops += 1;
    removed += 1;
    if (ops >= 450) {
      await deleteBatch.commit();
      deleteBatch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await deleteBatch.commit();

  let addBatch = writeBatch(db);
  ops = 0;
  for (const q of SHOWDOWN_SEED_BANK) {
    const { id, sourceOlympiaId, bankRound, ...rest } = q;
    addBatch.set(questionRef(id), {
      ...rest,
      sourceOlympiaId: sourceOlympiaId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    ops += 1;
    if (ops >= 450) {
      await addBatch.commit();
      addBatch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await addBatch.commit();

  await setDoc(matrixRef(DEFAULT_SHOWDOWN_MATRIX.id), {
    name: DEFAULT_SHOWDOWN_MATRIX.name,
    subject: DEFAULT_SHOWDOWN_MATRIX.subject,
    level: DEFAULT_SHOWDOWN_MATRIX.level,
    isDefault: true,
    rounds: DEFAULT_SHOWDOWN_MATRIX.rounds,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return { questionsAdded: SHOWDOWN_SEED_BANK.length, removed };
}

export { normalizeQuestion, normalizeMatrix };
