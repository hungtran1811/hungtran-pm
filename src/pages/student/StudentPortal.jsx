import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, Ban, UserRound, Users } from 'lucide-react';
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
import { ProgressReportView } from './ProgressReportView.jsx';
import { StudentOverview } from './StudentOverview.jsx';
import { ProjectNamePendingBanner, ProjectNameSetup } from './ProjectNameSetup.jsx';
import {
  classUsesProjectNames,
  isProjectNameApproved,
  isProjectNameAwaitingReview,
  needsProjectNameSetup,
  projectNameDisplay,
  resolveFinalMode,
} from '../../lib/classFinalMode.js';

function storageKey(classCode) {
  return `student:${classCode}`;
}

export function StudentPortalPage() {
  const { classCode: rawCode } = useParams();
  const classCode = decodeURIComponent(rawCode || '');
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
      .catch(() => {});
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

  const isFinalPhase = classDoc.curriculumPhase === 'final';
  const finalMode = resolveFinalMode(classDoc, program);
  const usesProjectNames = classUsesProjectNames(classDoc, program);
  const awaitingProjectReview = isProjectNameAwaitingReview(selectedStudent);
  const showProjectSetup = needsProjectNameSetup(selectedStudent, classDoc, program);
  const showProjectNameSection = usesProjectNames && (
    awaitingProjectReview
    || selectedStudent.projectNameStatus === 'rejected'
    || (isFinalPhase && showProjectSetup)
  );
  const displayProject = projectNameDisplay(selectedStudent);

  return (
    <StudentShell
      subtitle={`${classDoc.className || classDoc.classCode}`}
      right={
        <Button variant="subtle" size="sm" onClick={clearStudent} className="shadow-sm">
          <UserRound className="h-4 w-4" />
          Đổi tên
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

      <StudentOverview
        classDoc={classDoc}
        student={selectedStudent}
        program={program}
        isFinalPhase={isFinalPhase}
        submittedLessonIds={submittedLessonIds}
      />

      {isFinalPhase && finalMode === 'project' ? (
        <ProgressReportView classDoc={classDoc} student={selectedStudent} />
      ) : (
        <LessonsView
          classDoc={classDoc}
          program={program}
          student={selectedStudent}
          submittedLessonIds={submittedLessonIds}
          onFeedbackSubmitted={(lessonId) =>
            setSubmittedLessonIds((prev) => (prev.includes(lessonId) ? prev : [...prev, lessonId]))
          }
        />
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
