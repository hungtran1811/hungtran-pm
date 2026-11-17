import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { signInWithCustomToken, signOut } from 'firebase/auth';
import { ArrowRight, Ban, BookOpen, FolderKanban, UserRound, Users } from 'lucide-react';
import { StudentShell } from './StudentShell.jsx';
import { StudentGameJoinNotice } from './StudentGameJoinNotice.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input } from '../../ui/components/Field.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { FullPageLoader } from '../../ui/components/Spinner.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { subscribeClass } from '../../services/classes.service.js';
import { listRosterForClass, subscribeStudent } from '../../services/students.service.js';
import { subscribeCurriculumProgram } from '../../services/curriculum.service.js';
import { getStudentFeedbackLessonIds } from '../../services/knowledgeReports.service.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { resolveClassCode } from '../../services/studentGate.service.js';
import { getStudentAuth } from '../../config/studentFirebase.js';
import { setStudentFirestoreActive } from '../../config/activeFirestore.js';
import { StudentPinGate } from '../../ui/components/StudentPinGate.jsx';
import { ProjectNamePendingBanner, ProjectNameSetup } from './ProjectNameSetup.jsx';
import {
  isProjectNameApproved,
  isProjectNameAwaitingReview,
  needsProjectNameSetup,
  projectNameDisplay,
} from '../../lib/classFinalMode.js';
import {
  FEATURE_CODING_SHOWDOWN_ENABLED,
  FEATURE_DRIVE_SUBMISSION_ENABLED,
  FEATURE_KNOWLEDGE_FEEDBACK_ENABLED,
  FEATURE_SPY_GAME_ENABLED,
} from '../../config/features.js';
import {
  studentClassBasePath,
  studentLearnPath,
  studentLessonsPath,
  studentProjectPath,
  studentSessionContextLabel,
  studentSubmitPath,
  studentUsesProjectWorkspace,
  studentWorkspaceHomePath,
} from '../../lib/studentWorkspace.js';
import { DriveSubmitPage } from './DriveSubmitPage.jsx';
import { classRoadmapSessions } from '../../lib/submissionLessons.js';

const LessonsViewLazy = lazy(() =>
  import('./LessonsView.jsx').then((m) => ({ default: m.LessonsView })),
);

