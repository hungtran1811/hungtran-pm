import { useState } from 'react';
import { Code2, ExternalLink, Link2, Palette, Save } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { validateProjectLinks } from '../../lib/projectLinks.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { submitProjectLinks } from '../../services/students.service.js';

export function ProjectProductLinks({
  student,
  links,
  onChange,
  disabled = false,
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const update = (key, value) => onChange?.(key, value);

  const handleSave = async () => {
    const validated = validateProjectLinks(links);
    if (validated.error) {
      toast.error(validated.error);
      return;
    }
    setSaving(true);
    try {
      await submitProjectLinks(student.id, validated);
      toast.success('Đã lưu liên kết sản phẩm.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const dirty =
    links.githubUrl.trim() !== (student.projectGithubUrl || '').trim() ||
    links.canvaUrl.trim() !== (student.projectCanvaUrl || '').trim();

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <Link2 className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Liên kết sản phẩm</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Lưu link GitHub (mã nguồn) và Canva (slide/thiết kế) để giáo viên xem nhanh.
          </p>
        </div>
      </div>

      <Field label="GitHub" hint="Ví dụ: github.com/username/ten-du-an">
        <div className="relative">
          <Code2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="url"
            inputMode="url"
            value={links.githubUrl}
            onChange={(e) => update('githubUrl', e.target.value)}
            placeholder="https://github.com/..."
            className="pl-9"
            disabled={disabled || saving}
          />
        </div>
      </Field>

      <Field label="Canva" hint="Ví dụ: canva.com/design/...">
        <div className="relative">
          <Palette className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="url"
            inputMode="url"
            value={links.canvaUrl}
            onChange={(e) => update('canvaUrl', e.target.value)}
            placeholder="https://www.canva.com/design/..."
            className="pl-9"
            disabled={disabled || saving}
          />
        </div>
      </Field>

      <Button
        type="button"
        variant="secondary"
        className="w-full sm:w-auto"
        loading={saving}
        disabled={disabled || !dirty}
        onClick={handleSave}
      >
        <Save className="h-4 w-4" />
        Lưu liên kết
      </Button>
    </div>
  );
}

export function ProjectLinksReadonly({ githubUrl, canvaUrl, className = '' }) {
  if (!githubUrl && !canvaUrl) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {githubUrl && (
        <a
          href={githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
          onClick={(e) => e.stopPropagation()}
        >
          <Code2 className="h-3.5 w-3.5" />
          GitHub
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      )}
      {canvaUrl && (
        <a
          href={canvaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
          onClick={(e) => e.stopPropagation()}
        >
          <Palette className="h-3.5 w-3.5" />
          Canva
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      )}
    </div>
  );
}
