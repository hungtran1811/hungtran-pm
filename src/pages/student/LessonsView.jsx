import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  PencilLine,
  PlayCircle,
  ZoomIn,
} from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { Field, Textarea, Select } from '../../ui/components/Field.jsx';
import { Markdown } from '../../ui/components/Markdown.jsx';
import { ImageLightbox, useImageLightbox } from '../../ui/components/ImageLightbox.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { UNDERSTANDING_LEVELS } from '../../constants/index.js';
import { unlockedLessonSessionCap } from '../../lib/sessionScope.js';
import { loadStudentLessonActivity } from '../../lib/lessonActivity.js';
import { getProgramLesson } from '../../services/curriculum.service.js';
import {
  subscribeFeedbackReceipt,
  submitKnowledgeReport,
} from '../../services/knowledgeReports.service.js';
import { recordLessonOpened } from '../../services/students.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { StudentQuizExam } from './StudentQuizExam.jsx';
import { LessonPracticeQuiz } from './LessonPracticeQuiz.jsx';

function readStorageKey(classCode, studentId) {
  return `lessonsRead:${classCode}:${studentId}`;
}

function lastLessonStorageKey(classCode, studentId) {
  return `lastLesson:${classCode}:${studentId}`;
}

function loadLastLessonId(classCode, studentId) {
  try {
    return localStorage.getItem(lastLessonStorageKey(classCode, studentId)) || null;
  } catch {
    return null;
  }
}

function saveLastLessonId(classCode, studentId, lessonId) {
  try {
    localStorage.setItem(lastLessonStorageKey(classCode, studentId), lessonId);
  } catch {
    // best-effort
  }
}

function resolveResumeIndex(lessons, classDoc, classCode, studentId) {
  const lastId = loadLastLessonId(classCode, studentId);
  if (lastId) {
    const idx = lessons.findIndex((l) => l.id === lastId);
    if (idx >= 0) return idx;
  }
  const currentSession = Number(classDoc.curriculumCurrentSession || 0);
  const sessionIdx = lessons.findIndex((l) => Number(l.sessionNumber) === currentSession);
  if (sessionIdx >= 0) return sessionIdx;
  return lessons.length > 0 ? lessons.length - 1 : null;
}

