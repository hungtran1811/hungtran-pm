import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  FileText,
  Monitor,
  Plus,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  Upload,
} from 'lucide-react';
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
import { LessonContent } from '../../ui/components/LessonContent.jsx';
import { ImageUpload } from '../../ui/components/ImageUpload.jsx';
import { ImageGalleryUpload } from '../../ui/components/ImageGalleryUpload.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import {
  createProgram,
  getCurriculumProgram,
  getProgramLesson,
  isSlimLesson,
  listCurriculumPrograms,
  saveProgramLessons,
  updateProgramMeta,
} from '../../services/curriculum.service.js';
import { CURRICULUM_FINAL_MODES } from '../../constants/index.js';
import { getErrorMessage } from '../../lib/firestore.js';
import {
  LEVEL_FORM_OPTIONS,
  SUBJECT_FORM_OPTIONS,
  canonicalProgramLevelValue,
  canonicalProgramSubjectValue,
  resolveProgramLevelMeta,
  resolveProgramSubjectMeta,
} from '../../lib/subjectGroups.js';
import { renderSafeMarkdown } from '../../lib/markdown.js';
import {
  LESSON_PRESENTATION_PRESET_LEGACY,
  hasRenderableLessonHtml,
  sanitizeLessonHtml,
} from '../../lib/lessonHtml.js';
const LESSON_HTML_IMPORT_MAX_BYTES = 750 * 1024;

function markdownToLessonHtml(content = '') {
  return content ? sanitizeLessonHtml(renderSafeMarkdown(content)) : '';
}

function hasRelativeImageUrl(source = '') {
  return [...String(source).matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi)].some(
    ([, , url]) => !/^(?:https?:)?\/\//i.test(url.trim()) && !/^data:image\//i.test(url.trim()),
  );
}

