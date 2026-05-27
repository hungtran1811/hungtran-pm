import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import {
  toQuizConfigModel,
  toQuizConfigModelFromData,
} from '../models/quiz.model.js';
import { toAppError } from '../utils/firebase-error.js';
import {
  buildQuizBankId,
  buildQuizConfigDocId,
  getQuizBankScope,
  normalizeQuizConfigRecord,
  QUIZ_MODE_OFFICIAL,
  validateQuizConfigRecord,
} from '../utils/quiz.js';

function sortQuizConfigs(configs = []) {
  return [...configs].sort((left, right) => left.sessionNumber - right.sessionNumber);
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
    timeLimitMinutes: config.timeLimitMinutes,
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