const ShowdownStudentViewLazy = FEATURE_CODING_SHOWDOWN_ENABLED
  ? lazy(() =>
      import('./ShowdownStudentView.jsx').then((m) => ({ default: m.ShowdownStudentView })),
    )
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
  const [activeShowdown, setActiveShowdown] = useState(null);
  const [showdownSessionId, setShowdownSessionId] = useState(() => showdownParam || null);
  const [activeSpy, setActiveSpy] = useState(null);
  const [spySessionId, setSpySessionId] = useState(() => spyParam || null);
  const [activeLessonSession, setActiveLessonSession] = useState(null);
  const [pinReady, setPinReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!classCode) return;
    setLoading(true);
    setError('');

    let cancelled = false;
    const unsubscribeClass = subscribeClass(
      classCode,
      (cls) => {
        if (!cls) {
          resolveClassCode(classCode)
            .then((result) => {
              if (result.status === 'resolved' && result.canonicalClassCode !== classCode) {
                navigate(`/c/${encodeURIComponent(result.canonicalClassCode)}${location.search}`, { replace: true });
                return;
              }
              setError(
                result.status === 'ambiguous'
                  ? result.message
                  : result.status === 'unavailable'
                    ? 'Lớp học này hiện không mở. Vui lòng liên hệ giáo viên.'
                    : 'Không tìm thấy lớp học với mã này.',
              );
              setClassDoc(null);
              setLoading(false);
            })
            .catch(() => {
              setError('Không tìm thấy lớp học với mã này.');
              setClassDoc(null);
              setLoading(false);
            });
          return;
        }
        if (cls.hidden || (cls.status !== 'active' && cls.status !== 'completed')) {
          setError('Lớp học này hiện không mở. Vui lòng liên hệ giáo viên.');
          setClassDoc(null);
          setStudents([]);
          setLoading(false);
          return;
        }
        setClassDoc(cls);
        setLoading(false);
        listRosterForClass(cls.classCode, { includeHistory: cls.status === 'completed' })
          .then((rows) => {
            if (!cancelled) setStudents(rows);
          })
          .catch((err) => {
            if (!cancelled) toast.error(getErrorMessage(err));
          });
      },
      (err) => {
        const msg = getErrorMessage(err);
        setError(
          err?.code === 'permission-denied'
            ? 'Không đọc được lớp này. Kiểm tra mã lớp hoặc nhờ giáo viên mở lớp (trạng thái đang hoạt động).'
            : msg,
        );
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsubscribeClass();
    };
  }, [classCode, location.search, navigate, toast]);

  useEffect(() => {
    if (!classDoc?.curriculumProgramId) {
      setProgram(null);
      return undefined;
    }
    return subscribeCurriculumProgram(
      classDoc.curriculumProgramId,
      (data) => setProgram(data),
      (err) => toast.error(getErrorMessage(err)),
      { full: false },
    );
  }, [classDoc?.curriculumProgramId, toast]);

  useEffect(() => {
    if (!FEATURE_KNOWLEDGE_FEEDBACK_ENABLED || !selectedStudentId || !classDoc?.classCode) {
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
  }, [selectedStudentId, classDoc?.classCode, toast]);

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
    const clearSpyParam = () => {
      setSpySessionId(null);
      const next = new URLSearchParams(searchParams);
      next.delete('spy');
      setSearchParams(next, { replace: true });
    };
    import('../../services/spy.service.js').then(({ fetchSpySession }) => {
      fetchSpySession(spyParam).then((session) => {
        if (cancelled) return;
        if (!session) {
          toast.error('Không tìm thấy phòng chơi.');
          clearSpyParam();
          return;
        }
        if (session.classCode !== classCode) {
          toast.error('Phòng chơi không thuộc lớp học này.');
          clearSpyParam();
          return;
        }
        if (
          selectedStudent?.id &&
          Array.isArray(session.presentStudentIds) &&
          !session.presentStudentIds.includes(selectedStudent.id)
        ) {
          toast.error('Bạn không có mặt buổi này — không thể tham gia.');
          clearSpyParam();
          return;
        }
        setSpySessionId(spyParam);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [spyParam, classCode, selectedStudent?.id, toast, searchParams, setSearchParams]);

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
    if (
      selectedStudent?.id &&
      Array.isArray(activeSpy?.presentStudentIds) &&
      !activeSpy.presentStudentIds.includes(selectedStudent.id)
    ) {
      toast.error('Bạn không có mặt buổi này — không thể tham gia.');
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
  const usesProjectWorkspace = studentUsesProjectWorkspace(classDoc, program);
  const onProjectHome = location.pathname.endsWith('/project');

  const bottomNavItems = useMemo(() => {
    const home = studentClassBasePath(classCode);
    const lessons = usesProjectWorkspace ? studentLessonsPath(classCode) : studentLearnPath(classCode);
    const project = usesProjectWorkspace
      ? studentProjectPath(classCode)
      : FEATURE_DRIVE_SUBMISSION_ENABLED
        ? studentSubmitPath(classCode)
        : studentProjectPath(classCode);
    return [
      { id: 'home', label: 'Trang chủ', to: home },
      { id: 'lessons', label: 'Bài học', to: lessons },
      { id: 'project', label: 'Dự án', to: project },
    ];
  }, [usesProjectWorkspace, classCode, classDoc, program]);

  const shellSubtitle = classDoc?.className || classDoc?.classCode || '';
  const sessionContext = studentSessionContextLabel(classDoc, activeLessonSession);

  const showShowdownBanner =
    FEATURE_CODING_SHOWDOWN_ENABLED &&
    !showdownSessionId &&
    activeShowdown &&
    selectedStudent &&
    ['lobby', 'playing', 'reveal'].includes(activeShowdown.status);

  const isPresentForSpy =
    Boolean(selectedStudent?.id) &&
    Array.isArray(activeSpy?.presentStudentIds) &&
    activeSpy.presentStudentIds.includes(selectedStudent.id);

  const showSpyBanner =
    FEATURE_SPY_GAME_ENABLED &&
    !spySessionId &&
    activeSpy &&
    selectedStudent &&
    isPresentForSpy &&
    ['lobby', 'describe', 'playing', 'vote', 'tie_debate', 'tie_revote', 'reveal'].includes(
      activeSpy.status,
    );
  const isCrewSpyBanner = activeSpy?.mode === 'crew';

  const chooseStudent = (student) => {
    setSelectedStudentId(student.id);
    setSelectedStudent(student);
    localStorage.setItem(storageKey(classCode), student.id);
    const stayOnSubmit =
      FEATURE_DRIVE_SUBMISSION_ENABLED && location.pathname.endsWith('/submit');
    navigate(
      {
        pathname: stayOnSubmit
          ? studentSubmitPath(classCode)
          : studentClassBasePath(classCode),
        search: location.search,
      },
      { replace: true },
    );
  };

  const clearStudent = () => {
    setPinReady(false);
    setStudentFirestoreActive(false);
    signOut(getStudentAuth()).catch(() => {});
    setSelectedStudentId(null);
    setSelectedStudent(null);
    setActiveLessonSession(null);
    localStorage.removeItem(storageKey(classCode));
    navigate(`/c/${encodeURIComponent(classCode)}`, { replace: true });
  };

  if (loading) return <FullPageLoader label="Đang tải lớp học..." />;

  if (error) {
    return (
      <StudentShell>
        <EmptyState
          icon={<Ban className="h-7 w-7" />}
          title="Không thể truy cập"
          description={error}
        />
      </StudentShell>
    );
  }

  if (selectedStudent && classDoc.pinRequired && !pinReady) {
    return (
      <StudentShell subtitle={classDoc.className || classDoc.classCode}>
        <StudentPinGate
          classCode={classDoc.classCode}
          student={selectedStudent}
          onBack={clearStudent}
          onSuccess={async (token) => {
            await signInWithCustomToken(getStudentAuth(), token);
            setStudentFirestoreActive(true);
            setPinReady(true);
          }}
        />
      </StudentShell>
    );
  }

  if (!selectedStudent) {
    return (
      <StudentShell subtitle={classDoc.className || classDoc.classCode}>
        <StudentPicker
          students={students}
          onPick={chooseStudent}
          classLabel={classDoc.className || classDoc.classCode}
        />
      </StudentShell>
    );
  }

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

  if (
    FEATURE_CODING_SHOWDOWN_ENABLED &&
    showdownSessionId &&
    selectedStudent &&
    ShowdownStudentViewLazy
  ) {
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

  let gameJoin = null;
  if (showSpyBanner) {
    gameJoin = {
      variant: 'spy',
      crew: isCrewSpyBanner,
      onJoin: () => enterSpy(activeSpy.id),
    };
  } else if (showShowdownBanner) {
    gameJoin = {
      variant: 'showdown',
      onJoin: () => enterShowdown(activeShowdown.id),
    };
  }

  return (
    <StudentShell
      subtitle={shellSubtitle}
      hideSubtitleOnMobile
      activeLessonSession={activeLessonSession}
      bottomNavItems={bottomNavItems}
      compactMain={onProjectHome}
      notice={
        gameJoin ? (
          <StudentGameJoinNotice
            variant={gameJoin.variant}
            crew={gameJoin.crew}
            onJoin={gameJoin.onJoin}
          />
        ) : null
      }
      right={
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="min-w-0 text-right">
            <Link
              to={studentClassBasePath(classCode)}
              className="block truncate text-sm font-semibold text-slate-800 hover:text-brand-700 dark:text-slate-100 dark:hover:text-brand-300"
              title={selectedStudent.fullName}
            >
              {selectedStudent.fullName}
            </Link>
            <p
              className="truncate text-[11px] text-slate-500 sm:hidden dark:text-slate-400"
              title={[shellSubtitle, sessionContext].filter(Boolean).join(' · ')}
            >
              {[shellSubtitle, sessionContext].filter(Boolean).join(' · ')}
            </p>
            {sessionContext ? (
              <p className="hidden truncate text-[11px] text-slate-500 sm:block dark:text-slate-400" title={sessionContext}>
                {sessionContext}
              </p>
            ) : null}
            {displayProject && isProjectNameApproved(selectedStudent) && (
              <p
                className="hidden max-w-[14rem] truncate text-xs text-slate-500 sm:block dark:text-slate-400"
                title={displayProject}
              >
                {displayProject}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearStudent}
            className="min-h-11 min-w-11 px-2 sm:min-w-0 sm:px-3"
            title="Đổi tên học sinh"
          >
            <UserRound className="h-5 w-5" />
            <span className="hidden sm:inline">Đổi tên</span>
          </Button>
        </div>
      }
    >
      <Outlet
        context={{
          classCode,
          classDoc,
          program,
          student: selectedStudent,
          submittedLessonIds,
          isFinalPhase,
          setActiveLessonSession,
          setSubmittedLessonIds,
        }}
      />
    </StudentShell>
  );
}

export function StudentPhaseHome() {
  const { classCode, classDoc, program, student } = useOutletContext();
  const total = Number(program?.totalSessionCount || 0);
  const current = Number(classDoc?.curriculumCurrentSession || 0);
  const projectWorkspace = studentUsesProjectWorkspace(classDoc, program);
  const continueTo = projectWorkspace ? studentLessonsPath(classCode) : studentLearnPath(classCode);
  const projectTo = projectWorkspace ? studentProjectPath(classCode) : studentSubmitPath(classCode);
  const sessionLabel = total > 0 ? `${current}/${total}` : String(current || '—');
  const progress = Math.min(100, Math.max(0, Number(student?.currentProgressPercent) || 0));
  const projectTitle = projectNameDisplay(student) || 'Chưa có dự án';
  const stageLabel = projectWorkspace ? student?.currentStage || 'Chưa có giai đoạn' : 'Học kiến thức';
  const sessions = classRoadmapSessions(classDoc, program);
  const historyOnly = classDoc?.status === 'completed';
  const tasks = [
    {
      id: 'lessons',
      title: 'Xem tài liệu buổi hiện tại',
      detail: 'Nội dung và bài tập thực hành',
      to: continueTo,
      icon: BookOpen,
    },
    historyOnly
      ? null
      : projectWorkspace
      ? {
          id: 'project',
          title: 'Cập nhật sản phẩm',
          detail: 'Báo cáo tiến độ hoặc nộp file',
          to: projectTo,
          icon: FolderKanban,
        }
      : FEATURE_DRIVE_SUBMISSION_ENABLED
        ? {
            id: 'submit',
            title: 'Nộp bài',
            detail: 'Gửi file của buổi đã mở',
            to: studentSubmitPath(classCode),
            icon: FolderKanban,
          }
        : null,
  ].filter(Boolean);
  const reportValue = student?.latestReportId ? 'Đã có' : '0';
  const orbitMarks = sessions.length ? sessions : [{ sessionNumber: 1, state: 'current' }];
  const sideMarks = [0, 1, 2, 3, 4, 5].map((index) => ({
    sessionNumber: index + 1,
    state: index % 2 ? 'opened' : 'locked',
  }));
  const sparks = [
    ['8%', '22%', '0s'],
    ['24%', '68%', '0.8s'],
    ['38%', '30%', '1.4s'],
    ['57%', '74%', '0.4s'],
    ['71%', '24%', '1.1s'],
    ['88%', '62%', '0.2s'],
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-ink dark:text-slate-50">
          Xin chào, {student?.fullName || 'bạn'}!
        </h1>
      </header>

      <section className="relative min-h-[16rem] overflow-hidden rounded-[22px] bg-gradient-to-br from-navy via-[#2d3371] to-brand-600 px-6 py-7 text-white sm:px-8">
        <div className="student-hero-field" aria-hidden="true">
          <span className="student-hero-wash" />
          {sparks.map(([x, y, delay]) => (
            <span key={`${x}-${y}`} className="student-hero-spark" style={{ '--x': x, '--y': y, '--d': delay }} />
          ))}
          {[
            ['left', '18%', sideMarks, false],
            ['center', '50%', orbitMarks, true],
            ['right', '82%', sideMarks, false],
          ].map(([place, at, marks, featured]) => (
            <div
              key={place}
              className={`student-hero-orbit student-hero-orbit-${place}`}
              style={{ '--at': at }}
            >
              <span className="student-hero-glow" />
              <span className="student-hero-ring student-hero-ring-a" />
              <span className="student-hero-ring student-hero-ring-b" />
              {featured ? <span className="student-hero-ring student-hero-ring-c" /> : null}
              {featured ? <span className="student-hero-core" /> : null}
              <span className="student-hero-nodes">
                {marks.map((session, index, list) => (
                  <span
                    key={session.sessionNumber}
                    className="student-hero-arm"
                    style={{ '--i': index, '--n': list.length }}
                  >
                    <span className={`student-hero-node student-hero-node-${session.state}`} />
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="relative z-10 flex min-h-[12.5rem] flex-col justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-100">
            Bài học của em · {classDoc?.className || classCode}
          </p>
          <Link
            to={continueTo}
            className="inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-brand-700"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Tiếp tục bài giảng
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <article className="card px-3 py-4 sm:px-5">
          <b className="block text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">{sessionLabel}</b>
          <p className="mt-1 text-[11px] font-medium text-muted">Buổi hiện tại</p>
        </article>
        <article className="card px-3 py-4 sm:px-5">
          <b className="block text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">{progress}%</b>
          <p className="mt-1 text-[11px] font-medium text-muted">Tiến độ dự án</p>
        </article>
        <article className="card px-3 py-4 sm:px-5">
          <b className="block text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">{reportValue}</b>
          <p className="mt-1 text-[11px] font-medium text-muted">Báo cáo đã gửi</p>
        </article>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(16rem,0.75fr)]">
        <section className="card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink dark:text-slate-50">Hành trình học tập</h2>
              <p className="mt-1 text-sm text-muted">Đọc theo thứ tự những buổi giáo viên đã mở</p>
            </div>
            {program?.name ? <Badge tone="brand">{program.name}</Badge> : null}
          </div>
          {sessions.length ? (
            <div className="mt-4 flex gap-1.5" aria-hidden="true">
              {sessions.map((session) => (
                <span
                  key={session.sessionNumber}
                  className={`h-1.5 min-w-0 flex-1 rounded-full ${
                    session.state === 'opened'
                      ? 'bg-brand-600'
                      : session.state === 'current'
                        ? 'bg-amber-400'
                        : 'bg-line dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Lớp chưa có lộ trình buổi học.</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {total > 0 ? `Buổi ${current || 0} của ${total}` : 'Chưa có buổi hiện tại'}
            </p>
            <Link
              to={continueTo}
              className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-brand-50 px-3 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
            >
              Vào bài học
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <h3 className="mt-5 text-base font-semibold text-ink dark:text-slate-50">Công việc nên làm tiếp</h3>
          <ul className="mt-2 divide-y divide-line dark:divide-slate-800">
            {tasks.map((task) => {
              const Icon = task.icon;
              return (
                <li key={task.id}>
                  <Link to={task.to} className="flex items-center gap-3 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-200">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink dark:text-slate-50">{task.title}</span>
                      <span className="block text-xs text-muted">{task.detail}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink dark:text-slate-50">Dự án của em</h2>
            <Badge tone="brand">{progress}%</Badge>
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
            {projectWorkspace ? 'Final Project' : 'Sản phẩm'}
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-ink dark:text-slate-50">{projectTitle}</h3>
          <p className="mt-1 text-sm text-muted">{stageLabel}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line dark:bg-slate-800" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress}%` }} />
          </div>
          {historyOnly ? (
            <p className="mt-4 text-sm text-muted">Lớp này đã hoàn thành. Em xem lại bài và báo cáo cũ tại đây.</p>
          ) : projectWorkspace || FEATURE_DRIVE_SUBMISSION_ENABLED ? (
            <Link
              to={projectTo}
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-50 px-4 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-200"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              {projectWorkspace ? 'Mở không gian dự án' : 'Nộp bài'}
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

export function StudentLearnRoute() {
  const {
    classCode,
    classDoc,
    program,
    student,
    submittedLessonIds,
    isFinalPhase,
    setActiveLessonSession,
    setSubmittedLessonIds,
  } = useOutletContext();
  const location = useLocation();
  if (studentUsesProjectWorkspace(classDoc, program)) {
    return <Navigate to={`${studentProjectPath(classCode)}${location.search}`} replace />;
  }
  return (
    <Suspense fallback={<FullPageLoader label="Đang tải bài học..." />}>
      <LessonsViewLazy
        classDoc={classDoc}
        program={program}
        student={student}
        submittedLessonIds={submittedLessonIds}
        isFinalPhase={isFinalPhase}
        hideLessonList
        showBack={false}
        autoOpenResume
        onActiveSessionChange={setActiveLessonSession}
        onFeedbackSubmitted={(lessonId) =>
          setSubmittedLessonIds((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
        }
      />
    </Suspense>
  );
}

export function StudentProjectRoute() {
  const { classCode, classDoc, program, student } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  if (!studentUsesProjectWorkspace(classDoc, program)) {
    return (
      <Navigate
        to={`${studentWorkspaceHomePath(classCode, classDoc, program)}${location.search}`}
        replace
      />
    );
  }
  const awaitingProjectReview = isProjectNameAwaitingReview(student);
  const showProjectSetup = needsProjectNameSetup(student, classDoc, program);
  const showProjectNameSection =
    awaitingProjectReview ||
    student.projectNameStatus === 'rejected' ||
    showProjectSetup;

  return (
    <div>
      {showProjectNameSection &&
        (showProjectSetup && !awaitingProjectReview ? (
          <ProjectNameSetup student={student} />
        ) : (
          <ProjectNamePendingBanner student={student} />
        ))}
      <Suspense
        fallback={
          <div className="flex min-h-[8rem] items-center justify-center text-sm text-slate-500">
            Đang tải báo cáo dự án...
          </div>
        }
      >
        <FinalProjectStudentViewLazy
          classDoc={classDoc}
          program={program}
          student={student}
          onOpenLessons={() => navigate(studentLessonsPath(classCode))}
        />
      </Suspense>
    </div>
  );
}

export function StudentSubmitRoute() {
  const { classCode, classDoc, program } = useOutletContext();
  const location = useLocation();
  if (!FEATURE_DRIVE_SUBMISSION_ENABLED) {
    return (
      <Navigate
        to={`${studentWorkspaceHomePath(classCode, classDoc, program)}${location.search}`}
        replace
      />
    );
  }
  return <DriveSubmitPage />;
}

export function StudentLessonsReviewRoute() {
  const {
    classCode,
    classDoc,
    program,
    student,
    submittedLessonIds,
    setActiveLessonSession,
    setSubmittedLessonIds,
  } = useOutletContext();
  const navigate = useNavigate();
  const location = useLocation();
  if (!studentUsesProjectWorkspace(classDoc, program)) {
    return (
      <Navigate
        to={`${studentWorkspaceHomePath(classCode, classDoc, program)}${location.search}`}
        replace
      />
    );
  }
  return (
    <Suspense fallback={<FullPageLoader label="Đang tải bài học..." />}>
      <LessonsViewLazy
        classDoc={classDoc}
        program={program}
        student={student}
        submittedLessonIds={submittedLessonIds}
        isFinalPhase
        hideLessonList
        showBack
        backLabel="Về dự án"
        autoOpenResume
        onExitReader={() => navigate(studentProjectPath(classCode))}
        onActiveSessionChange={setActiveLessonSession}
        onFeedbackSubmitted={(lessonId) =>
          setSubmittedLessonIds((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
        }
      />
    </Suspense>
  );
}

function studentInitial(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function StudentPicker({ students, onPick, classLabel }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.fullName.toLowerCase().includes(q));
  }, [students, search]);

  if (students.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-7 w-7" />}
        title="Chưa có học sinh"
        description={classLabel ? `Lớp ${classLabel} chưa có danh sách tên.` : undefined}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {classLabel ? (
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
          {classLabel}
        </p>
      ) : null}
      <h2 className="mt-1 text-xl font-semibold text-slate-800 dark:text-slate-100">Chọn tên của bạn</h2>
      <div className="mt-4">
        <Field label="Tìm tên">
          <Input
            placeholder="Gõ vài chữ trong tên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="text-base"
          />
        </Field>
      </div>
      <div className="mt-3 space-y-2">
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
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-slate-800 dark:text-slate-100">{s.fullName}</span>
              {s.enrollmentStatus === 'completed' ? (
                <span className="block text-xs text-slate-500">Xem lại lớp cũ</span>
              ) : null}
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
