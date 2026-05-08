import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import {
  toQuizAttemptModel,
  toQuizAttemptSubmissionModel,
  toQuizConfigModel,
  toQuizConfigModelFromData,
} from '../models/quiz.model.js';
import { getAuthState } from '../state/auth.store.js';
import {
  getCurriculumSessionActivity,
  isCurriculumQuizActivity,
} from '../utils/curriculum-program.js';
import { toAppError } from '../utils/firebase-error.js';
import {
  buildQuizAttemptId,
  buildQuizBankId,
  buildQuizConfigDocId,
  formatQuizReadinessRequirement,
  getQuizBankScope,
  getQuizReadiness,
  normalizeQuizConfigRecord,
  QUIZ_ATTEMPT_STATUS_REOPENED,
  QUIZ_CLASS_STATUS_IDLE,
  QUIZ_CLASS_STATUS_STARTED,
  QUIZ_MODE_OFFICIAL,
  validateQuizConfigRecord,
} from '../utils/quiz.js';

function sortQuizConfigs(configs = []) {
  return [...configs].sort((left, right) => left.sessionNumber - right.sessionNumber);
}

function sortQuizAttempts(attempts = []) {
  return [...attempts].sort((left, right) => {
    const leftTime = left.submittedAt ? left.submittedAt.getTime() : 0;
    const rightTime = right.submittedAt ? right.submittedAt.getTime() : 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    if (left.sessionNumber !== right.sessionNumber) {
      return left.sessionNumber - right.sessionNumber;
    }

    return left.studentName.localeCompare(right.studentName, 'vi');
  });
}

function sortQuizAttemptSubmissions(submissions = []) {
  return [...submissions].sort((left, right) => {
    if (left.submissionNumber !== right.submissionNumber) {
      return left.submissionNumber - right.submissionNumber;
    }

    const leftTime = left.submittedAt ? left.submittedAt.getTime() : 0;
    const rightTime = right.submittedAt ? right.submittedAt.getTime() : 0;
    return leftTime - rightTime;
  });
}

function isPermissionDeniedError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  return code.includes('permission-denied') || message.includes('missing or insufficient permissions');
}

function getProgramScope(program = {}) {
  return getQuizBankScope({
    subject: program.subject,
    level: program.level,
  });
}

function toPublicQuizConfigDoc(config) {
  return {
    subject: config.subject,
    level: config.level,
    subjectKey: config.subjectKey,
    levelKey: config.levelKey,
    bankId: config.bankId,
    sessionNumber: config.sessionNumber,
    quizMode: QUIZ_MODE_OFFICIAL,
    questionPickPolicy: config.questionPickPolicy,
    title: config.title,
    description: config.description,
    questionCount: config.questions.length,
    questions: (config.questions || []).map((question) => ({
      id: question.id,
      type: question.type || 'single_choice',
      difficulty: question.difficulty || 'medium',
      prompt: question.prompt,
      imageUrl: question.imageUrl || '',
      imageAlt: question.imageAlt || '',
      blankPlaceholder: question.blankPlaceholder || '',
      order: question.order,
      options: (question.options || []).map((option) => ({
        id: option.id,
        text: option.text,
        order: option.order,
      })),
    })),
  };
}

async function listLegacyQuizConfigs(programId, fallbackScope = {}) {
  if (!programId) {
    return [];
  }

  const { db } = getFirebaseServices();
  const snapshot = await getDocs(collection(db, 'curriculumPrograms', programId, 'quizConfigs'));

  return snapshot.docs.map((docSnapshot) => {
    const data = docSnapshot.data();
    return toQuizConfigModelFromData(docSnapshot.id, {
      ...data,
      ...fallbackScope,
      bankId:
        data.bankId ||
        buildQuizBankId(
          data.subject || fallbackScope.subject,
          data.level || fallbackScope.level,
          data.sessionNumber,
        ),
    });
  });
}

