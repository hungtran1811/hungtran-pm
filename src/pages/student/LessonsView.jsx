import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  PlayCircle,
  ZoomIn,
  ChevronUp,
} from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { Field, Textarea, Select } from '../../ui/components/Field.jsx';
import { LessonContent } from '../../ui/components/LessonContent.jsx';
import { ImageLightbox, useImageLightbox } from '../../ui/components/ImageLightbox.jsx';
import { Spinner } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { UNDERSTANDING_LEVELS } from '../../constants/index.js';
import { unlockedLessonSessionCap } from '../../lib/sessionScope.js';
import { getProgramLesson } from '../../services/curriculum.service.js';
import {
  subscribeFeedbackReceipt,
  submitKnowledgeReport,
} from '../../services/knowledgeReports.service.js';
import { recordLessonOpened } from '../../services/students.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { FEATURE_KNOWLEDGE_FEEDBACK_ENABLED } from '../../config/features.js';

function readStorageKey(classCode, studentId) {
  return `lessonsRead:${classCode}:${studentId}`;
}

function lastLessonStorageKey(classCode, studentId) {
  return `lastLesson:${classCode}:${studentId}`;
}

const LESSON_RAIL_STORAGE_KEY = 'student:lesson-rail-collapsed:v1';
const FOCUSABLE_ELEMENT_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'iframe',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function loadLessonRailCollapsed() {
  try {
    return localStorage.getItem(LESSON_RAIL_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

function saveLessonRailCollapsed(collapsed) {
  try {
    localStorage.setItem(LESSON_RAIL_STORAGE_KEY, collapsed ? '1' : '0');
  } catch {
    // Layout preference remains optional when storage is unavailable.
  }
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
  autoOpenResume = !embedded,
  hideLessonList = false,
  showBack = true,
  backLabel = 'Danh sách',
  onExitReader,
  onFeedbackSubmitted,
  onActiveSessionChange,
}) {
  const [activeIndex, setActiveIndex] = useState(null);
  const [readIds, setReadIds] = useState(() => loadReadIds(classDoc.classCode, student.id));
  const lessonButtonRefs = useRef(new Map());
  const pendingListFocusLessonIdRef = useRef(null);
  const didAutoOpenRef = useRef(false);

  const lessons = useMemo(() => {
    if (!program) return [];
    const sessionCap = unlockedLessonSessionCap(classDoc);
    return program.lessons
      .filter((l) => !l.archived && Number(l.sessionNumber) <= sessionCap)
      .sort((a, b) => Number(a.sessionNumber) - Number(b.sessionNumber));
  }, [program, classDoc]);

  const submittedMap = useMemo(() => {
    const map = {};
    submittedLessonIds.forEach((lessonId) => {
      map[lessonId] = true;
    });
    return map;
  }, [submittedLessonIds]);

  useLayoutEffect(() => {
    const session =
      activeIndex !== null && lessons[activeIndex]
        ? Number(lessons[activeIndex].sessionNumber)
        : null;
    onActiveSessionChange?.(session);
  }, [activeIndex, lessons, onActiveSessionChange]);

  useEffect(() => {
    return () => onActiveSessionChange?.(null);
  }, [onActiveSessionChange]);

  useEffect(() => {
    if (activeIndex !== null || !pendingListFocusLessonIdRef.current) return;
    const lessonId = pendingListFocusLessonIdRef.current;
    pendingListFocusLessonIdRef.current = null;
    lessonButtonRefs.current.get(lessonId)?.focus({ preventScroll: true });
  }, [activeIndex]);

  const markRead = (lessonId) => {
    setReadIds((prev) => {
      if (prev.has(lessonId)) return prev;
      const next = new Set(prev);
      next.add(lessonId);
      try {
        localStorage.setItem(
          readStorageKey(classDoc.classCode, student.id),
          JSON.stringify([...next]),
        );
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

  const closeLesson = () => {
    if (onExitReader) {
      onExitReader();
      return;
    }
    if (hideLessonList) return;
    pendingListFocusLessonIdRef.current = lessons[activeIndex]?.id ?? null;
    setActiveIndex(null);
  };

  const resumeIndex = useMemo(
    () => resolveResumeIndex(lessons, classDoc, classDoc.classCode, student.id),
    [lessons, classDoc, student.id],
  );

  useLayoutEffect(() => {
    if (!autoOpenResume || didAutoOpenRef.current) return;
    if (resumeIndex == null) return;
    didAutoOpenRef.current = true;
    openLesson(resumeIndex);
  }, [autoOpenResume, resumeIndex]);

  if (!program) {
    return <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Chưa có chương trình học" />;
  }

  if (lessons.length === 0) {
    return <EmptyState icon={<BookOpen className="h-7 w-7" />} title="Chưa có bài giảng được mở" />;
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
        onBack={closeLesson}
        onSubmitted={(lessonId) => onFeedbackSubmitted?.(lessonId)}
        isFinalPhase={isFinalPhase}
        showBack={showBack}
        backLabel={backLabel}
      />
    );
  }

  if (hideLessonList) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
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
        <div
          className={`student-sticky-below-header border-b border-slate-200/80 bg-slate-50/95 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95 sm:static sm:rounded-xl sm:border sm:py-0 sm:backdrop-blur-none ${
            embedded ? 'mt-0 -mx-1 px-1 sm:mx-0 sm:px-0' : '-mx-4 mt-4 px-4 sm:mx-0'
          }`}
        >
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

      <div
        className={embedded ? 'mt-4 grid gap-3 sm:grid-cols-2' : 'mt-4 grid gap-3 sm:grid-cols-2'}
      >
        {lessons.map((lesson, index) => {
          const isRead = readIds.has(lesson.id);
          const isSubmitted = submittedMap[lesson.id];
          const thumb = lesson.bannerImageUrl || lesson.coverImageUrl;
          return (
            <button
              key={lesson.id}
              ref={(node) => {
                if (node) lessonButtonRefs.current.set(lesson.id, node);
                else lessonButtonRefs.current.delete(lesson.id);
              }}
              type="button"
              onClick={() => openLesson(index)}
              className="card group overflow-hidden text-left transition hover:border-brand-400 hover:shadow-md active:scale-[0.98]"
            >
              <div className="aspect-video w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
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
                  {isRead && !isSubmitted && <Badge tone="slate">Đã đọc</Badge>}
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
];

function LessonTabs({ contentTab, hasExercise, onChange, compact = false }) {
  return CONTENT_TABS.map((tab) => {
    const Icon = tab.icon;
    const disabled = tab.id === 'exercise' && !hasExercise;
    return (
      <button
        key={tab.id}
        type="button"
        disabled={disabled}
        onClick={() => onChange(tab.id)}
        className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition ${
          compact ? 'px-2 py-2 text-xs sm:text-sm' : 'px-2 py-2.5 text-sm sm:gap-2 sm:px-4'
        } ${
          contentTab === tab.id
            ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:text-brand-300'
            : disabled
              ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{tab.label}</span>
      </button>
    );
  });
}

function LessonSessionStrip({ lessons, activeIndex, onSelectLesson }) {
  const activeButtonRef = useRef(null);

  useEffect(() => {
    activeButtonRef.current?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeIndex]);

  return (
    <div className="student-sticky-below-header -mx-4 mb-4 border-b border-slate-200/80 bg-slate-50/95 px-4 py-3 backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/95 sm:mx-0 sm:rounded-xl sm:border sm:px-3 sm:backdrop-blur-none xl:hidden">
      <div className="mb-2 flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="min-h-10 min-w-10 shrink-0 px-0"
          onClick={() => onSelectLesson(activeIndex - 1)}
          disabled={activeIndex <= 0}
          aria-label="Buổi trước"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <p className="min-w-0 flex-1 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
          Buổi {lessons[activeIndex]?.sessionNumber}
          <span className="font-normal text-slate-400"> / {lessons.length}</span>
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="min-h-10 min-w-10 shrink-0 px-0"
          onClick={() => onSelectLesson(activeIndex + 1)}
          disabled={activeIndex >= lessons.length - 1}
          aria-label="Buổi sau"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2 overflow-x-auto py-1" aria-label="Danh sách buổi học">
        {lessons.map((item, itemIndex) => (
          <button
            key={item.id}
            ref={itemIndex === activeIndex ? activeButtonRef : undefined}
            type="button"
            onClick={() => onSelectLesson(itemIndex)}
            aria-label={`Buổi ${item.sessionNumber}: ${item.title || ''}`}
            aria-current={itemIndex === activeIndex ? 'true' : undefined}
            className={`min-h-10 min-w-12 shrink-0 rounded-xl px-3 text-sm font-semibold tabular-nums transition ${
              itemIndex === activeIndex
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand-300 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700'
            }`}
          >
            {item.sessionNumber}
          </button>
        ))}
      </div>
    </div>
  );
}

function LessonBackToTop({ scrollRoot }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const readTop = () => {
      if (scrollRoot) return scrollRoot.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || 0;
    };
    const onScroll = () => setVisible(readTop() > 360);
    onScroll();
    const target = scrollRoot || window;
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [scrollRoot]);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Quay lại đầu trang"
      onClick={() => {
        const options = { top: 0, behavior: 'smooth' };
        if (scrollRoot) scrollRoot.scrollTo(options);
        else window.scrollTo(options);
      }}
      className="student-back-to-top fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-[70] flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:bg-brand-500 dark:hover:bg-brand-400"
    >
      <ChevronUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

function LessonSessionRail({ lessons, activeIndex, collapsed, onCollapsedChange, onSelectLesson }) {
  return (
    <aside
      className={`hidden xl:sticky xl:top-[calc(var(--student-header-height)+1rem)] xl:block ${
        collapsed ? 'xl:w-[4.25rem]' : 'xl:w-[13.5rem]'
      }`}
      aria-label="Điều hướng buổi học"
    >
      <div className="max-h-[calc(100dvh-var(--student-header-height)-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div
          className={`mb-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-2 px-1'}`}
        >
          {!collapsed && (
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Các buổi học
            </p>
          )}
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-brand-300"
            aria-label={collapsed ? 'Mở rộng thanh buổi học' : 'Thu gọn thanh buổi học'}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
        <div className="space-y-1">
          {lessons.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectLesson(itemIndex)}
              aria-label={`Buổi ${item.sessionNumber}: ${item.title || ''}`}
              aria-current={itemIndex === activeIndex ? 'page' : undefined}
              title={collapsed ? `Buổi ${item.sessionNumber}: ${item.title || ''}` : undefined}
              className={`flex min-h-11 w-full items-center rounded-xl text-left text-sm transition ${
                collapsed ? 'justify-center px-1' : 'gap-2 px-3'
              } ${
                itemIndex === activeIndex
                  ? 'bg-brand-600 font-semibold text-white shadow-sm'
                  : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-brand-500/10 dark:hover:text-brand-300'
              }`}
            >
              <span className="shrink-0 font-semibold tabular-nums">{item.sessionNumber}</span>
              {!collapsed && (
                <span className="line-clamp-2 min-w-0">
                  {item.title || `Buổi ${item.sessionNumber}`}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

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
  isFinalPhase = false,
  showBack = true,
  backLabel = 'Danh sách',
}) {
  const { open, images, index, openLightbox, closeLightbox } = useImageLightbox();
  const [contentTab, setContentTab] = useState('lesson');
  const [fullLesson, setFullLesson] = useState(lesson);
  const [loadingContent, setLoadingContent] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(loadLessonRailCollapsed);
  const [focusMode, setFocusMode] = useState(false);
  const focusContainerRef = useRef(null);
  const focusTriggerRef = useRef(null);
  const focusWasOpenRef = useRef(false);
  const displayLesson = fullLesson || lesson;
  const hasExercise = Boolean(displayLesson.exercise && displayLesson.exerciseVisible);
  const allImages = lessonImages(displayLesson);
  const galleryItems = lessonGalleryImages(displayLesson);
  const heroUrl = displayLesson.bannerImageUrl || displayLesson.coverImageUrl;

  useEffect(() => {
    setContentTab('lesson');
  }, [lesson.id]);

  useEffect(() => {
    if (!focusMode) {
      if (!focusWasOpenRef.current) return undefined;
      focusWasOpenRef.current = false;
      const timer = window.setTimeout(() => focusTriggerRef.current?.focus(), 0);
      return () => window.clearTimeout(timer);
    }

    focusWasOpenRef.current = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    focusContainerRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (document.querySelector('[role="dialog"][aria-label="Xem ảnh"]')) return;

      if (event.key === 'Tab') {
        const focusContainer = focusContainerRef.current;
        if (!focusContainer) return;

        const focusableElements = [...focusContainer.querySelectorAll(FOCUSABLE_ELEMENT_SELECTOR)];
        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements.at(-1);

        if (!firstFocusableElement || !lastFocusableElement) {
          event.preventDefault();
          focusContainer.focus({ preventScroll: true });
          return;
        }

        if (
          event.shiftKey &&
          (document.activeElement === firstFocusableElement ||
            document.activeElement === focusContainer ||
            !focusContainer.contains(document.activeElement))
        ) {
          event.preventDefault();
          lastFocusableElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
          event.preventDefault();
          firstFocusableElement.focus();
        }
        return;
      }

      if (event.key !== 'Escape') return;
      event.preventDefault();
      setFocusMode(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [focusMode]);

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
  const handleRailCollapsedChange = useCallback((collapsed) => {
    setRailCollapsed(collapsed);
    saveLessonRailCollapsed(collapsed);
  }, []);
  const handleBack = () => {
    setFocusMode(false);
    if (showBack) onBack();
  };

  return (
    <div
      ref={focusContainerRef}
      className={
        focusMode
          ? 'fixed inset-0 z-[60] h-[100dvh] overflow-y-auto bg-slate-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] outline-none dark:bg-slate-950 sm:px-6'
          : ''
      }
      role={focusMode ? 'dialog' : undefined}
      aria-modal={focusMode ? 'true' : undefined}
      aria-label={
        focusMode
          ? `Chế độ tập trung: ${displayLesson.title || `Buổi ${displayLesson.sessionNumber}`}`
          : undefined
      }
      tabIndex={focusMode ? -1 : undefined}
    >
      {focusMode && (
        <div className="sticky top-0 z-20 mx-auto mb-4 max-w-[90rem] rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
          <div className="flex items-center gap-2">
            {showBack ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-300"
                aria-label={backLabel}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </button>
            ) : (
              <span className="w-10 shrink-0" />
            )}
            <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
              Buổi {displayLesson.sessionNumber} · {displayLesson.title || 'Bài giảng'}
            </p>
            <button
              type="button"
              onClick={() => setFocusMode(false)}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-brand-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-300"
              aria-label="Thoát chế độ tập trung"
            >
              <Minimize2 className="h-4 w-4" />
              <span className="hidden sm:inline">Thoát</span>
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10 min-w-10 shrink-0 px-0"
              onClick={() => onSelectLesson(activeIndex - 1)}
              disabled={activeIndex <= 0}
              aria-label="Buổi trước"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 flex-1 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/70">
              <LessonTabs
                contentTab={contentTab}
                hasExercise={hasExercise}
                onChange={setContentTab}
                compact
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10 min-w-10 shrink-0 px-0"
              onClick={() => onSelectLesson(activeIndex + 1)}
              disabled={activeIndex >= lessons.length - 1}
              aria-label="Buổi sau"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!focusMode && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-medium text-slate-500 transition hover:text-brand-600 dark:hover:text-brand-300"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </button>
          ) : (
            <span />
          )}
          <button
            ref={focusTriggerRef}
            type="button"
            onClick={() => setFocusMode(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
          >
            <Maximize2 className="h-4 w-4" />
            Chế độ tập trung
          </button>
        </div>
      )}

      {!focusMode && (
        <LessonSessionStrip
          lessons={lessons}
          activeIndex={activeIndex}
          onSelectLesson={onSelectLesson}
        />
      )}

      <div
        className={
          !focusMode
            ? `xl:grid xl:items-start xl:gap-5 ${
                railCollapsed
                  ? 'xl:grid-cols-[4.25rem_minmax(0,1fr)]'
                  : 'xl:grid-cols-[13.5rem_minmax(0,1fr)]'
              }`
            : 'mx-auto max-w-[90rem]'
        }
      >
        {!focusMode && (
          <LessonSessionRail
            lessons={lessons}
            activeIndex={activeIndex}
            collapsed={railCollapsed}
            onCollapsedChange={handleRailCollapsedChange}
            onSelectLesson={onSelectLesson}
          />
        )}

        <div className="min-w-0">
          <article className="card overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6 lg:px-8">
                <Badge tone="brand">Buổi {displayLesson.sessionNumber}</Badge>
                <h1 className="mt-2 text-xl font-bold text-slate-800 dark:text-slate-50 sm:text-2xl lg:text-3xl">
                  {displayLesson.title || `Buổi ${displayLesson.sessionNumber}`}
                </h1>
              </div>

              {!focusMode && (
                <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-700 dark:bg-slate-800/50 sm:px-3">
                  <LessonTabs
                    contentTab={contentTab}
                    hasExercise={hasExercise}
                    onChange={setContentTab}
                  />
                </div>
              )}

              <div className="p-5 sm:p-6 lg:p-8">
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
                          const imageIndex = allImages.findIndex(
                            (img) => img.secureUrl === heroUrl,
                          );
                          openLightbox(allImages, imageIndex >= 0 ? imageIndex : 0);
                        }}
                        className="group relative mb-5 block w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800"
                        aria-label="Phóng to ảnh"
                      >
                        <img
                          src={heroUrl}
                          alt={displayLesson.title}
                          className="aspect-[2/1] h-auto w-full object-contain"
                        />
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
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {galleryItems.map((img, imageIndex) => (
                            <button
                              key={img.secureUrl || imageIndex}
                              type="button"
                              onClick={() => {
                                const lightboxIndex = allImages.findIndex(
                                  (item) => item.secureUrl === img.secureUrl,
                                );
                                openLightbox(
                                  allImages,
                                  lightboxIndex >= 0 ? lightboxIndex : imageIndex,
                                );
                              }}
                              className="group relative overflow-hidden rounded-xl ring-1 ring-slate-200 transition hover:ring-brand-400 dark:ring-slate-700"
                            >
                              <img
                                src={img.secureUrl}
                                alt={img.alt || `Hình minh họa ${imageIndex + 1}`}
                                className="aspect-video w-full bg-slate-100 object-contain transition group-hover:scale-[1.01] dark:bg-slate-900"
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
                      <LessonContent
                        format={displayLesson.contentRenderFormat ?? displayLesson.contentFormat}
                        content={displayLesson.content}
                        protectCopy
                      />
                    ) : (
                      <p className="py-8 text-center text-sm text-slate-400">
                        Chưa có nội dung bài giảng.
                      </p>
                    )}

                    {Array.isArray(displayLesson.references) &&
                      displayLesson.references.length > 0 && (
                        <div className="mt-6">
                          <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Tham khảo
                          </p>
                          <ul className="list-disc space-y-1 pl-5 text-sm">
                            {displayLesson.references.map((reference, referenceIndex) => (
                              <li key={referenceIndex}>
                                <a
                                  href={typeof reference === 'string' ? reference : reference.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-brand-600 underline dark:text-brand-300"
                                >
                                  {typeof reference === 'string'
                                    ? reference
                                    : reference.title || reference.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </>
                )}

                {contentTab === 'exercise' &&
                  (hasExercise ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-500/20 dark:bg-amber-500/10 sm:px-6 sm:py-5">
                      <LessonContent
                        format={displayLesson.exerciseRenderFormat ?? displayLesson.contentFormat}
                        content={displayLesson.exercise}
                        protectCopy
                      />
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-400">
                      Buổi này chưa có bài tập.
                    </p>
                  ))}
              </div>
            </article>

          {!focusMode && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                onClick={() => onSelectLesson(activeIndex - 1)}
                disabled={activeIndex <= 0}
              >
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

          {FEATURE_KNOWLEDGE_FEEDBACK_ENABLED && !isFinalPhase && (
            <FeedbackForm
              lesson={displayLesson}
              classDoc={classDoc}
              student={student}
              onSubmitted={onSubmitted}
            />
          )}
        </div>
      </div>

      <LessonBackToTop scrollRoot={focusMode ? focusContainerRef.current : null} />
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
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
        Phản hồi buổi học
      </h3>

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
