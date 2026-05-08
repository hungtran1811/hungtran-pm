import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getFirebaseServices } from '../config/firebase.js';
import { toClassModel } from '../models/class.model.js';
import {
  toCurriculumProgramModel,
  toCurriculumProgramModelFromData,
} from '../models/curriculum-program.model.js';
import { toAppError } from '../utils/firebase-error.js';
import {
  clampCurriculumSession,
  groupCurriculumProgramsBySubject,
  sortCurriculumPrograms,
  suggestCurriculumProgramIdForClass,
} from '../utils/curriculum.js';
import {
  clampKnowledgeSession,
  getActiveCurriculumChecklist,
  getActiveCurriculumLessons,
  isCurriculumReviewLinkValid,
  normalizeExamChecklistItemRecord,
  normalizeLessonRecord,
  normalizeProjectChecklistRecords,
  normalizeSessionActivityRecord,
  sortCurriculumChecklist,
  sortCurriculumLessons,
} from '../utils/curriculum-program.js';

function buildCurriculumAssignment(classItem, programs) {
  const suggestedProgramId = suggestCurriculumProgramIdForClass(programs, classItem);
  const preferredProgramId = classItem?.curriculumProgramId || suggestedProgramId;
  const resolvedProgramId = programs.some((item) => item.id === preferredProgramId)
    ? preferredProgramId
    : suggestedProgramId;
  const program = programs.find((item) => item.id === resolvedProgramId) || null;

  if (!program) {
    return {
      programId: '',
      currentSession: 1,
      curriculumPhase: 'learning',
    };
  }

  return {
    programId: program.id,
    currentSession: clampCurriculumSession(program, classItem?.curriculumCurrentSession || 1),
    curriculumPhase: classItem?.curriculumPhase === 'final' ? 'final' : 'learning',
  };
}

function buildCurriculumView(classItem, program) {
  if (!program) {
    return {
      classInfo: classItem,
      assignment: null,
      program: null,
      lessons: [],
      visibleLessons: [],
      checklistItems: [],
    };
  }

  const assignment = buildCurriculumAssignment(classItem, [program]);
  const lessons = getActiveCurriculumLessons(program);
  const checklistItems = getActiveCurriculumChecklist(program);
  const visibleLessons =
    assignment.curriculumPhase === 'final'
      ? lessons
      : lessons.filter((lesson) => lesson.sessionNumber <= assignment.currentSession);

  return {
    classInfo: classItem,
    assignment,
    program: {
      ...program,
      lessons,
      sessionActivities: program.sessionActivities || [],
      finalChecklist: checklistItems,
    },
    lessons,
    visibleLessons,
    checklistItems,
  };
}

function validateLessonPayload(program, lesson, lessons, currentLessonId = '') {
  if (!lesson.title) {
    throw new Error('Tiêu đề buổi học không được để trống.');
  }

    const hasMarkdownContent = Boolean(String(lesson.contentMarkdown || '').trim());
  const hasLegacyStructuredContent = Boolean(
    lesson.summary ||
      lesson.practiceTask ||
      lesson.selfStudyPrompt ||
      (Array.isArray(lesson.keyPoints) && lesson.keyPoints.length > 0),
  );

  if (!hasMarkdownContent && !hasLegacyStructuredContent) {
    throw new Error('Hãy nhập nội dung học liệu cho buổi học này.');
  }
  const invalidReviewLink = (lesson.reviewLinks || []).find(
    (item) => !item.label || !item.url || !isCurriculumReviewLinkValid(item),
  );

  if (invalidReviewLink) {
    throw new Error('Mỗi tài liệu đính kèm cần có tên hiển thị và đường link hợp lệ.');
  }

  const sameSessionLesson = lessons.find(
    (item) =>
      item.id !== currentLessonId &&
      !item.archived &&
      item.sessionNumber === lesson.sessionNumber,
  );

  if (sameSessionLesson) {
    throw new Error(`Buổi ${lesson.sessionNumber} đã có một bài học khác. Hãy chọn số buổi khác hoặc lưu kho bài cũ trước.`);
  }

  const lessonSessionLimit = Math.max(
    1,
    Number(program.totalSessionCount || program.knowledgePhaseEndSession || 1),
  );

  if (lesson.sessionNumber > lessonSessionLimit) {
    throw new Error(
      `Chương trình này chỉ cho phép tạo bài học trong phạm vi toàn khóa từ buổi 1 đến buổi ${lessonSessionLimit}.`,
    );
  }
}

function validateExamChecklistItem(item) {
  if (!item.title) {
    throw new Error('Tiêu đề mục ôn tập cuối khóa không được để trống.');
  }

  if (!item.description) {
    throw new Error('Hãy nhập mô tả cho mục ôn tập cuối khóa.');
  }
}