export async function listQuizConfigsForProgram(program = {}) {
  const { db } = getFirebaseServices();
  const scope = getProgramScope(program);

  if (!scope.subject || !scope.level) {
    return listLegacyQuizConfigs(program.id, scope);
  }

  try {
    const [bankSnapshot, legacyConfigs] = await Promise.all([
      getDocs(collection(db, 'quizQuestionBanks')),
      listLegacyQuizConfigs(program.id, scope),
    ]);
    const bankConfigs = bankSnapshot.docs
      .map(toQuizConfigModel)
      .filter((config) => config.subjectKey === scope.subjectKey && config.levelKey === scope.levelKey);
    const bankSessions = new Set(bankConfigs.map((config) => Number(config.sessionNumber || 0)));
    const fallbackConfigs = legacyConfigs.filter((config) => !bankSessions.has(Number(config.sessionNumber || 0)));

    return sortQuizConfigs([...bankConfigs, ...fallbackConfigs]);
  } catch (error) {
    throw toAppError(error, 'Không tải được ngân hàng câu hỏi của môn và level này.');
  }
}

export async function listQuizConfigs(programOrProgramId) {
  if (programOrProgramId && typeof programOrProgramId === 'object') {
    return listQuizConfigsForProgram(programOrProgramId);
  }

  try {
    return sortQuizConfigs(await listLegacyQuizConfigs(String(programOrProgramId || '')));
  } catch (error) {
    throw toAppError(error, 'Không tải được cấu hình trắc nghiệm của chương trình này.');
  }
}

export async function getQuizConfigForProgramSession(program = {}, sessionNumber = 0, { publicOnly = false } = {}) {
  const { db } = getFirebaseServices();
  const scope = getProgramScope(program);
  const bankId = buildQuizBankId(scope.subject, scope.level, sessionNumber);
  const bankCollection = publicOnly ? 'quizPublicQuestionBanks' : 'quizQuestionBanks';

  try {
    const bankSnapshot = await getDoc(doc(db, bankCollection, bankId));

    if (bankSnapshot.exists()) {
      return toQuizConfigModelFromData(bankSnapshot.id, bankSnapshot.data());
    }

    const legacyCollection = publicOnly ? 'quizPublicConfigs' : 'quizConfigs';
    const legacySnapshot = program.id
      ? await getDoc(doc(db, 'curriculumPrograms', program.id, legacyCollection, buildQuizConfigDocId(sessionNumber)))
      : null;

    if (legacySnapshot?.exists()) {
      return toQuizConfigModelFromData(legacySnapshot.id, {
        ...legacySnapshot.data(),
        ...scope,
        bankId,
      });
    }

    return null;
  } catch (error) {
    throw toAppError(error, 'Không tải được ngân hàng câu hỏi cho buổi này.');
  }
}