function prepareLessonForHtmlEditor(lesson) {
  const contentSourceFormat = lesson.contentRenderFormat ?? lesson.contentFormat;
  const exerciseSourceFormat = lesson.exerciseRenderFormat ?? lesson.contentFormat;
  const content =
    contentSourceFormat === 'html' ? lesson.content : markdownToLessonHtml(lesson.content);
  const exercise =
    exerciseSourceFormat === 'html' ? lesson.exercise : markdownToLessonHtml(lesson.exercise);

  return {
    ...lesson,
    contentFormat: 'html',
    contentRenderFormat: 'html',
    exerciseRenderFormat: 'html',
    presentationPreset: LESSON_PRESENTATION_PRESET_LEGACY,
    content,
    exercise,
  };
}

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
  const [showEditor, setShowEditor] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [programForm, setProgramForm] = useState(null);
  const [savingProgram, setSavingProgram] = useState(false);
  const [openingLessonId, setOpeningLessonId] = useState(null);
  const openEditorGeneration = useRef(0);

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
    if (!selectedProgramId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const prog = await getCurriculumProgram(selectedProgramId, { full: false });
        if (cancelled) return;
        setProgram(prog);
        setLessons(prog?.lessons ?? []);
        setDirty(false);
      } catch (error) {
        if (!cancelled) toast.error(getErrorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  const openEditor = async (lesson) => {
    const generation = ++openEditorGeneration.current;
    if (lesson._isNew) {
      setEditingLesson(prepareLessonForHtmlEditor({ ...lesson }));
      setShowEditor(true);
      return;
    }
    setOpeningLessonId(lesson.id);
    try {
      const full = isSlimLesson(lesson)
        ? await getProgramLesson(selectedProgramId, lesson.id)
        : lesson;
      if (generation !== openEditorGeneration.current) return;
      if (!full) {
        toast.error('Không tải được bài giảng này.');
        return;
      }
      setEditingLesson(prepareLessonForHtmlEditor({ ...full, _slim: false }));
      setShowEditor(true);
    } catch (error) {
      if (generation === openEditorGeneration.current) toast.error(getErrorMessage(error));
    } finally {
      if (generation === openEditorGeneration.current) setOpeningLessonId(null);
    }
  };

  const openNew = () => {
    openEditor(
      {
        id: makeLessonId(),
        sessionNumber: (lessons.at(-1)?.sessionNumber ?? 0) + 1,
        title: '',
        contentFormat: 'html',
        presentationPreset: LESSON_PRESENTATION_PRESET_LEGACY,
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
    );
  };

  const applyLesson = (lesson) => {
    const nextLesson = { ...lesson, _slim: false };
    delete nextLesson._isNew;
    setLessons((prev) => {
      const next = prev.some((l) => l.id === nextLesson.id)
        ? prev.map((l) => (l.id === nextLesson.id ? nextLesson : l))
        : [...prev, nextLesson];
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
      subject: canonicalProgramSubjectValue(program),
      level: canonicalProgramLevelValue(program),
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
        const refreshed = await getCurriculumProgram(form.id, { full: false });
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
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-1 items-end gap-2 sm:max-w-xl">
              <GroupedProgramSelect
                programs={programs}
                value={selectedProgramId}
                onChange={setSelectedProgramId}
                className="min-w-0 flex-1"
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={openEditProgram}
                title="Sửa thông tin chương trình"
              >
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
              {resolveProgramSubjectMeta(program.id, program).label}
              {' · '}
              {resolveProgramLevelMeta(program).label}
              {' · '}
              {lessons.length} bài giảng
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
                      onClick={() => openEditor(lesson)}
                      loading={openingLessonId === lesson.id}
                      disabled={Boolean(openingLessonId)}
                    >
                      Bài giảng
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
            <Select value={form.subject} onChange={(e) => update('subject', e.target.value)}>
              <option value="">— Chọn môn —</option>
              {SUBJECT_FORM_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              {form.subject && !SUBJECT_FORM_OPTIONS.some((option) => option.id === form.subject) && (
                <option value={form.subject}>{form.subject}</option>
              )}
            </Select>
          </Field>
          <Field label="Trình độ">
            <Select value={form.level} onChange={(e) => update('level', e.target.value)}>
              <option value="">— Chọn trình độ —</option>
              {LEVEL_FORM_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
              {form.level && !LEVEL_FORM_OPTIONS.some((option) => option.id === form.level) && (
                <option value={form.level}>{form.level}</option>
              )}
            </Select>
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
  const heroUrl = form.bannerImage?.secureUrl || form.coverImage?.secureUrl;
  return (
    <div className="max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-700 sm:px-5">
        <Badge tone="brand">Buổi {form.sessionNumber || 1}</Badge>
        <h1 className="mt-2 text-xl font-bold text-slate-800 dark:text-slate-50 sm:text-2xl">
          {form.title || 'Chưa có tiêu đề'}
        </h1>
      </div>
      <div className="p-4 sm:p-5">
        {heroUrl && (
          <img
            src={heroUrl}
            alt=""
            className="mb-4 aspect-[2/1] h-auto w-full rounded-xl bg-slate-100 object-contain dark:bg-slate-800"
          />
        )}
        {gallery.length > 0 && (
          <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {gallery.map((img, i) => (
              <img
                key={img.secureUrl || i}
                src={img.secureUrl}
                alt={img.alt || ''}
                className="aspect-video w-full rounded-xl bg-slate-100 object-contain dark:bg-slate-800"
              />
            ))}
          </div>
        )}
        <LessonContent
          format={form.contentRenderFormat ?? form.contentFormat}
          content={form.content}
        />
        {form.exercise && form.exerciseVisible && (
          <div className="mt-5 rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
            <p className="mb-2 font-semibold text-amber-700 dark:text-amber-300">Bài tập</p>
            <LessonContent
              format={form.exerciseRenderFormat ?? form.contentFormat}
              content={form.exercise}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const PREVIEW_VIEWPORTS = Object.freeze([
  { value: '375', label: '375', Icon: Smartphone, widthClass: 'w-[375px]' },
  { value: '768', label: '768', Icon: Tablet, widthClass: 'w-[768px]' },
  { value: '1200', label: '1200', Icon: Monitor, widthClass: 'w-[1200px]' },
  { value: 'full', label: 'Toàn vùng', Icon: Monitor, widthClass: 'w-full' },
]);

function LessonPreviewWorkspace({ form }) {
  const [viewport, setViewport] = useState('full');
  const selectedViewport =
    PREVIEW_VIEWPORTS.find((option) => option.value === viewport) ?? PREVIEW_VIEWPORTS.at(-1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Xem trước học sinh</p>
        <div
          className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800"
          role="group"
          aria-label="Kích thước vùng xem trước"
        >
          {PREVIEW_VIEWPORTS.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setViewport(value)}
              aria-pressed={viewport === value}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                viewport === value
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl bg-slate-100 p-2 sm:p-3 dark:bg-slate-800/60">
        <div
          className={`${selectedViewport.widthClass} mx-auto min-w-0 transition-[width] duration-200`}
          data-preview-width={selectedViewport.value}
        >
          <LessonPreviewPane form={form} />
        </div>
      </div>
    </div>
  );
}


function HtmlSourceField({ label, value, onChange, onImport, rows, placeholder }) {
  const toast = useToast();
  const textareaId = useId();
  const fileInputRef = useRef(null);
  const containsRelativeImageUrl = useMemo(() => hasRelativeImageUrl(value), [value]);

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.html') && !lowerName.endsWith('.htm')) {
      toast.error('Vui lòng chọn file .html hoặc .htm.');
      return;
    }
    if (file.size > LESSON_HTML_IMPORT_MAX_BYTES) {
      toast.error('File HTML vượt quá giới hạn 750 KiB.');
      return;
    }
    try {
      const source = await file.text();
      if (!hasRenderableLessonHtml(source)) {
        toast.error(
          'File không có nội dung tĩnh có thể hiển thị. Hãy thêm nội dung trong <body>; script và iframe không được chạy.',
        );
        return;
      }
      onChange(source);
      onImport?.(source);
      toast.success(
        `Đã đọc ${file.name}. Đang mở xem trước. Bấm Áp dụng, sau đó Lưu thay đổi để ghi lên hệ thống.`,
      );
      if (hasRelativeImageUrl(source)) {
        toast.info(
          'File có đường dẫn ảnh tương đối. Hãy dùng URL ảnh đầy đủ hoặc data:image; hệ thống không tự tải thư mục ảnh đi kèm.',
          6500,
        );
      }
    } catch {
      toast.error('Không thể đọc file HTML này.');
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={textareaId} className="label-base mb-0">
          {label}
        </label>
        <Button size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" />
          Nhập file HTML
        </Button>
      </div>
      <Textarea
        id={textareaId}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="font-mono text-sm"
        spellCheck={false}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".html,.htm,text/html"
        className="hidden"
        onChange={handleImport}
      />
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
        Nhập một file <code>.html</code> hoàn chỉnh rồi mở tab Xem trước. SVG/màu, CSS
        HTTPS và nút xem đáp án được giữ; <code>&lt;script&gt;</code>/iframe vẫn bị loại. Ảnh
        đi kèm thư mục không tự tải — dùng URL https, SVG nhúng, hoặc <code>data:image</code>.
      </p>
      {containsRelativeImageUrl && (
        <p
          role="note"
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          Có đường dẫn ảnh tương đối (kể cả file .svg). Hãy dùng URL https đầy đủ, nhúng
          <code>&lt;svg&gt;</code> trực tiếp, hoặc <code>data:image</code> (PNG/JPEG/SVG);
          hệ thống chỉ nhập một file HTML và không tải thư mục ảnh đi kèm.
        </p>
      )}
    </div>
  );
}

function LessonEditor({ lesson, onClose, onApply }) {
  const toast = useToast();
  const [form, setForm] = useState({
    ...lesson,
    presentationPreset: LESSON_PRESENTATION_PRESET_LEGACY,
  });
  const [previewTab, setPreviewTab] = useState('edit');
  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleApply = () => {
    if (String(form.content || '').trim() && !hasRenderableLessonHtml(form.content)) {
      toast.error(
        'Bài giảng không còn nội dung tĩnh sau khi loại script/iframe. Chưa áp dụng thay đổi.',
      );
      return;
    }
    if (String(form.exercise || '').trim() && !hasRenderableLessonHtml(form.exercise)) {
      toast.error(
        'Bài tập không còn nội dung tĩnh sau khi loại script/iframe. Chưa áp dụng thay đổi.',
      );
      return;
    }
    onApply({
      ...form,
      contentFormat: 'html',
      contentRenderFormat: 'html',
      exerciseRenderFormat: 'html',
      presentationPreset: LESSON_PRESENTATION_PRESET_LEGACY,
      content: form.content,
      exercise: form.exercise,
      sessionNumber: Number(form.sessionNumber) || 1,
    });
  };

  const handleHtmlImport = () => {
    update('presentationPreset', LESSON_PRESENTATION_PRESET_LEGACY);
    setPreviewTab('preview');
  };

  const editFields = (
    <div className="space-y-4">
      <HtmlSourceField
        label="Nội dung bài giảng (HTML)"
        rows={18}
        value={form.content}
        onChange={(value) => update('content', value)}
        onImport={() => handleHtmlImport()}
        placeholder="Nhập file .html hoặc dán HTML vào đây."
      />
      <HtmlSourceField
        label="Bài tập (HTML)"
        rows={10}
        value={form.exercise}
        onChange={(value) => update('exercise', value)}
        onImport={() => handleHtmlImport()}
        placeholder="Nhập file .html bài tập hoặc dán HTML vào đây."
      />
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={lesson._isNew ? 'Thêm bài giảng' : 'Soạn bài giảng'}
      size="full"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={handleApply}>Áp dụng</Button>
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

      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ImageUpload
            label="Ảnh banner"
            value={form.bannerImage}
            onChange={(v) => update('bannerImage', v)}
          />
          <ImageUpload
            label="Ảnh bìa"
            value={form.coverImage}
            onChange={(v) => update('coverImage', v)}
          />
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
            <span className="text-sm text-slate-700 dark:text-slate-200">
              Hiển thị bài tập cho học sinh
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
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

          {previewTab === 'edit' ? editFields : <LessonPreviewWorkspace form={form} />}
        </div>
      </div>
    </Modal>
  );
}
