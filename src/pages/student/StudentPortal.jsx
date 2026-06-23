import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Ban, Mountain, Search, Swords, UserRound, Users } from 'lucide-react';
import { StudentShell } from './StudentShell.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Input } from '../../ui/components/Field.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { FullPageLoader } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { subscribeClass } from '../../services/classes.service.js';
import {
  listActiveStudentsByClass,
  subscribeStudent,
} from '../../services/students.service.js';
import { getCurriculumProgram } from '../../services/curriculum.service.js';
import { getStudentFeedbackLessonIds } from '../../services/knowledgeReports.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { LessonsView } from './LessonsView.jsx';
import { StudentOverview } from './StudentOverview.jsx';
import { StudentFeedbackHistory } from './StudentFeedbackHistory.jsx';
import { ProjectNamePendingBanner, ProjectNameSetup } from './ProjectNameSetup.jsx';
import {
  classUsesProjectNames,
  isProjectNameApproved,
  isProjectNameAwaitingReview,
  needsProjectNameSetup,
  projectNameDisplay,
  resolveFinalMode,
} from '../../lib/classFinalMode.js';
import { FEATURE_CODING_SHOWDOWN_ENABLED, FEATURE_OLYMPIA_ENABLED, FEATURE_SPY_GAME_ENABLED } from '../../config/features.js';

const OlympiaStudentViewLazy = FEATURE_OLYMPIA_ENABLED
  ? lazy(() => import('./OlympiaStudentView.jsx').then((m) => ({ default: m.OlympiaStudentView })))
  : null;

const ShowdownStudentViewLazy = FEATURE_CODING_SHOWDOWN_ENABLED
  ? lazy(() => import('./ShowdownStudentView.jsx').then((m) => ({ default: m.ShowdownStudentView })))
  : null;

const SpyStudentViewLazy = FEATURE_SPY_GAME_ENABLED
  ? lazy(() => import('./SpyStudentView.jsx').then((m) => ({ default: m.SpyStudentView })))
  : null;

const FinalProjectStudentViewLazy = lazy(() =>
  import('./FinalProjectStudentView.jsx').then((m) => ({ default: m.FinalProjectStudentView })),
);

function storageKey(classCode) {
  return `student:${classCode}`;
}