function loadReadIds(classCode, studentId) {
  try {
    const raw = localStorage.getItem(readStorageKey(classCode, studentId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function lessonGalleryImages(lesson) {
  const bannerUrl = lesson.bannerImageUrl || lesson.bannerImage?.secureUrl;
  const heroUrl = lesson.bannerImageUrl || lesson.coverImageUrl;
  const seen = new Set();
  const list = [];
  const add = (img) => {
    if (!img) return;
    const url = img.secureUrl || (typeof img === 'string' ? img : null);
    if (!url || seen.has(url)) return;
    if (bannerUrl && url === bannerUrl) return;
    seen.add(url);
    list.push(typeof img === 'object' && img.secureUrl ? img : { secureUrl: url, alt: '' });
  };
  if (Array.isArray(lesson.images)) lesson.images.forEach(add);
  const coverUrl = lesson.coverImageUrl || lesson.coverImage?.secureUrl;
  if (coverUrl && coverUrl !== heroUrl && !seen.has(coverUrl)) {
    add(lesson.coverImage || { secureUrl: coverUrl, alt: '' });
  }
  return list;
}

function lessonImages(lesson) {
  const seen = new Set();
  const list = [];
  const add = (img) => {
    const url = img?.secureUrl || img;
    if (!url || seen.has(url)) return;
    seen.add(url);
    list.push(typeof img === 'string' ? { secureUrl: img, alt: '' } : img);
  };
  if (lesson.bannerImage) add(lesson.bannerImage);
  lessonGalleryImages(lesson).forEach(add);
  if (!list.length && lesson.coverImage) add(lesson.coverImage);
  return list;
}

export function LessonsView({
  classDoc,
  program,
  student,
  submittedLessonIds = [],
  isFinalPhase = false,
  embedded = false,
  onFeedbackSubmitted,
  onQuizFocusChange,
}) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [readIds, setReadIds] = useState(() => loadReadIds(classDoc.classCode, student.id));
  const [lessonActivity, setLessonActivity] = useState({});

  const lessons = useMemo(() => {
    if (!program) return [];
    const sessionCap = unlockedLessonSessionCap(classDoc);
    return program.lessons
      .filter(
        (l) =>
          !l.archived &&
          Number(l.sessionNumber) <= sessionCap,
      )
      .sort((a, b) => Number(a.sessionNumber) - Number(b.sessionNumber));
  }, [program, classDoc]);

  const submittedMap = useMemo(() => {
    const map = {};
    submittedLessonIds.forEach((lessonId) => {
      map[lessonId] = true;
    });
    return map;
  }, [submittedLessonIds]);

  useEffect(() => {
    if (!lessons.length) {
      setLessonActivity({});
      return undefined;
    }
    let cancelled = false;
    loadStudentLessonActivity(classDoc.classCode, student.id, lessons).then((map) => {
      if (!cancelled) setLessonActivity(map);
    });
    return () => {
      cancelled = true;
    };
  }, [lessons, classDoc.classCode, student.id]);

  const markRead = (lessonId) => {
    setReadIds((prev) => {
      if (prev.has(lessonId)) return prev;
      const next = new Set(prev);
      next.add(lessonId);
      try {
        localStorage.setItem(readStorageKey(classDoc.classCode, student.id), JSON.stringify([...next]));
      } catch {
        // storage may be unavailable (private mode); marker is best-effort
      }
      return next;
    });
  };

  const openLesson = (index) => {
    setActiveIndex(index);
    const lesson = lessons[index];
    if (lesson) {
      markRead(lesson.id);
      saveLastLessonId(classDoc.classCode, student.id, lesson.id);
      recordLessonOpened(student.id, classDoc.classCode, lesson.id, lesson.sessionNumber).catch(
        () => {},
      );
    }
  };

  const resumeIndex = useMemo(
    () => resolveResumeIndex(lessons, classDoc, classDoc.classCode, student.id),
    [lessons, classDoc, student.id],
  );

  if (!program) {
    return (
      <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Chưa có chương trình học" />
    );
  }

  if (lessons.length === 0) {
    return (
      <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Chưa có bài giảng được mở" />
    );
  }

  if (activeIndex !== null && lessons[activeIndex]) {
    return (
      <LessonDetail
        lessons={lessons}
        activeIndex={activeIndex}
        lesson={lessons[activeIndex]}
        classDoc={classDoc}
        student={student}
        programId={program?.id}
        onSelectLesson={openLesson}
        onBack={() => setActiveIndex(null)}
        onSubmitted={(lessonId) => onFeedbackSubmitted?.(lessonId)}
        onQuizFocusChange={onQuizFocusChange}
        isFinalPhase={isFinalPhase}
      />
    );
  }

  const readCount = lessons.filter((l) => readIds.has(l.id)).length;
  const resumeLesson = resumeIndex !== null ? lessons[resumeIndex] : null;

  return (
    <div>
      {!embedded && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Bài giảng</h2>
            {isFinalPhase && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Xem lại các buổi học trước khi làm sản phẩm cuối khóa.
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            {readCount}/{lessons.length}
          </span>
        </div>
      )}

      {embedded && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Xem lại các buổi học trước khi làm sản phẩm cuối khóa.
          </p>
          <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            {readCount}/{lessons.length}
          </span>
        </div>
      )}

      {resumeLesson && (
        <div className={`student-sticky-below-header border-b border-slate-200/80 bg-slate-50/95 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95 sm:static sm:rounded-xl sm:border sm:py-0 sm:backdrop-blur-none ${
          embedded ? 'mt-0 -mx-1 px-1 sm:mx-0 sm:px-0' : '-mx-4 mt-4 px-4 sm:mx-0'
        }`}>
          <Button
            size="lg"
            className="w-full min-h-12 shadow-sm sm:mt-4"
            onClick={() => openLesson(resumeIndex)}
          >
            <PlayCircle className="h-5 w-5" />
            Tiếp tục học — Buổi {resumeLesson.sessionNumber}
          </Button>
        </div>
      )}

      <div className={embedded ? 'mt-4 grid gap-3 sm:grid-cols-2' : 'mt-4 grid gap-3 sm:grid-cols-2'}>
        {lessons.map((lesson, index) => {
          const isRead = readIds.has(lesson.id);
          const isSubmitted = submittedMap[lesson.id];
          const activity = lessonActivity[lesson.id];
          const thumb = lesson.bannerImageUrl || lesson.coverImageUrl;
          return (
            <button
              key={lesson.id}
              type="button"
              onClick={() => openLesson(index)}
              className="card group overflow-hidden text-left transition hover:border-brand-400 hover:shadow-md active:scale-[0.98]"
            >
              <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {thumb ? (
                  <img src={thumb} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-brand-400">
                    <BookOpen className="h-10 w-10" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="brand">Buổi {lesson.sessionNumber}</Badge>
                  {isSubmitted && <Badge tone="green">Đã phản hồi</Badge>}
                  {activity?.quizSubmitted && <Badge tone="blue">Đã nộp quiz</Badge>}
                  {activity?.practiceDone && (
                    <Badge tone="slate">
                      Ôn tập {activity.practiceScore != null ? `${activity.practiceScore}%` : ''}
                    </Badge>
                  )}
                  {isRead && !isSubmitted && (
                    <Badge tone="slate">Đã đọc</Badge>
                  )}
                </div>
                <h3 className="mt-2 line-clamp-2 font-semibold text-slate-800 dark:text-slate-100">
                  {lesson.title || `Buổi ${lesson.sessionNumber}`}
                </h3>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const CONTENT_TABS = [
  { id: 'lesson', label: 'Bài giảng', icon: BookOpen },
  { id: 'exercise', label: 'Bài tập', icon: PencilLine },
  { id: 'practice', label: 'Ôn tập', icon: HelpCircle },
];

function LessonDetail({
  lessons,
  activeIndex,
  lesson,
  classDoc,
  student,
  programId,
  onSelectLesson,
  onBack,
  onSubmitted,
  onQuizFocusChange,
  isFinalPhase = false,
}) {
  const { open, images, index, openLightbox, closeLightbox } = useImageLightbox();
  const [contentTab, setContentTab] = useState('lesson');
  const [quizPhase, setQuizPhase] = useState(null);
  const [fullLesson, setFullLesson] = useState(lesson);
  const [loadingContent, setLoadingContent] = useState(false);
  const quizExamActive = quizPhase === 'exam';
  const displayLesson = fullLesson || lesson;
  const hasExercise = Boolean(displayLesson.exercise && displayLesson.exerciseVisible);
  const allImages = lessonImages(displayLesson);
  const galleryItems = lessonGalleryImages(displayLesson);
  const heroUrl = displayLesson.bannerImageUrl || displayLesson.coverImageUrl;

  useEffect(() => {
    onQuizFocusChange?.(quizExamActive);
    return () => onQuizFocusChange?.(false);
  }, [quizExamActive, onQuizFocusChange]);

  useEffect(() => {
    setContentTab('lesson');
  }, [lesson.id]);

  useEffect(() => {
    setFullLesson(lesson);
    if (!programId || !lesson?.id) return undefined;
    if (lesson.content || lesson.exercise) return undefined;

    let cancelled = false;
    setLoadingContent(true);
    getProgramLesson(programId, lesson.id)
      .then((loaded) => {
        if (!cancelled && loaded) setFullLesson(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoadingContent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programId, lesson]);

  const setIndex = (i) => openLightbox(images, i);

  return (
    <div>
      {!quizExamActive && (
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:hover:text-brand-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Danh sách
      </button>
      )}

      {!quizExamActive && (
      <div className="student-sticky-below-header -mx-4 mb-4 overflow-x-auto border-b border-slate-200/80 bg-slate-50/95 px-4 py-2 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95 sm:mx-0 sm:rounded-xl sm:border sm:px-3 sm:backdrop-blur-none">
        <div className="flex gap-2 pb-1">
          {lessons.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onSelectLesson(i)}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                i === activeIndex
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-300 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-700'
              }`}
            >
              Buổi {l.sessionNumber}
            </button>
          ))}
        </div>
      </div>
      )}

      {!quizExamActive && (
      <article className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6">
          <Badge tone="brand">Buổi {displayLesson.sessionNumber}</Badge>
          <h1 className="mt-2 text-xl font-bold text-slate-800 dark:text-slate-50 sm:text-2xl">
            {displayLesson.title || `Buổi ${displayLesson.sessionNumber}`}
          </h1>
        </div>

        <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/50 sm:px-3">
          {CONTENT_TABS.map((tab) => {
            const Icon = tab.icon;
            const disabled = tab.id === 'exercise' && !hasExercise;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={disabled}
                onClick={() => setContentTab(tab.id)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition sm:gap-2 sm:px-4 ${
                  contentTab === tab.id
                    ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300'
                    : disabled
                      ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-5 sm:p-6">
          {loadingContent && contentTab === 'lesson' && (
            <div className="mb-4 flex justify-center py-6">
              <Spinner />
            </div>
          )}
          {contentTab === 'lesson' && (
            <>
              {heroUrl && (
                <button
                  type="button"
                  onClick={() => {
                    const idx = allImages.findIndex((img) => img.secureUrl === heroUrl);
                    openLightbox(allImages, idx >= 0 ? idx : 0);
                  }}
                  className="group relative mb-5 block w-full overflow-hidden rounded-xl"
                  aria-label="Phóng to ảnh"
                >
                  <img src={heroUrl} alt={displayLesson.title} className="aspect-[2/1] w-full object-cover" />
                  <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                    <ZoomIn className="h-3.5 w-3.5" />
                    Phóng to
                  </span>
                </button>
              )}

              {galleryItems.length > 0 && (
                <div className="mb-6">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Hình ảnh minh họa ({galleryItems.length})
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {galleryItems.map((img, i) => (
                      <button
                        key={img.secureUrl || i}
                        type="button"
                        onClick={() => {
                          const idx = allImages.findIndex((item) => item.secureUrl === img.secureUrl);
                          openLightbox(allImages, idx >= 0 ? idx : i);
                        }}
                        className="group relative overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-brand-400 dark:ring-slate-700"
                      >
                        <img
                          src={img.secureUrl}
                          alt={img.alt || `Hình minh họa ${i + 1}`}
                          className="aspect-video w-full object-contain bg-slate-100 transition group-hover:scale-[1.01] dark:bg-slate-900"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/10 sm:bg-black/0 sm:transition sm:group-hover:bg-black/20">
                          <ZoomIn className="h-6 w-6 text-white opacity-90 sm:opacity-0 sm:transition sm:group-hover:opacity-100" />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {displayLesson.content ? (
                <Markdown content={displayLesson.content} />
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">Chưa có nội dung bài giảng.</p>
              )}

              {Array.isArray(displayLesson.references) && displayLesson.references.length > 0 && (
                <div className="mt-6">
                  <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Tham khảo</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm">
                    {displayLesson.references.map((ref, i) => (
                      <li key={i}>
                        <a
                          href={typeof ref === 'string' ? ref : ref.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 underline dark:text-brand-300"
                        >
                          {typeof ref === 'string' ? ref : ref.title || ref.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {contentTab === 'exercise' && (
            hasExercise ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                <Markdown content={displayLesson.exercise} />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Buổi này chưa có bài tập.</p>
            )
          )}

          {contentTab === 'practice' && (
            <LessonPracticeQuiz
              lesson={displayLesson}
              classDoc={classDoc}
              student={student}
              programId={programId}
              embedded
            />
          )}
        </div>
      </article>
      )}

      {!quizExamActive && (
      <div className="mt-4 flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => onSelectLesson(activeIndex - 1)} disabled={activeIndex <= 0}>
          <ArrowLeft className="h-4 w-4" />
          Trước
        </Button>
        <Button
          variant="secondary"
          onClick={() => onSelectLesson(activeIndex + 1)}
          disabled={activeIndex >= lessons.length - 1}
        >
          Sau
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      )}

      <StudentQuizExam
        lesson={displayLesson}
        classDoc={classDoc}
        student={student}
        onPhaseChange={setQuizPhase}
      />

      {!quizExamActive && !isFinalPhase && (
        <FeedbackForm
          lesson={displayLesson}
          classDoc={classDoc}
          student={student}
          onSubmitted={onSubmitted}
        />
      )}

      <ImageLightbox
        open={open}
        images={images}
        index={index}
        onClose={closeLightbox}
        onIndexChange={setIndex}
      />
    </div>
  );
}

const EMPTY_FEEDBACK = {
  understoodTopics: '',
  unclearTopics: '',
  understandingLevel: 3,
  supportRequest: '',
};

function FeedbackForm({ lesson, classDoc, student, onSubmitted }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FEEDBACK);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setChecking(true);
    setSubmitted(false);
    setForm(EMPTY_FEEDBACK);
    const unsubscribe = subscribeFeedbackReceipt(
      classDoc.classCode,
      student.id,
      lesson.id,
      (done) => {
        setSubmitted(done);
        setChecking(false);
      },
      () => setChecking(false),
    );
    return unsubscribe;
  }, [lesson.id, classDoc.classCode, student.id]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    if (form.understoodTopics.trim().length < 5) return 'Phần "đã hiểu" cần ít nhất 5 ký tự.';
    if (form.unclearTopics.trim().length < 5) return 'Phần "chưa rõ" cần ít nhất 5 ký tự.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errorMsg = validate();
    if (errorMsg) {
      toast.error(errorMsg);
      return;
    }
    setSubmitting(true);
    try {
      await submitKnowledgeReport({ student, classDoc, lesson, form });
      setSubmitted(true);
      onSubmitted?.(lesson.id);
      toast.success('Đã gửi phản hồi.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <div className="card mt-5 flex items-center justify-center p-6">
        <Spinner />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="card mt-5 flex items-center gap-3 p-5">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />
        <Badge tone="green">Đã gửi phản hồi</Badge>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card mt-5 space-y-4 p-5">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Phản hồi buổi học</h3>

      <Field label="Bạn đã hiểu được gì?" required>
        <Textarea
          rows={3}
          value={form.understoodTopics}
          onChange={(e) => update('understoodTopics', e.target.value)}
          placeholder="Ví dụ: vòng lặp for, hàm in ra màn hình..."
        />
      </Field>

      <Field label="Phần nào còn chưa rõ?" required>
        <Textarea
          rows={3}
          value={form.unclearTopics}
          onChange={(e) => update('unclearTopics', e.target.value)}
          placeholder="Ví dụ: chưa rõ cách dùng list..."
        />
      </Field>

      <Field label="Mức độ hiểu bài">
        <Select
          value={form.understandingLevel}
          onChange={(e) => update('understandingLevel', Number(e.target.value))}
        >
          {UNDERSTANDING_LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Cần hỗ trợ thêm? (tuỳ chọn)">
        <Textarea
          rows={2}
          value={form.supportRequest}
          onChange={(e) => update('supportRequest', e.target.value)}
        />
      </Field>

      <div className="student-sticky-footer dark:border-slate-800">
        <Button type="submit" size="lg" className="w-full min-h-12" loading={submitting}>
          Gửi phản hồi
        </Button>
      </div>
    </form>
  );
}
