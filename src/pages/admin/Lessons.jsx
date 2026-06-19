import { useEffect, useState } from 'react';
import { BookOpen, ClipboardList, FileText, HelpCircle, Plus, Settings2, Trash2 } from 'lucide-react';
import { AppShell } from '../../ui/components/AppShell.jsx';
import { Button } from '../../ui/components/Button.jsx';
import { Badge } from '../../ui/components/Badge.jsx';
import { Modal } from '../../ui/components/Modal.jsx';
import { ConfirmDialog } from '../../ui/components/ConfirmDialog.jsx';
import { EmptyState } from '../../ui/components/EmptyState.jsx';
import { SkeletonRows } from '../../ui/components/Skeleton.jsx';
import { GroupedProgramSelect } from '../../ui/components/GroupedProgramSelect.jsx';
import { Field, Input, Textarea } from '../../ui/components/Field.jsx';
import { Select } from '../../ui/components/Field.jsx';
import { Markdown } from '../../ui/components/Markdown.jsx';
import { ImageUpload } from '../../ui/components/ImageUpload.jsx';
import { ImageGalleryUpload } from '../../ui/components/ImageGalleryUpload.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import {
  createProgram,
  getCurriculumProgram,
  listCurriculumPrograms,
  saveProgramLessons,
  updateProgramMeta,
} from '../../services/curriculum.service.js';
import { CURRICULUM_FINAL_MODES } from '../../constants/index.js';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  emptyQuiz,
  loadQuizForEditor,
  makeQuizQuestion,
  syncAllQuizBanks,
} from '../../services/quiz.service.js';
import {
  emptyPracticeQuiz,
  loadPracticeQuizForEditor,
  makePracticeQuestion,
  syncAllPracticeQuizBanks,
} from '../../services/practiceQuiz.service.js';
import { Spinner } from '../../ui/components/Spinner.jsx';