export function StudentPortalPage() {
  const { classCode: rawCode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const classCode = decodeURIComponent(rawCode || '');
  const olympiaParam = searchParams.get('olympia');
  const showdownParam = searchParams.get('showdown');
  const spyParam = searchParams.get('spy');
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [classDoc, setClassDoc] = useState(null);
  const [students, setStudents] = useState([]);
  const [program, setProgram] = useState(null);
  const [error, setError] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(() => {
    try {
      return localStorage.getItem(storageKey(classCode)) || null;
    } catch {
      return null;
    }
  });
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [submittedLessonIds, setSubmittedLessonIds] = useState([]);
  const [activeOlympia, setActiveOlympia] = useState(null);
  const [olympiaSessionId, setOlympiaSessionId] = useState(() => olympiaParam || null);
  const [activeShowdown, setActiveShowdown] = useState(null);
  const [showdownSessionId, setShowdownSessionId] = useState(() => showdownParam || null);
  const [activeSpy, setActiveSpy] = useState(null);
  const [spySessionId, setSpySessionId] = useState(() => spyParam || null);
  const [quizFocus, setQuizFocus] = useState(false);

  useEffect(() => {
    if (!classCode) return;
    setLoading(true);
    setError('');

    const unsubscribeClass = subscribeClass(
      classCode,
      (cls) => {
        if (!cls) {
          setError('Không tìm thấy lớp học với mã này.');
          setClassDoc(null);
          setLoading(false);
          return;
        }
        if (cls.status !== 'active' || cls.hidden) {
          setError('Lớp học này hiện không mở. Vui lòng liên hệ giáo viên.');
          setClassDoc(null);
          setLoading(false);
          return;
        }
        setClassDoc(cls);
        setLoading(false);
      },
      (err) => {
        setError(getErrorMessage(err));
        setLoading(false);
      },
    );

    listActiveStudentsByClass(classCode)
      .then(setStudents)
      .catch((err) => toast.error(getErrorMessage(err)));

    return () => {
      unsubscribeClass();
    };
  }, [classCode, toast]);

  useEffect(() => {
    if (!classDoc?.curriculumProgramId) {
      setProgram(null);
      return undefined;
    }
    let cancelled = false;
    getCurriculumProgram(classDoc.curriculumProgramId, { full: false })
      .then((data) => {
        if (!cancelled) setProgram(data);
      })
      .catch((err) => toast.error(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [classDoc?.curriculumProgramId, classDoc?.curriculumCurrentSession, toast]);

  useEffect(() => {
    if (!selectedStudentId || !classDoc?.classCode) {
      setSubmittedLessonIds([]);
      return undefined;
    }
    let cancelled = false;
    getStudentFeedbackLessonIds(classDoc.classCode, selectedStudentId)
      .then((lessonIds) => {
        if (!cancelled) setSubmittedLessonIds(lessonIds);
      })
      .catch((err) => {
        if (!cancelled) toast.error(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId, classDoc?.classCode]);

  useEffect(() => {
    if (!selectedStudentId) {
      setSelectedStudent(null);
      return;
    }
    const saved = students.find((s) => s.id === selectedStudentId);
    if (saved) setSelectedStudent(saved);
  }, [students, selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) return undefined;
    const unsubscribe = subscribeStudent(
      selectedStudentId,
      (student) => {
        if (student?.active) setSelectedStudent(student);
      },
      () => {},
    );
    return unsubscribe;
  }, [selectedStudentId]);

  useEffect(() => {
    if (!FEATURE_OLYMPIA_ENABLED || !olympiaParam) return;
    setOlympiaSessionId(olympiaParam);
  }, [olympiaParam]);

  useEffect(() => {
    if (!FEATURE_OLYMPIA_ENABLED || !classCode) return undefined;
    let cancelled = false;
    let unsubscribe = () => {};
    import('../../services/olympia.service.js').then(({ subscribeActiveOlympiaForClass }) => {
      if (cancelled) return;
      unsubscribe = subscribeActiveOlympiaForClass(classCode, setActiveOlympia, () => {});
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [classCode]);

  const enterOlympia = (sessionId) => {
    setOlympiaSessionId(sessionId);
    const next = new URLSearchParams(searchParams);
    next.set('olympia', sessionId);
    setSearchParams(next, { replace: true });
  };

  const exitOlympia = () => {
    setOlympiaSessionId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('olympia');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!FEATURE_CODING_SHOWDOWN_ENABLED || !showdownParam || !classCode) return;
    let cancelled = false;
    import('../../services/showdown.service.js').then(({ fetchShowdownSession }) => {
      fetchShowdownSession(showdownParam).then((session) => {
        if (cancelled) return;
        if (!session) {
          toast.error('Không tìm thấy phòng thi.');
          setShowdownSessionId(null);
          const next = new URLSearchParams(searchParams);
          next.delete('showdown');
          setSearchParams(next, { replace: true });
          return;
        }
        if (session.classCode !== classCode) {
          toast.error('Phòng thi không thuộc lớp học này.');
          setShowdownSessionId(null);
          const next = new URLSearchParams(searchParams);
          next.delete('showdown');
          setSearchParams(next, { replace: true });
          return;
        }
        setShowdownSessionId(showdownParam);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [showdownParam, classCode, toast, searchParams, setSearchParams]);

  // Students can't list showdownSessions (Firestore rules block anonymous list),
  // so we follow the active session id mirrored on the class doc and read it by id.
  const activeShowdownPointer = classDoc?.activeShowdownSessionId || null;
  useEffect(() => {
    if (!FEATURE_CODING_SHOWDOWN_ENABLED || !activeShowdownPointer) {
      setActiveShowdown(null);
      return undefined;
    }
    let cancelled = false;
    let unsubscribe = () => {};
    import('../../services/showdown.service.js').then(({ subscribeShowdownSession }) => {
      if (cancelled) return;
      unsubscribe = subscribeShowdownSession(
        activeShowdownPointer,
        (data) => setActiveShowdown(data),
        (err) => {
          console.error('[showdown] active session subscription failed:', err);
          setActiveShowdown(null);
        },
      );
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeShowdownPointer]);

  useEffect(() => {
    if (!FEATURE_SPY_GAME_ENABLED || !spyParam || !classCode) return;
    let cancelled = false;
    import('../../services/spy.service.js').then(({ fetchSpySession }) => {
      fetchSpySession(spyParam).then((session) => {
        if (cancelled) return;
        if (!session) {
          toast.error('Không tìm thấy phòng chơi.');
          setSpySessionId(null);
          const next = new URLSearchParams(searchParams);
          next.delete('spy');
          setSearchParams(next, { replace: true });
          return;
        }
        if (session.classCode !== classCode) {
          toast.error('Phòng chơi không thuộc lớp học này.');
          setSpySessionId(null);
          const next = new URLSearchParams(searchParams);
          next.delete('spy');
          setSearchParams(next, { replace: true });
          return;
        }
        setSpySessionId(spyParam);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [spyParam, classCode, toast, searchParams, setSearchParams]);

  const activeSpyPointer = classDoc?.activeSpySessionId || null;
  useEffect(() => {
    if (!FEATURE_SPY_GAME_ENABLED || !activeSpyPointer) {
      setActiveSpy(null);
      return undefined;
    }
    let cancelled = false;
    let unsubscribe = () => {};
    import('../../services/spy.service.js').then(({ subscribeSpySession }) => {
      if (cancelled) return;
      unsubscribe = subscribeSpySession(
        activeSpyPointer,
        (data) => setActiveSpy(data),
        () => setActiveSpy(null),
      );
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeSpyPointer]);

  const enterSpy = (sessionId) => {
    if (activeSpy?.classCode && activeSpy.classCode !== classCode) {
      toast.error('Phòng chơi không thuộc lớp học này.');
      return;
    }
    setSpySessionId(sessionId);
    const next = new URLSearchParams(searchParams);
    next.set('spy', sessionId);
    setSearchParams(next, { replace: true });
  };

  const exitSpy = () => {
    setSpySessionId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('spy');
    setSearchParams(next, { replace: true });
  };

  const enterShowdown = (sessionId) => {
    if (activeShowdown?.classCode && activeShowdown.classCode !== classCode) {
      toast.error('Phòng thi không thuộc lớp học này.');
      return;
    }
    setShowdownSessionId(sessionId);
    const next = new URLSearchParams(searchParams);
    next.set('showdown', sessionId);
    setSearchParams(next, { replace: true });
  };

  const exitShowdown = () => {
    setShowdownSessionId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('showdown');
    setSearchParams(next, { replace: true });
  };

  const isFinalPhase = classDoc?.curriculumPhase === 'final';
  const finalMode = resolveFinalMode(classDoc, program);

  const bottomNavItems = useMemo(() => {
    const items = [{ id: 'overview', label: 'Tổng quan', sectionId: 'student-overview' }];
    if (isFinalPhase && finalMode === 'project') {
      items.push({ id: 'report', label: 'Dự án', sectionId: 'student-report' });
    } else {
      items.push({ id: 'lessons', label: 'Bài giảng', sectionId: 'student-lessons' });
      if (!isFinalPhase) {
        items.push({ id: 'feedback', label: 'Phản hồi', sectionId: 'student-feedback' });
      }
    }
    return items;
  }, [isFinalPhase, finalMode]);

  const showOlympiaBanner =
    FEATURE_OLYMPIA_ENABLED &&
    !olympiaSessionId &&
    activeOlympia &&
    selectedStudent &&
    ['lobby', 'playing', 'reveal'].includes(activeOlympia.status);

  const showShowdownBanner =
    FEATURE_CODING_SHOWDOWN_ENABLED &&
    !showdownSessionId &&
    activeShowdown &&
    selectedStudent &&
    ['lobby', 'playing', 'reveal'].includes(activeShowdown.status);

  const showSpyBanner =
    FEATURE_SPY_GAME_ENABLED &&
    !spySessionId &&
    activeSpy &&
    selectedStudent &&
    ['lobby', 'describe', 'vote', 'reveal'].includes(activeSpy.status);

  const chooseStudent = (student) => {
    setSelectedStudentId(student.id);
    setSelectedStudent(student);
    localStorage.setItem(storageKey(classCode), student.id);
  };

  const clearStudent = () => {
    setSelectedStudentId(null);
    setSelectedStudent(null);
    localStorage.removeItem(storageKey(classCode));
  };

  if (loading) return <FullPageLoader label="Đang tải lớp học..." />;

  if (error) {
    return (
      <StudentShell>
        <EmptyState icon={<Ban className="h-7 w-7" />} title="Không thể truy cập" description={error} />
      </StudentShell>
    );
  }

  if (!selectedStudent) {
    return (
      <StudentShell subtitle={classDoc.className || classDoc.classCode}>
        <StudentPicker students={students} onPick={chooseStudent} />
      </StudentShell>
    );
  }

  const usesProjectNames = classUsesProjectNames(classDoc, program);
  const awaitingProjectReview = isProjectNameAwaitingReview(selectedStudent);
  const showProjectSetup = needsProjectNameSetup(selectedStudent, classDoc, program);
  const showProjectNameSection = usesProjectNames && (
    awaitingProjectReview
    || selectedStudent.projectNameStatus === 'rejected'
    || (isFinalPhase && showProjectSetup)
  );
  const displayProject = projectNameDisplay(selectedStudent);

  if (FEATURE_SPY_GAME_ENABLED && spySessionId && selectedStudent && SpyStudentViewLazy) {
    const SpyStudentView = SpyStudentViewLazy;
    return (
      <StudentShell subtitle={`${classDoc.className || classDoc.classCode} · Truy tìm gián điệp`}>
        <Suspense fallback={<FullPageLoader label="Đang tải Truy tìm gián điệp..." />}>
          <SpyStudentView
            sessionId={spySessionId}
            classCode={classCode}
            student={selectedStudent}
            classStudents={students}
            onExit={exitSpy}
          />
        </Suspense>
      </StudentShell>
    );
  }

  if (FEATURE_CODING_SHOWDOWN_ENABLED && showdownSessionId && selectedStudent && ShowdownStudentViewLazy) {
    const ShowdownStudentView = ShowdownStudentViewLazy;
    return (
      <StudentShell subtitle={`${classDoc.className || classDoc.classCode} · Coding Showdown`}>
        <Suspense fallback={<FullPageLoader label="Đang tải Coding Showdown..." />}>
          <ShowdownStudentView
            sessionId={showdownSessionId}
            classCode={classCode}
            student={selectedStudent}
            onExit={exitShowdown}
          />
        </Suspense>
      </StudentShell>
    );
  }

  if (FEATURE_OLYMPIA_ENABLED && olympiaSessionId && selectedStudent && OlympiaStudentViewLazy) {
    const OlympiaStudentView = OlympiaStudentViewLazy;
    return (
      <StudentShell
        subtitle={`${classDoc.className || classDoc.classCode} · Olympia`}
        right={
          <Button variant="subtle" size="sm" onClick={clearStudent} className="shadow-sm">
            <UserRound className="h-4 w-4" />
            Đổi tên
          </Button>
        }
      >
        <Suspense fallback={<FullPageLoader label="Đang tải Olympia..." />}>
          <OlympiaStudentView
            sessionId={olympiaSessionId}
            classCode={classCode}
            student={selectedStudent}
            onExit={exitOlympia}
          />
        </Suspense>
      </StudentShell>
    );
  }

  return (
    <StudentShell
      subtitle={`${classDoc.className || classDoc.classCode}`}
      bottomNavItems={quizFocus ? [] : bottomNavItems}
      right={
        <Button variant="subtle" size="sm" onClick={clearStudent} className="shadow-sm">
          <UserRound className="h-4 w-4" />
          <span className="hidden sm:inline">Đổi tên</span>
        </Button>
      }
    >
      <div className="mb-5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-4 text-white shadow-sm">
        <p className="text-xl font-bold sm:text-2xl">{selectedStudent.fullName}</p>
        {displayProject && isProjectNameApproved(selectedStudent) && (
          <p className="mt-0.5 text-sm text-brand-100">{displayProject}</p>
        )}
      </div>

      {showProjectNameSection && (
        showProjectSetup && !awaitingProjectReview ? (
          <ProjectNameSetup student={selectedStudent} />
        ) : (
          <ProjectNamePendingBanner student={selectedStudent} />
        )
      )}

      {showOlympiaBanner && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Mountain className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">Olympia Python đang diễn ra!</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Giáo viên đã mở phòng thi — tham gia ngay để leo núi cùng lớp.
              </p>
            </div>
          </div>
          <Button onClick={() => enterOlympia(activeOlympia.id)} className="min-h-12 shrink-0">
            Tham gia Olympia
          </Button>
        </div>
      )}

      {showSpyBanner && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border-2 border-violet-400/50 bg-gradient-to-r from-violet-500/10 to-purple-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Search className="mt-0.5 h-6 w-6 shrink-0 text-violet-600 dark:text-violet-400" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">Truy tìm gián điệp đang diễn ra!</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Giáo viên đã mở phòng — tham gia ngay để nhận từ khóa và tìm gián điệp.
              </p>
            </div>
          </div>
          <Button onClick={() => enterSpy(activeSpy.id)} className="min-h-12 shrink-0">
            Tham gia
          </Button>
        </div>
      )}

      {showShowdownBanner && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border-2 border-cyan-400/50 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Swords className="mt-0.5 h-6 w-6 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100">Coding Showdown đang diễn ra!</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Giáo viên đã mở phòng thi đấu — tham gia ngay để ghi điểm cùng lớp.
              </p>
            </div>
          </div>
          <Button onClick={() => enterShowdown(activeShowdown.id)} className="min-h-12 shrink-0">
            Tham gia Showdown
          </Button>
        </div>
      )}

      <section id="student-overview" className="scroll-mt-[4.5rem]">
        <StudentOverview
          classDoc={classDoc}
          student={selectedStudent}
          program={program}
          isFinalPhase={isFinalPhase}
          submittedLessonIds={submittedLessonIds}
        />
      </section>

      {!isFinalPhase && (
        <section id="student-feedback" className="mt-8 scroll-mt-[4.5rem]">
          <StudentFeedbackHistory
            classCode={classDoc.classCode}
            studentId={selectedStudent.id}
            program={program}
            isFinalPhase={isFinalPhase}
          />
        </section>
      )}

      {isFinalPhase && finalMode === 'project' && (
        <section id="student-report" className="mt-8 scroll-mt-[4.5rem]">
          <Suspense fallback={<FullPageLoader label="Đang tải báo cáo dự án..." />}>
            <FinalProjectStudentViewLazy
              classDoc={classDoc}
              program={program}
              student={selectedStudent}
              submittedLessonIds={submittedLessonIds}
              onQuizFocusChange={setQuizFocus}
              onFeedbackSubmitted={(lessonId) =>
                setSubmittedLessonIds((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
              }
            />
          </Suspense>
        </section>
      )}

      {!(isFinalPhase && finalMode === 'project') && (
      <section id="student-lessons" className="mt-8 scroll-mt-[4.5rem]">
        <LessonsView
          classDoc={classDoc}
          program={program}
          student={selectedStudent}
          submittedLessonIds={submittedLessonIds}
          isFinalPhase={isFinalPhase}
          onQuizFocusChange={setQuizFocus}
          onFeedbackSubmitted={(lessonId) =>
            setSubmittedLessonIds((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
          }
        />
      </section>
      )}
    </StudentShell>
  );
}

function studentInitial(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function StudentPicker({ students, onPick }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [students, search]);

  if (students.length === 0) {
    return (
      <EmptyState icon={<Users className="h-7 w-7" />} title="Chưa có học sinh" />
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Chọn tên của bạn</h2>
      <div className="mt-4">
        <Input
          placeholder="Tìm tên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="text-base"
        />
      </div>
      <div className="mt-4 space-y-2">
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s)}
            className="card flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:border-brand-400 hover:shadow-md active:scale-[0.98]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
              {studentInitial(s.fullName)}
            </span>
            <span className="min-w-0 flex-1 text-base font-medium text-slate-800 dark:text-slate-100">
              {s.fullName}
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-brand-500" />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">Không tìm thấy tên phù hợp.</p>
        )}
      </div>
    </div>
  );
}