async function getCurriculumProgramSnapshot(programId, fallbackMessage) {
  const { db } = getFirebaseServices();
  const programRef = doc(db, 'curriculumPrograms', programId);

  try {
    const snapshot = await getDoc(programRef);

    if (!snapshot.exists()) {
      throw new Error('Không tìm thấy chương trình học cần cập nhật.');
    }

    return {
      ref: programRef,
      program: toCurriculumProgramModelFromData(snapshot.id, snapshot.data()),
    };
  } catch (error) {
    throw toAppError(error, fallbackMessage);
  }
}

async function updateCurriculumProgram(programId, buildPatch, fallbackMessage) {
  const { ref, program } = await getCurriculumProgramSnapshot(programId, fallbackMessage);

  try {
    const patch = await buildPatch(program);

    await updateDoc(ref, {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error, fallbackMessage);
  }
}

export function subscribeCurriculumPrograms(onData, onError) {
  const { db } = getFirebaseServices();
  const programsRef = collection(db, 'curriculumPrograms');

  return onSnapshot(
    programsRef,
    (snapshot) => {
      const programs = snapshot.docs
        .map(toCurriculumProgramModel)
        .filter((program) => program.active);

      onData(sortCurriculumPrograms(programs));
    },
    onError,
  );
}

export async function listCurriculumPrograms() {
  const { db } = getFirebaseServices();

  try {
    const snapshot = await getDocs(collection(db, 'curriculumPrograms'));
    const programs = snapshot.docs
      .map(toCurriculumProgramModel)
      .filter((program) => program.active);

    return sortCurriculumPrograms(programs);
  } catch (error) {
    throw toAppError(error, 'Không tải được danh sách chương trình học.');
  }
}

export async function getCurriculumProgram(programId) {
  const { db } = getFirebaseServices();

  try {
    const snapshot = await getDoc(doc(db, 'curriculumPrograms', programId));

    if (!snapshot.exists()) {
      return null;
    }

    const program = toCurriculumProgramModel(snapshot);
    return program.active ? program : null;
  } catch (error) {
    throw toAppError(error, 'Không tải được chương trình học.');
  }
}

export async function saveClassCurriculumAssignment(classCode, payload) {
  const { db } = getFirebaseServices();
  const classRef = doc(db, 'classes', classCode);

  try {
    const [classSnapshot, programSnapshot] = await Promise.all([
      getDoc(classRef),
      getDoc(doc(db, 'curriculumPrograms', payload.curriculumProgramId)),
    ]);

    if (!classSnapshot.exists()) {
      throw new Error('Không tìm thấy lớp cần cập nhật.');
    }

    if (!programSnapshot.exists()) {
      throw new Error('Không tìm thấy chương trình học được chọn.');
    }

    const program = toCurriculumProgramModelFromData(programSnapshot.id, programSnapshot.data());

    await updateDoc(classRef, {
      curriculumProgramId: program.id,
      curriculumCurrentSession: clampCurriculumSession(program, payload.curriculumCurrentSession),
      curriculumPhase: payload.curriculumPhase === 'final' ? 'final' : 'learning',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toAppError(error, 'Không thể lưu cấu hình học liệu cho lớp này.');
  }
}

export async function saveCurriculumLesson(programId, values) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      const currentLesson = (program.lessons || []).find((item) => item.id === values.id) || null;
      const lesson = normalizeLessonRecord(
        {
          ...currentLesson,
          ...values,
          sessionNumber: clampKnowledgeSession(program, values.sessionNumber),
          archived: currentLesson?.archived ?? false,
        },
        `${programId}-lesson`,
      );

      validateLessonPayload(program, lesson, program.lessons || [], currentLesson?.id || '');

      const nextLessons = currentLesson
        ? (program.lessons || []).map((item) => (item.id === currentLesson.id ? lesson : item))
        : [...(program.lessons || []), lesson];

      return {
        lessons: sortCurriculumLessons(nextLessons),
      };
    },
    'Không thể lưu buổi học cho chương trình này.',
  );
}

export async function saveCurriculumSessionActivity(programId, values) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      const sessionLimit = Math.max(
        1,
        Number(program.totalSessionCount || program.knowledgePhaseEndSession || 1),
      );
      const activity = normalizeSessionActivityRecord(values, values.sessionNumber);

      if (activity.sessionNumber > sessionLimit) {
        throw new Error(`Chương trình này chỉ có ${sessionLimit} buổi.`);
      }

      const activitiesBySession = new Map(
        (program.sessionActivities || []).map((item) => [Number(item.sessionNumber || 0), item]),
      );
      activitiesBySession.set(activity.sessionNumber, activity);

      return {
        sessionActivities: Array.from(activitiesBySession.values())
          .filter((item) => Number(item.sessionNumber || 0) >= 1 && Number(item.sessionNumber || 0) <= sessionLimit)
          .sort((left, right) => Number(left.sessionNumber || 0) - Number(right.sessionNumber || 0)),
      };
    },
    'Không thể lưu loại buổi cho chương trình này.',
  );
}