function makeLessonId() {
  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function LessonsPage() {
  const toast = useToast();
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [program, setProgram] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [editorInitialMode, setEditorInitialMode] = useState('lesson');
  const [showEditor, setShowEditor] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [programForm, setProgramForm] = useState(null);
  const [savingProgram, setSavingProgram] = useState(false);

  const reloadPrograms = async (selectId) => {
    const list = await listCurriculumPrograms();
    setPrograms(list);
    if (selectId) setSelectedProgramId(selectId);
    else if (list.length && !list.some((p) => p.id === selectedProgramId)) {
      setSelectedProgramId(list[0].id);
    }
    return list;
  };

  useEffect(() => {
    (async () => {
      try {
        const list = await listCurriculumPrograms();
        setPrograms(list);
        if (list.length) setSelectedProgramId(list[0].id);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoadingPrograms(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProgramId) return;
    (async () => {
      setLoading(true);
      try {
        const prog = await getCurriculumProgram(selectedProgramId);
        setProgram(prog);
        setLessons(prog?.lessons ?? []);
        setDirty(false);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  const openEditor = (lesson, mode = 'lesson') => {
    setEditingLesson({ ...lesson });
    setEditorInitialMode(mode);
    setShowEditor(true);
  };

  const openNew = () => {
    openEditor(
      {
        id: makeLessonId(),
        sessionNumber: (lessons.at(-1)?.sessionNumber ?? 0) + 1,
        title: '',
        content: '',
        exercise: '',
        exerciseVisible: false,
        summary: '',
        teacherNote: '',
        archived: false,
        bannerImage: null,
        coverImage: null,
        images: [],
        _raw: {},
        _isNew: true,
      },
      'lesson',
    );
  };

  const applyLesson = (lesson) => {
    setLessons((prev) => {
      const next = prev.some((l) => l.id === lesson.id)
        ? prev.map((l) => (l.id === lesson.id ? lesson : l))
        : [...prev, lesson];
      return next.sort((a, b) => a.sessionNumber - b.sessionNumber);
    });
    setDirty(true);
    setShowEditor(false);
  };

  const removeLesson = () => {
    setLessons((prev) => prev.filter((l) => l.id !== deleteTarget.id));
    setDirty(true);
    setDeleteTarget(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProgramLessons(selectedProgramId, lessons);
      await syncAllQuizBanks(selectedProgramId, lessons);
      await syncAllPracticeQuizBanks(selectedProgramId, lessons);
      toast.success('Đã lưu bài giảng.');
      setDirty(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openCreateProgram = () => {
    setProgramForm({
      id: '',
      name: '',
      subject: '',
      level: '',
      description: '',
      totalSessionCount: 14,
      knowledgePhaseEndSession: 1,
      finalMode: 'project',
      active: true,
      _isNew: true,
    });
  };

  const openEditProgram = () => {
    if (!program) return;
    setProgramForm({
      id: program.id,
      name: program.name,
      subject: program.subject,
      level: program.level,
      description: program.description,
      totalSessionCount: program.totalSessionCount,
      knowledgePhaseEndSession: program.knowledgePhaseEndSession,
      finalMode: program.finalMode,
      active: program.active,
      _isNew: false,
    });
  };

  const handleSaveProgram = async (form) => {
    if (form._isNew && !form.id.trim()) {
      toast.error('Vui lòng nhập mã chương trình (ID).');
      return;
    }
    if (!form.name.trim()) {
      toast.error('Vui lòng nhập tên chương trình.');
      return;
    }
    setSavingProgram(true);
    try {
      if (form._isNew) {
        if (programs.some((p) => p.id === form.id.trim())) {
          toast.error('Mã chương trình đã tồn tại.');
          setSavingProgram(false);
          return;
        }
        const id = await createProgram(form.id, form);
        toast.success('Đã tạo chương trình.');
        await reloadPrograms(id);
      } else {
        await updateProgramMeta(form.id, form);
        toast.success('Đã cập nhật chương trình.');
        const list = await reloadPrograms();
        const refreshed = await getCurriculumProgram(form.id);
        setProgram(refreshed);
        void list;
      }
      setProgramForm(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingProgram(false);
    }
  };

  return (
    <AppShell
      title="Bài giảng"
      actions={
        <div className="flex items-center gap-2">
          {dirty && (
            <Button size="sm" onClick={handleSave} loading={saving}>
              Lưu thay đổi
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={openCreateProgram}>
            <Plus className="h-4 w-4" />
            Chương trình mới
          </Button>
        </div>
      }
    >
      {loadingPrograms ? (
        <SkeletonRows count={3} />
      ) : programs.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-7 w-7" />}
          title="Chưa có chương trình học"
          action={
            <Button onClick={openCreateProgram}>
              <Plus className="h-4 w-4" />
              Chương trình mới
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 sm:w-96">
              <GroupedProgramSelect
                programs={programs}
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
              />
              <Button size="sm" variant="ghost" onClick={openEditProgram} title="Sửa thông tin chương trình">
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Thêm bài giảng
            </Button>
          </div>

          {program && (
            <p className="mb-4 text-sm text-slate-500">
              {program.subject} · {program.level} · {lessons.length} bài giảng
            </p>
          )}

          {loading ? (
            <SkeletonRows count={4} />
          ) : lessons.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-7 w-7" />}
              title="Chưa có bài giảng"
              action={
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" />
                  Thêm bài giảng
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {lessons.map((lesson) => (
                <div key={lesson.id} className="card flex items-center gap-4 p-4">
                  {lesson.bannerImageUrl || lesson.coverImageUrl ? (
                    <img
                      src={lesson.bannerImageUrl || lesson.coverImageUrl}
                      alt={lesson.title}
                      className="h-14 w-20 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800">
                      <BookOpen className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge tone="brand">Buổi {lesson.sessionNumber}</Badge>
                    </div>
                    <h3 className="mt-1 truncate font-medium text-slate-800 dark:text-slate-100">
                      {lesson.title || 'Chưa có tiêu đề'}
                    </h3>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditor(lesson, 'lesson')}
                    >
                      Bài giảng
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditor(lesson, 'practice')}
                    >
                      <HelpCircle className="h-4 w-4" />
                      Ôn tập
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditor(lesson, 'quiz')}
                    >
                      <ClipboardList className="h-4 w-4" />
                      Quiz
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => setDeleteTarget(lesson)}
                    >
                      Xoá
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {dirty && (
            <div className="sticky bottom-4 mt-6 flex justify-end">
              <div className="card flex items-center gap-3 px-4 py-3 shadow-lg">
                <span className="text-sm text-slate-500">Có thay đổi chưa lưu</span>
                <Button size="sm" onClick={handleSave} loading={saving}>
                  Lưu thay đổi
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {showEditor && (
        <LessonEditor
          lesson={editingLesson}
          programId={selectedProgramId}
          initialMode={editorInitialMode}
          onClose={() => setShowEditor(false)}
          onApply={applyLesson}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xoá bài giảng"
        message={`Xoá bài giảng "${deleteTarget?.title || 'Buổi ' + deleteTarget?.sessionNumber}"? Nhớ bấm Lưu thay đổi sau đó.`}
        confirmLabel="Xoá"
        onConfirm={removeLesson}
        onCancel={() => setDeleteTarget(null)}
      />

      {programForm && (
        <ProgramFormModal
          initial={programForm}
          saving={savingProgram}
          onClose={() => setProgramForm(null)}
          onSave={handleSaveProgram}
        />
      )}
    </AppShell>
  );
}

function ProgramFormModal({ initial, saving, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      title={initial._isNew ? 'Tạo chương trình học' : 'Sửa thông tin chương trình'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={() => onSave(form)} loading={saving}>
            {initial._isNew ? 'Tạo chương trình' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {initial._isNew && (
          <Field label="Mã chương trình (ID)" required>
            <Input
              value={form.id}
              onChange={(e) => update('id', e.target.value)}
              placeholder="vd: scratch-co-ban"
            />
          </Field>
        )}
        <Field label="Tên chương trình" required>
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Môn học">
            <Input value={form.subject} onChange={(e) => update('subject', e.target.value)} />
          </Field>
          <Field label="Trình độ">
            <Input value={form.level} onChange={(e) => update('level', e.target.value)} />
          </Field>
        </div>
        <Field label="Mô tả">
          <Textarea
            rows={3}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Tổng số buổi">
            <Input
              type="number"
              min="1"
              max="100"
              value={form.totalSessionCount}
              onChange={(e) => update('totalSessionCount', e.target.value)}
            />
          </Field>
          <Field label="Buổi kết thúc kiến thức">
            <Input
              type="number"
              min="0"
              max="100"
              value={form.knowledgePhaseEndSession}
              onChange={(e) => update('knowledgePhaseEndSession', e.target.value)}
            />
          </Field>
          <Field label="Hình thức cuối khóa">
            <Select value={form.finalMode} onChange={(e) => update('finalMode', e.target.value)}>
              {CURRICULUM_FINAL_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-700">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => update('active', e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-700 dark:text-slate-200">
            Kích hoạt (học sinh mới xem được bài giảng)
          </span>
        </label>
      </div>
    </Modal>
  );
}

function LessonPreviewPane({ form }) {
  const gallery = Array.isArray(form.images) ? form.images.filter((img) => img?.secureUrl) : [];
  return (
    <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200 p-5 dark:border-slate-700">
      {(form.bannerImage?.secureUrl || form.coverImage?.secureUrl) && (
        <img
          src={form.bannerImage?.secureUrl || form.coverImage?.secureUrl}
          alt=""
          className="mb-4 aspect-[2/1] w-full rounded-xl object-cover"
        />
      )}
      {gallery.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {gallery.map((img, i) => (
            <img
              key={img.secureUrl || i}
              src={img.secureUrl}
              alt={img.alt || ''}
              className="aspect-video w-full rounded-xl object-contain bg-slate-100 dark:bg-slate-800"
            />
          ))}
        </div>
      )}
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{form.title || 'Chưa có tiêu đề'}</h2>
      <Markdown content={form.content} className="mt-3" />
      {form.exercise && form.exerciseVisible && (
        <div className="mt-5 rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
          <p className="mb-2 font-semibold text-amber-700 dark:text-amber-300">Bài tập</p>
          <Markdown content={form.exercise} />
        </div>
      )}
    </div>
  );
}

function PracticeQuizEditorPanel({ quiz, onChange }) {
  const updateQuiz = (patch) => onChange({ ...quiz, ...patch });

  const updateQuestion = (index, patch) => {
    const questions = [...quiz.questions];
    questions[index] = { ...questions[index], ...patch };
    updateQuiz({ questions });
  };

  const updateOption = (qIndex, oIndex, value) => {
    const questions = [...quiz.questions];
    const options = [...questions[qIndex].options];
    options[oIndex] = value;
    questions[qIndex] = { ...questions[qIndex], options };
    updateQuiz({ questions });
  };

  return (
    <div className="space-y-3 rounded-xl border border-emerald-200 p-4 dark:border-emerald-500/30">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={quiz.enabled}
          onChange={(e) => updateQuiz({ enabled: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Bật câu hỏi ôn tập dưới bài giảng
        </span>
      </label>
      {quiz.enabled && (
        <>
          <Field label="Tiêu đề ôn tập">
            <Input value={quiz.title} onChange={(e) => updateQuiz({ title: e.target.value })} />
          </Field>
          <p className="text-xs text-slate-500">
            Học sinh làm lại được nhiều lần và thấy điểm ngay. Chỉ dùng câu trắc nghiệm.
          </p>
          <div className="space-y-4">
            {quiz.questions.map((q, qi) => (
              <div key={q.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500">Câu {qi + 1}</span>
                  <button
                    type="button"
                    onClick={() => updateQuiz({ questions: quiz.questions.filter((_, i) => i !== qi) })}
                    className="text-slate-400 hover:text-red-500"
                    aria-label="Xoá câu"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                  placeholder="Câu hỏi..."
                />
                <div className="mt-2 space-y-1.5">
                  {(q.options ?? []).map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={`practice-correct-${q.id}`}
                        checked={q.correctIndex === oi}
                        onChange={() => updateQuestion(qi, { correctIndex: oi })}
                      />
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        placeholder={`Đáp án ${oi + 1}`}
                        className="flex-1"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => updateQuiz({ questions: [...quiz.questions, makePracticeQuestion()] })}
          >
            <Plus className="h-4 w-4" />
            Thêm câu trắc nghiệm
          </Button>
        </>
      )}
    </div>
  );
}

function QuizEditorPanel({ quiz, onChange }) {
  const updateQuiz = (patch) => onChange({ ...quiz, ...patch });

  const updateQuestion = (index, patch) => {
    const questions = [...quiz.questions];
    questions[index] = { ...questions[index], ...patch };
    updateQuiz({ questions });
  };

  const updateOption = (qIndex, oIndex, value) => {
    const questions = [...quiz.questions];
    const options = [...questions[qIndex].options];
    options[oIndex] = value;
    questions[qIndex] = { ...questions[qIndex], options };
    updateQuiz({ questions });
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={quiz.enabled}
          onChange={(e) => updateQuiz({ enabled: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Bật quiz buổi này</span>
      </label>
      {quiz.enabled && (
        <>
          <Field label="Tiêu đề quiz">
            <Input value={quiz.title} onChange={(e) => updateQuiz({ title: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Thời gian (phút, 0 = không giới hạn)">
              <Input
                type="number"
                min={0}
                value={quiz.timeLimitMinutes ?? 30}
                onChange={(e) => updateQuiz({ timeLimitMinutes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Số lần làm tối đa">
              <Input
                type="number"
                min={1}
                max={20}
                disabled={quiz.allowRetake === false}
                value={quiz.allowRetake === false ? 1 : (quiz.maxAttempts ?? 3)}
                onChange={(e) =>
                  updateQuiz({ maxAttempts: Math.min(20, Math.max(1, Number(e.target.value) || 1)) })
                }
              />
            </Field>
          </div>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={quiz.allowRetake !== false}
              onChange={(e) =>
                updateQuiz({
                  allowRetake: e.target.checked,
                  maxAttempts: e.target.checked ? (quiz.maxAttempts ?? 3) : 1,
                })
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span className="text-sm text-slate-700 dark:text-slate-200">
              Cho phép làm lại (tắt = chỉ 1 lần)
            </span>
          </label>
          <div className="space-y-4">
            {quiz.questions.map((q, qi) => {
              const isCode = q.type === 'code';
              return (
                <div key={q.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">Câu {qi + 1}</span>
                      <select
                        value={q.type || 'mcq'}
                        onChange={(e) => {
                          const type = e.target.value;
                          if (type === 'code') {
                            updateQuestion(qi, {
                              type: 'code',
                              starterCode: q.starterCode ?? '',
                              referenceCode: q.referenceCode ?? '',
                              options: undefined,
                              correctIndex: undefined,
                            });
                          } else {
                            updateQuestion(qi, {
                              type: 'mcq',
                              options: q.options?.length ? q.options : ['', '', '', ''],
                              correctIndex: q.correctIndex ?? 0,
                            });
                          }
                        }}
                        className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs dark:border-slate-600 dark:bg-slate-800"
                      >
                        <option value="mcq">Trắc nghiệm</option>
                        <option value="code">Viết code</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuiz({ questions: quiz.questions.filter((_, i) => i !== qi) })
                      }
                      className="text-slate-400 hover:text-red-500"
                      aria-label="Xoá câu"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Input
                    value={q.prompt}
                    onChange={(e) => updateQuestion(qi, { prompt: e.target.value })}
                    placeholder="Câu hỏi..."
                  />
                  {isCode ? (
                    <div className="mt-2 space-y-2">
                      <Field label="Code mẫu (hiện cho HS khi bắt đầu)">
                        <textarea
                          value={q.starterCode ?? ''}
                          onChange={(e) => updateQuestion(qi, { starterCode: e.target.value })}
                          rows={4}
                          className="w-full rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 font-mono text-xs text-green-400 dark:border-slate-600"
                        />
                      </Field>
                      <Field label="Đáp án đúng (admin, tự chấm code)">
                        <p className="mb-1.5 text-xs text-slate-400">
                          Nhiều đáp án khác nhau: phân tách bằng dòng{' '}
                          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">---</code>
                        </p>
                        <textarea
                          value={q.referenceCode ?? ''}
                          onChange={(e) => updateQuestion(qi, { referenceCode: e.target.value })}
                          rows={6}
                          spellCheck={false}
                          className="w-full rounded-lg border border-slate-200 bg-slate-950 px-3 py-2 font-mono text-xs text-green-400 dark:border-slate-600"
                          placeholder={'print("Hello")\n---\nprint(\'Hello\')'}
                        />
                      </Field>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {(q.options ?? []).map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name={`correct-${q.id}`}
                            checked={q.correctIndex === oi}
                            onChange={() => updateQuestion(qi, { correctIndex: oi })}
                          />
                          <Input
                            value={opt}
                            onChange={(e) => updateOption(qi, oi, e.target.value)}
                            placeholder={`Đáp án ${oi + 1}`}
                            className="flex-1"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateQuiz({ questions: [...quiz.questions, makeQuizQuestion('mcq')] })}
            >
              <Plus className="h-4 w-4" />
              Câu trắc nghiệm
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => updateQuiz({ questions: [...quiz.questions, makeQuizQuestion('code')] })}
            >
              <Plus className="h-4 w-4" />
              Câu viết code
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function LessonEditor({ lesson, programId, initialMode = 'lesson', onClose, onApply }) {
  const [form, setForm] = useState({
    ...lesson,
    quiz: lesson.quiz ?? emptyQuiz(),
    practiceQuiz: lesson.practiceQuiz ?? emptyPracticeQuiz(),
  });
  const [editorMode, setEditorMode] = useState(initialMode);
  const [previewTab, setPreviewTab] = useState('edit');
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    setEditorMode(initialMode);
  }, [initialMode, lesson.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingQuiz(true);
      try {
        const [quiz, practiceQuiz] = await Promise.all([
          loadQuizForEditor(programId, lesson.id, lesson.sessionNumber),
          loadPracticeQuizForEditor(programId, lesson.id, lesson.sessionNumber),
        ]);
        if (!cancelled) setForm((prev) => ({ ...prev, quiz, practiceQuiz }));
      } catch {
        if (!cancelled) {
          setForm((prev) => ({ ...prev, quiz: emptyQuiz(), practiceQuiz: emptyPracticeQuiz() }));
        }
      } finally {
        if (!cancelled) setLoadingQuiz(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lesson.id, programId, lesson.sessionNumber]);

  const editFields = (
    <div className="space-y-4">
      <Field label="Nội dung bài giảng (Markdown)">
        <Textarea
          rows={18}
          value={form.content}
          onChange={(e) => update('content', e.target.value)}
          placeholder="# Tiêu đề&#10;Nội dung bài học bằng Markdown..."
          className="font-mono text-sm"
        />
      </Field>
      <Field label="Bài tập (Markdown)">
        <Textarea
          rows={10}
          value={form.exercise}
          onChange={(e) => update('exercise', e.target.value)}
          className="font-mono text-sm"
        />
      </Field>
    </div>
  );

  const modalTitle =
    editorMode === 'quiz'
      ? lesson._isNew
        ? 'Soạn quiz kiểm tra'
        : `Quiz · Buổi ${form.sessionNumber}`
      : editorMode === 'practice'
        ? lesson._isNew
          ? 'Soạn ôn tập'
          : `Ôn tập · Buổi ${form.sessionNumber}`
        : lesson._isNew
          ? 'Thêm bài giảng'
          : 'Soạn bài giảng';

  return (
    <Modal
      open
      onClose={onClose}
      title={modalTitle}
      size="full"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            onClick={() =>
              onApply({
                ...form,
                sessionNumber: Number(form.sessionNumber) || 1,
                quiz: form.quiz,
                practiceQuiz: form.practiceQuiz,
              })
            }
            disabled={loadingQuiz}
          >
            Áp dụng
          </Button>
        </>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Field label="Buổi số" required>
          <Input
            type="number"
            min="1"
            max="50"
            value={form.sessionNumber}
            onChange={(e) => update('sessionNumber', e.target.value)}
          />
        </Field>
        <Field label="Tiêu đề buổi học" required>
          <Input value={form.title} onChange={(e) => update('title', e.target.value)} />
        </Field>
      </div>

      <div className="mb-5 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => setEditorMode('lesson')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            editorMode === 'lesson'
              ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Bài giảng
        </button>
        <button
          type="button"
          onClick={() => setEditorMode('practice')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            editorMode === 'practice'
              ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          Ôn tập
        </button>
        <button
          type="button"
          onClick={() => setEditorMode('quiz')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            editorMode === 'quiz'
              ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Quiz kiểm tra
        </button>
      </div>

      {editorMode === 'lesson' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <ImageUpload label="Ảnh banner" value={form.bannerImage} onChange={(v) => update('bannerImage', v)} />
            <ImageUpload label="Ảnh bìa" value={form.coverImage} onChange={(v) => update('coverImage', v)} />
            <ImageGalleryUpload
              label="Ảnh minh họa"
              value={form.images}
              onChange={(v) => update('images', v)}
            />
            <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-slate-700">
              <input
                type="checkbox"
                checked={form.exerciseVisible}
                onChange={(e) => update('exerciseVisible', e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">Hiển thị bài tập cho học sinh</span>
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-1 rounded-lg bg-slate-100 p-1 xl:hidden dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setPreviewTab('edit')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  previewTab === 'edit' ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500'
                }`}
              >
                Soạn nội dung
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('preview')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  previewTab === 'preview' ? 'bg-white shadow-sm dark:bg-slate-900' : 'text-slate-500'
                }`}
              >
                Xem trước
              </button>
            </div>

            <div className="hidden xl:grid xl:grid-cols-2 xl:gap-4">
              {editFields}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">Xem trước</p>
                <LessonPreviewPane form={form} />
              </div>
            </div>

            <div className="xl:hidden">
              {previewTab === 'edit' ? editFields : <LessonPreviewPane form={form} />}
            </div>
          </div>
        </div>
      ) : loadingQuiz ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : editorMode === 'practice' ? (
        <PracticeQuizEditorPanel
          quiz={form.practiceQuiz}
          onChange={(practiceQuiz) => update('practiceQuiz', practiceQuiz)}
        />
      ) : (
        <QuizEditorPanel quiz={form.quiz} onChange={(quiz) => update('quiz', quiz)} />
      )}
    </Modal>
  );
}
