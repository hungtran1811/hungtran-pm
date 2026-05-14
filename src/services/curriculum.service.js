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
  normalizeCurriculumExerciseVisibleSessions,
  sortCurriculumPrograms,
  suggestCurriculumProgramIdForClass,
} from '../utils/curriculum.js';
import {
  clampKnowledgeSession,
  buildCurriculumVisibleLessons,
  createCurriculumItemId,
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
      exerciseVisibleSessions: [],
    };
  }

  return {
    programId: program.id,
    currentSession: clampCurriculumSession(program, classItem?.curriculumCurrentSession || 1),
    curriculumPhase: classItem?.curriculumPhase === 'final' ? 'final' : 'learning',
    exerciseVisibleSessions: normalizeCurriculumExerciseVisibleSessions(
      classItem?.curriculumExerciseVisibleSessions,
      program,
    ),
  };
}

function applyClassExerciseVisibility(lessons = [], assignment = null) {
  const visibleSessions = new Set(normalizeCurriculumExerciseVisibleSessions(assignment?.exerciseVisibleSessions));

  return lessons.map((lesson) => ({
    ...lesson,
    exerciseVisible: visibleSessions.has(Number(lesson.sessionNumber || 0)),
  }));
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
  const lessons = applyClassExerciseVisibility(getActiveCurriculumLessons(program), assignment);
  const checklistItems = getActiveCurriculumChecklist(program);
  const visibleLessons = buildCurriculumVisibleLessons(program, lessons, assignment);

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

  const hasMarkdownContent = Boolean(
    String(lesson.lectureMarkdown || lesson.contentMarkdown || '').trim() ||
      String(lesson.exerciseMarkdown || '').trim(),
  );
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
        curriculumExerciseVisibleSessions: normalizeCurriculumExerciseVisibleSessions(
          payload.curriculumExerciseVisibleSessions,
          program,
        ),
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

      const nextTargetLesson = { ...targetLesson, archived: Boolean(archived) };

      if (!archived) {
        const sessionLimit = Math.max(
          1,
          Number(program.totalSessionCount || program.knowledgePhaseEndSession || 1),
        );
        const usedSessions = new Set(
          (program.lessons || [])
            .filter((item) => !item.archived && item.id !== lessonId)
            .map((item) => Number(item.sessionNumber || 0))
            .filter(Boolean),
        );

        if (usedSessions.has(Number(nextTargetLesson.sessionNumber || 0))) {
          const availableSession = Array.from({ length: sessionLimit }, (_item, index) => index + 1)
            .find((sessionNumber) => !usedSessions.has(sessionNumber));

          if (!availableSession) {
            throw new Error('Chưa có buổi trống để khôi phục bài học này. Hãy lưu kho một buổi khác trước.');
          }

          nextTargetLesson.sessionNumber = availableSession;
        }

        validateLessonPayload(program, nextTargetLesson, program.lessons || [], targetLesson.id);
      }

      const nextLessons = (program.lessons || []).map((item) =>
        item.id === lessonId ? nextTargetLesson : item,
      );

      return {
        lessons: sortCurriculumLessons(nextLessons),
      };
    },
    archived ? 'Không thể lưu kho buổi học này.' : 'Không thể khôi phục buổi học này.',
  );
}

export async function archiveEmptyCurriculumSession(programId, sessionNumber) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      const normalizedSessionNumber = clampKnowledgeSession(program, sessionNumber);
      const existingLesson = (program.lessons || []).find(
        (item) => !item.archived && Number(item.sessionNumber || 0) === normalizedSessionNumber,
      );

      if (existingLesson) {
        return {
          lessons: sortCurriculumLessons(
            (program.lessons || []).map((item) =>
              item.id === existingLesson.id ? { ...item, archived: true } : item,
            ),
          ),
        };
      }

      const currentSessionCount = Math.max(
        1,
        Number(program.totalSessionCount || program.knowledgePhaseEndSession || 1),
      );

      if (normalizedSessionNumber >= currentSessionCount) {
        const nextSessionCount = Math.max(1, currentSessionCount - 1);

        return {
          totalSessionCount: nextSessionCount,
          sessionActivities: (program.sessionActivities || [])
            .filter((item) => Number(item.sessionNumber || 0) <= nextSessionCount)
            .sort((left, right) => Number(left.sessionNumber || 0) - Number(right.sessionNumber || 0)),
        };
      }

      const placeholderLesson = normalizeLessonRecord(
        {
          id: createCurriculumItemId(`${programId}-archived-session-${normalizedSessionNumber}`),
          sessionNumber: normalizedSessionNumber,
          title: `Buổi ${normalizedSessionNumber}`,
          contentMarkdown: '',
          lectureMarkdown: '',
          exerciseMarkdown: '',
          reviewLinks: [],
          teacherNote: '',
          bannerImage: null,
          images: [],
          coverImage: null,
          archived: true,
        },
        `${programId}-archived-session`,
      );

      return {
        lessons: sortCurriculumLessons([...(program.lessons || []), placeholderLesson]),
      };
    },
    'Không thể lưu kho buổi trống này.',
  );
}

export async function deleteArchivedCurriculumLesson(programId, lessonId) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      const targetLesson = (program.lessons || []).find((item) => item.id === lessonId);

      if (!targetLesson) {
        throw new Error('Không tìm thấy buổi học cần xóa.');
      }

      if (!targetLesson.archived) {
        throw new Error('Chỉ có thể xóa vĩnh viễn các buổi học đã nằm trong kho lưu trữ.');
      }

      const nextLessons = (program.lessons || []).filter((item) => item.id !== lessonId);
      const currentSessionCount = Math.max(
        1,
        Number(program.totalSessionCount || program.knowledgePhaseEndSession || 1),
      );
      const deletedSessionNumber = Number(targetLesson.sessionNumber || 0);
      const patch = {
        lessons: sortCurriculumLessons(nextLessons),
      };

      const stillHasLessonAtCurrentSession = nextLessons.some(
        (item) => Number(item.sessionNumber || 0) === currentSessionCount,
      );

      if (deletedSessionNumber === currentSessionCount && !stillHasLessonAtCurrentSession) {
        const nextSessionCount = Math.max(1, currentSessionCount - 1);

        patch.totalSessionCount = nextSessionCount;
        patch.sessionActivities = (program.sessionActivities || [])
          .filter((item) => Number(item.sessionNumber || 0) <= nextSessionCount)
          .sort((left, right) => Number(left.sessionNumber || 0) - Number(right.sessionNumber || 0));
      }

      return {
        ...patch,
      };
    },
    'Không thể xóa vĩnh viễn buổi học này.',
  );
}

export async function setCurriculumProgramSessionCount(programId, totalSessionCount) {
  await updateCurriculumProgram(
    programId,
    (program) => {
      const currentCount = Math.max(
        1,
        Number(program.totalSessionCount || program.knowledgePhaseEndSession || 1),
      );
      const nextCount = Math.max(1, Number(totalSessionCount || currentCount));

      if (nextCount <= currentCount) {
        throw new Error('Số buổi mới cần lớn hơn số buổi hiện tại.');
      }

      return {
        totalSessionCount: nextCount,
      };
    },
    'Không thể thêm buổi mới cho chương trình này.',
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