export async function saveQuizConfig(programOrProgramId, values) {
  const { db } = getFirebaseServices();
  const program = programOrProgramId && typeof programOrProgramId === 'object' ? programOrProgramId : null;
  const scope = getQuizBankScope(values, program || {});
  const normalizedConfig = normalizeQuizConfigRecord(
    {
      ...values,
      ...scope,
      quizMode: QUIZ_MODE_OFFICIAL,
    },
    values.sessionNumber,
    scope,
  );

  try {
    if (!normalizedConfig.subject || !normalizedConfig.level) {
      throw new Error('Bộ đề cần có môn và level để lưu vào ngân hàng câu hỏi.');
    }

    validateQuizConfigRecord(normalizedConfig);

    const docId = buildQuizBankId(
      normalizedConfig.subject,
      normalizedConfig.level,
      normalizedConfig.sessionNumber,
    );
    const privateRef = doc(db, 'quizQuestionBanks', docId);
    const publicRef = doc(db, 'quizPublicQuestionBanks', docId);
    const existingSnapshot = await getDoc(privateRef);
    const createdAt = existingSnapshot.exists()
      ? existingSnapshot.data().createdAt || serverTimestamp()
      : serverTimestamp();

    await Promise.all([
      setDoc(
        privateRef,
        {
          ...normalizedConfig,
          bankId: docId,
          programId: program?.id || String(programOrProgramId || ''),
          createdAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
      setDoc(
        publicRef,
        {
          ...toPublicQuizConfigDoc({
            ...normalizedConfig,
            bankId: docId,
          }),
          programId: program?.id || String(programOrProgramId || ''),
          createdAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ]);
  } catch (error) {
    throw toAppError(error, 'Không thể lưu ngân hàng câu hỏi cho môn và level này.');
  }
}

export async function getQuizAttemptsByClass(classCode) {
  const normalizedClassCode = String(classCode ?? '').trim().toUpperCase();

  if (!normalizedClassCode) {
    return [];
  }

  const { db } = getFirebaseServices();

  try {
    const attemptsQuery = query(collection(db, 'quizAttempts'), where('classCode', '==', normalizedClassCode));
    const attemptsSnapshot = await getDocs(attemptsQuery);
    let submissionsSnapshot = null;

    try {
      const submissionsQuery = query(
        collection(db, 'quizAttemptSubmissions'),
        where('classCode', '==', normalizedClassCode),
      );
      submissionsSnapshot = await getDocs(submissionsQuery);
    } catch (error) {
      if (!isPermissionDeniedError(error)) {
        throw error;
      }
    }

    const submissionsByAttemptId = (submissionsSnapshot?.docs || []).reduce((result, snapshot) => {
      const submission = toQuizAttemptSubmissionModel(snapshot);

      if (!submission.attemptId) {
        return result;
      }

      if (!result.has(submission.attemptId)) {
        result.set(submission.attemptId, []);
      }

      result.get(submission.attemptId).push(submission);
      return result;
    }, new Map());

    return sortQuizAttempts(
      attemptsSnapshot.docs.map((snapshot) => {
        const attempt = toQuizAttemptModel(snapshot);

        return {
          ...attempt,
          submissions: sortQuizAttemptSubmissions(submissionsByAttemptId.get(attempt.id) || []),
        };
      }),
    );
  } catch (error) {
    throw toAppError(error, 'Không tải được danh sách bài nộp trắc nghiệm.');
  }
}

export async function setClassQuizStatus(classCode, { sessionNumber, isStarted }) {
  const { db } = getFirebaseServices();
  const classRef = doc(db, 'classes', String(classCode ?? '').trim().toUpperCase());

  try {
    if (isStarted) {
      const classSnapshot = await getDoc(classRef);

      if (!classSnapshot.exists()) {
        throw new Error('Không tìm thấy lớp cần mở kiểm tra.');
      }

      const classData = classSnapshot.data();
      const currentSession = Number(classData.curriculumCurrentSession || 0);

      if (currentSession !== Number(sessionNumber || 0)) {
        throw new Error(`Lớp hiện đang ở buổi ${currentSession || '?'}, chưa phải buổi ${Number(sessionNumber || 0)}.`);
      }

      if (!classData.curriculumProgramId) {
        throw new Error('Lớp này chưa được gắn chương trình học.');
      }

      const programSnapshot = await getDoc(doc(db, 'curriculumPrograms', classData.curriculumProgramId));

      if (!programSnapshot.exists()) {
        throw new Error('Không tìm thấy chương trình học của lớp này.');
      }

      const program = {
        id: programSnapshot.id,
        ...programSnapshot.data(),
      };
      const sessionActivity = getCurriculumSessionActivity(program, currentSession);

      if (!isCurriculumQuizActivity(sessionActivity.activityType)) {
        throw new Error('Buổi hiện tại chưa được cấu hình là Kiểm tra trong Học liệu.');
      }

      const quizConfig = await getQuizConfigForProgramSession(program, currentSession);
      const readiness = quizConfig ? getQuizReadiness(quizConfig) : null;

      if (!quizConfig || !readiness?.isReady) {
        throw new Error(
          quizConfig
            ? `Ngân hàng câu hỏi chưa đủ theo tỉ lệ 4 dễ, 4 trung bình, 2 khó. ${formatQuizReadinessRequirement(readiness)}`
            : 'Chưa có ngân hàng câu hỏi cho môn, level và buổi hiện tại.',
        );
      }
    }

    await updateDoc(classRef, {
      activeQuizSessionNumber: isStarted ? Number(sessionNumber || 0) : 0,
      activeQuizMode: QUIZ_MODE_OFFICIAL,
      quizStatus: isStarted ? QUIZ_CLASS_STATUS_STARTED : QUIZ_CLASS_STATUS_IDLE,
      quizStartedAt: isStarted ? serverTimestamp() : null,
      quizEndedAt: isStarted ? null : serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(
      error,
      isStarted
        ? 'Không thể bắt đầu bài kiểm tra lúc này.'
        : 'Không thể kết thúc bài kiểm tra lúc này.',
    );
  }
}

export async function reopenQuizAttempt(payload = {}) {
  const { db } = getFirebaseServices();
  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : { attemptId: payload };
  const normalizedAttemptId = String(normalizedPayload.attemptId ?? '').trim();
  const fallbackClassCode = String(normalizedPayload.classCode ?? '').trim().toUpperCase();
  const fallbackStudentId = String(normalizedPayload.studentId ?? '').trim();
  const fallbackSessionNumber = Number(normalizedPayload.sessionNumber || 0);
  const attemptRef = normalizedAttemptId ? doc(db, 'quizAttempts', normalizedAttemptId) : null;
  const authState = getAuthState();
  const reopenedBy = authState.user?.email || '';

  try {
    const attemptSnapshot = attemptRef ? await getDoc(attemptRef) : null;

    if (!attemptSnapshot?.exists() && (!fallbackClassCode || !fallbackStudentId || !fallbackSessionNumber)) {
      throw new Error('Không tìm thấy bài nộp cần mở lại.');
    }

    const attemptData = attemptSnapshot?.exists() ? attemptSnapshot.data() : {};
    const targetClassCode = String(attemptData.classCode ?? fallbackClassCode).trim().toUpperCase();
    const targetStudentId = String(attemptData.studentId ?? fallbackStudentId).trim();
    const targetSessionNumber = Number(attemptData.sessionNumber || fallbackSessionNumber || 0);

    if (!targetClassCode || !targetStudentId || !targetSessionNumber) {
      throw new Error('Thiếu thông tin để mở lại lượt làm cho học sinh này.');
    }

    const batch = writeBatch(db);
    const reopenedAt = serverTimestamp();
    const canonicalAttemptId = buildQuizAttemptId(targetClassCode, targetStudentId, targetSessionNumber);
    const attemptQuery = query(
      collection(db, 'quizAttempts'),
      where('classCode', '==', targetClassCode),
      where('studentId', '==', targetStudentId),
      where('sessionNumber', '==', targetSessionNumber),
    );
    const attemptStateQuery = query(
      collection(db, 'quizAttemptStates'),
      where('classCode', '==', targetClassCode),
      where('studentId', '==', targetStudentId),
      where('sessionNumber', '==', targetSessionNumber),
    );
    const [matchingAttemptSnapshots, matchingAttemptStateSnapshots] = await Promise.all([
      getDocs(attemptQuery),
      getDocs(attemptStateQuery),
    ]);
    const attemptDocsById = new Map();
    const attemptStateDocsById = new Map();

    if (attemptSnapshot?.exists()) {
      attemptDocsById.set(attemptSnapshot.id, attemptSnapshot);
    }

    matchingAttemptSnapshots.docs.forEach((snapshot) => {
      attemptDocsById.set(snapshot.id, snapshot);
    });

    matchingAttemptStateSnapshots.docs.forEach((snapshot) => {
      attemptStateDocsById.set(snapshot.id, snapshot);
    });

    if (!attemptDocsById.size) {
      attemptDocsById.set(canonicalAttemptId, null);
    }

    if (!attemptStateDocsById.size) {
      attemptStateDocsById.set(canonicalAttemptId, null);
    }

    attemptDocsById.forEach((_snapshot, docId) => {
      batch.set(
        doc(db, 'quizAttempts', docId),
        {
          classCode: targetClassCode,
          studentId: targetStudentId,
          sessionNumber: targetSessionNumber,
          quizMode: QUIZ_MODE_OFFICIAL,
          status: QUIZ_ATTEMPT_STATUS_REOPENED,
          reopenedAt,
          reopenedBy,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

    attemptStateDocsById.forEach((snapshot, docId) => {
      const snapshotData = snapshot?.data?.() || {};

      batch.set(
        doc(db, 'quizAttemptStates', docId),
        {
          classCode: targetClassCode,
          studentId: targetStudentId,
          sessionNumber: targetSessionNumber,
          quizMode: QUIZ_MODE_OFFICIAL,
          status: QUIZ_ATTEMPT_STATUS_REOPENED,
          submissionCount: Number(snapshotData.submissionCount || attemptData.submissionCount || 0),
          submittedAt: snapshotData.submittedAt ?? attemptData.submittedAt ?? null,
          createdAt: snapshotData.createdAt ?? attemptData.createdAt ?? null,
          reopenedAt,
          reopenedBy,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });

    await batch.commit();
  } catch (error) {
    throw toAppError(error, 'Không thể mở lại lượt làm bài này.');
  }
}