export async function setCurriculumLessonArchived(programId, lessonId, archived) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      const targetLesson = (program.lessons || []).find((item) => item.id === lessonId);

      if (!targetLesson) {
        throw new Error('Không tìm thấy buổi học cần cập nhật.');
      }

      if (!archived) {
        validateLessonPayload(program, { ...targetLesson, archived: false }, program.lessons || [], targetLesson.id);
      }

      const nextLessons = (program.lessons || []).map((item) =>
        item.id === lessonId ? { ...item, archived: Boolean(archived) } : item,
      );

      return {
        lessons: sortCurriculumLessons(nextLessons),
      };
    },
    archived ? 'Không thể lưu kho buổi học này.' : 'Không thể khôi phục buổi học này.',
  );
}

export async function saveCurriculumProjectStages(programId, values) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      if (program.finalMode !== 'project') {
        throw new Error('Chương trình này không dùng quy trình làm sản phẩm cuối khóa.');
      }

      const nextChecklist = normalizeProjectChecklistRecords(programId, values).map((item) => {
        if (!item.description || !item.studentGuide || !item.exampleOutput) {
          throw new Error('Mỗi giai đoạn cần có mô tả, cách tự đối chiếu và ví dụ đầu ra.');
        }

        return item;
      });

      return {
        finalChecklist: nextChecklist,
      };
    },
    'Không thể lưu quy trình cuối khóa cho chương trình này.',
  );
}

export async function saveCurriculumExamChecklistItem(programId, values) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      if (program.finalMode !== 'exam') {
        throw new Error('Chương trình này không dùng checklist ôn kiểm tra.');
      }

      const currentItem = (program.finalChecklist || []).find((item) => item.id === values.id) || null;
      const nextItem = normalizeExamChecklistItemRecord(
        {
          ...currentItem,
          ...values,
          archived: currentItem?.archived ?? false,
        },
        `${programId}-exam`,
      );

      validateExamChecklistItem(nextItem);

      const nextChecklist = currentItem
        ? (program.finalChecklist || []).map((item) => (item.id === currentItem.id ? nextItem : item))
        : [...(program.finalChecklist || []), nextItem];

      return {
        finalChecklist: sortCurriculumChecklist(nextChecklist),
      };
    },
    'Không thể lưu checklist cuối khóa cho chương trình này.',
  );
}

export async function setCurriculumExamChecklistItemArchived(programId, itemId, archived) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      if (program.finalMode !== 'exam') {
        throw new Error('Chương trình này không dùng checklist ôn kiểm tra.');
      }

      const targetItem = (program.finalChecklist || []).find((item) => item.id === itemId);

      if (!targetItem) {
        throw new Error('Không tìm thấy mục cuối khóa cần cập nhật.');
      }

      const nextChecklist = (program.finalChecklist || []).map((item) =>
        item.id === itemId ? { ...item, archived: Boolean(archived) } : item,
      );

      return {
        finalChecklist: sortCurriculumChecklist(nextChecklist),
      };
    },
    archived ? 'Không thể lưu kho mục cuối khóa này.' : 'Không thể khôi phục mục cuối khóa này.',
  );
}

export async function getClassCurriculumView(classCode, { publicAccess = true } = {}) {
  const { db } = getFirebaseServices();

  try {
    const classSnapshot = await getDoc(doc(db, 'classes', classCode));

    if (!classSnapshot.exists()) {
      throw new Error('Không tìm thấy lớp học.');
    }

    const classItem = toClassModel(classSnapshot);

    if (publicAccess && (classItem.status !== 'active' || classItem.hidden)) {
      throw new Error('Lớp học hiện không mở để xem học liệu.');
    }

    if (!classItem.curriculumProgramId) {
      return {
        classInfo: classItem,
        assignment: null,
        program: null,
        lessons: [],
        visibleLessons: [],
        checklistItems: [],
      };
    }

    const program = await getCurriculumProgram(classItem.curriculumProgramId);
    return buildCurriculumView(classItem, program);
  } catch (error) {
    throw toAppError(error, 'Không tải được học liệu của lớp này.');
  }
}

export async function getStudentLibraryView(classCode) {
  return getClassCurriculumView(classCode, { publicAccess: true });
}

export function getSuggestedCurriculumAssignment(classItem, programs) {
  return buildCurriculumAssignment(classItem, programs);
}

export function getCurriculumProgramGroups(programs) {
  return groupCurriculumProgramsBySubject(programs);
}
