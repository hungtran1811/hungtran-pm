import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/components/Button.jsx';
import { Field, Input, Select, Textarea } from '../../../ui/components/Field.jsx';
import { Modal } from '../../../ui/components/Modal.jsx';
import { useToast } from '../../../ui/components/Toast.jsx';
import { ConfirmDialog } from '../../../ui/components/ConfirmDialog.jsx';
import { getErrorMessage } from '../../../lib/firestore.js';
import {
  ROUND_ORDER,
  SHOWDOWN_DIFFICULTIES,
  SHOWDOWN_QUESTION_TYPES,
  SHOWDOWN_TOPICS,
  roundLabel,
} from '../../../lib/showdownConstants.js';
import {
  createShowdownQuestion,
  deleteShowdownQuestion,
  listShowdownQuestions,
  reseedShowdownBankToFirestore,
  seedShowdownBankToFirestore,
  updateShowdownQuestion,
} from '../../../services/showdownBank.service.js';

function emptyQuestion() {
  return {
    subject: 'Python',
    level: 'Basic',
    topic: 'variables',
    round: 'obstacle',
    difficulty: 'medium',
    questionType: 'multiple_choice',
    prompt: '',
    codeSnippet: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    correctAnswer: '',
    starterCode: '',
    referenceSolution: '',
    explanation: '',
  };
}

export function ShowdownBankManager({ onClose }) {
  const toast = useToast();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [roundFilter, setRoundFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    listShowdownQuestions()
      .then(setQuestions)
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () => (roundFilter === 'all' ? questions : questions.filter((q) => q.round === roundFilter)),
    [questions, roundFilter],
  );

  const countsByRound = useMemo(() => {
    const counts = { startup: 0, obstacle: 0, finish: 0 };
    questions.forEach((q) => {
      if (counts[q.round] != null) counts[q.round] += 1;
    });
    return counts;
  }, [questions]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seedShowdownBankToFirestore();
      if (result.alreadySeeded) {
        toast.error('Kho đề đã có dữ liệu — bỏ qua seed.');
      } else {
        toast.success(`Đã nạp ${result.questionsAdded} câu vào kho đề.`);
        load();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSeeding(false);
    }
  };

  const handleReseed = async () => {
    if (!window.confirm('Xoá toàn bộ kho đề hiện tại và nạp lại bộ đề chính thức (151 vấn đáp + 39 chướng ngại + 120 về đích)?')) {
      return;
    }
    setSeeding(true);
    try {
      const result = await reseedShowdownBankToFirestore();
      toast.success(`Đã nạp lại ${result.questionsAdded} câu (xoá ${result.removed} câu cũ).`);
      load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteShowdownQuestion(deleteTarget.id);
      toast.success('Đã xoá câu hỏi.');
      setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Modal open onClose={onClose} title="Kho đề Coding Showdown" size="2xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Database className="h-4 w-4" />
          {questions.length} câu
        </span>
        <span className="text-xs text-slate-400">
          {ROUND_ORDER.map((r) => `${roundLabel(r)}: ${countsByRound[r]}`).join(' · ')}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)} className="w-auto">
            <option value="all">Tất cả vòng</option>
            {ROUND_ORDER.map((r) => (
              <option key={r} value={r}>
                {roundLabel(r)}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" disabled={seeding} onClick={handleSeed}>
            <Download className="h-4 w-4" />
            {seeding ? 'Đang nạp...' : 'Nạp đề mẫu'}
          </Button>
          <Button variant="secondary" size="sm" disabled={seeding} onClick={handleReseed}>
            <Download className="h-4 w-4" />
            {seeding ? 'Đang nạp...' : 'Nạp lại (ghi đè)'}
          </Button>
          <Button size="sm" onClick={() => setEditing(emptyQuestion())}>
            <Plus className="h-4 w-4" />
            Thêm câu
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Đang tải kho đề...</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Chưa có câu hỏi. Bấm “Nạp đề mẫu” để nhập bộ Python Basic có sẵn.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => (
            <div
              key={q.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 font-semibold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                    {roundLabel(q.round)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800">
                    {SHOWDOWN_QUESTION_TYPES.find((t) => t.id === q.questionType)?.label || q.questionType}
                  </span>
                  <span className="text-slate-400">
                    {SHOWDOWN_TOPICS.find((t) => t.id === q.topic)?.label || q.topic} ·{' '}
                    {SHOWDOWN_DIFFICULTIES.find((d) => d.id === q.difficulty)?.label || q.difficulty}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-slate-700 dark:text-slate-200">{q.prompt}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                  onClick={() => setEditing(q)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  onClick={() => setDeleteTarget(q)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <QuestionEditor
          question={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Xoá câu hỏi?"
        message="Câu hỏi sẽ bị xoá khỏi kho đề. Hành động này không thể hoàn tác."
        confirmLabel="Xoá"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Modal>
  );
}

function QuestionEditor({ question, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(question);
  const [saving, setSaving] = useState(false);
  const isOral = form.round === 'startup' || form.questionType === 'oral';
  const isCode = !isOral && form.questionType === 'code';

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    if (!form.prompt.trim()) {
      toast.error('Nhập nội dung câu hỏi.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        subject: form.subject,
        level: form.level,
        topic: form.topic,
        round: form.round,
        difficulty: form.difficulty,
        questionType: isOral ? 'oral' : form.questionType,
        prompt: form.prompt.trim(),
        codeSnippet: form.codeSnippet?.trim() || null,
        options: isOral || isCode ? [] : form.options.map((o) => o.trim()),
        correctIndex: isOral || isCode ? null : Number(form.correctIndex),
        correctAnswer: isOral
          ? form.correctAnswer?.trim() || ''
          : isCode
            ? ''
            : form.options[Number(form.correctIndex)]?.trim() || '',
        starterCode: isCode ? form.starterCode || '' : '',
        referenceSolution: isCode ? form.referenceSolution?.trim() || '' : '',
        explanation: form.explanation?.trim() || '',
      };
      if (question.id) {
        await updateShowdownQuestion(question.id, payload);
        toast.success('Đã cập nhật câu hỏi.');
      } else {
        await createShowdownQuestion(payload);
        toast.success('Đã thêm câu hỏi.');
      }
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={question.id ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Vòng">
            <Select value={form.round} onChange={(e) => set({ round: e.target.value })}>
              {ROUND_ORDER.map((r) => (
                <option key={r} value={r}>
                  {roundLabel(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chủ đề">
            <Select value={form.topic} onChange={(e) => set({ topic: e.target.value })}>
              {SHOWDOWN_TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Độ khó">
            <Select value={form.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
              {SHOWDOWN_DIFFICULTIES.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {form.round !== 'startup' && (
          <Field label="Loại câu hỏi">
            <Select value={form.questionType} onChange={(e) => set({ questionType: e.target.value })}>
              {SHOWDOWN_QUESTION_TYPES.filter((t) => t.id !== 'oral').map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Nội dung câu hỏi">
          <Textarea value={form.prompt} onChange={(e) => set({ prompt: e.target.value })} />
        </Field>

        <Field label="Code (tuỳ chọn)">
          <Textarea
            value={form.codeSnippet || ''}
            onChange={(e) => set({ codeSnippet: e.target.value })}
            className="font-mono text-sm"
          />
        </Field>

        {isOral ? (
          <Field label="Đáp án (gợi ý cho giáo viên)">
            <Input value={form.correctAnswer || ''} onChange={(e) => set({ correctAnswer: e.target.value })} />
          </Field>
        ) : isCode ? (
          <>
            <Field label="Code khởi tạo cho học sinh (tuỳ chọn)">
              <Textarea
                value={form.starterCode || ''}
                onChange={(e) => set({ starterCode: e.target.value })}
                className="font-mono text-sm"
                placeholder="# Gợi ý / khung code sẵn cho học sinh..."
              />
            </Field>
            <Field label="Lời giải tham khảo (chỉ giáo viên — hiện khi công bố)">
              <Textarea
                value={form.referenceSolution || ''}
                onChange={(e) => set({ referenceSolution: e.target.value })}
                className="font-mono text-sm"
                placeholder="# Lời giải mẫu để giáo viên đối chiếu..."
              />
            </Field>
            <p className="text-xs text-slate-400">
              Câu hỏi viết code do giáo viên chấm thủ công (Đúng/Sai) trong lúc chơi.
            </p>
          </>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {form.options.map((opt, oi) => (
                <Field key={oi} label={`Đáp án ${String.fromCharCode(65 + oi)}`}>
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const options = [...form.options];
                      options[oi] = e.target.value;
                      set({ options });
                    }}
                  />
                </Field>
              ))}
            </div>
            <Field label="Đáp án đúng">
              <Select value={form.correctIndex} onChange={(e) => set({ correctIndex: Number(e.target.value) })}>
                {form.options.map((_, oi) => (
                  <option key={oi} value={oi}>
                    {String.fromCharCode(65 + oi)}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
