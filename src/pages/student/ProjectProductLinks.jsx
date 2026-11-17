import { useState } from 'react';
import { Code2, ExternalLink, Globe, Link2, Palette, Plus, Presentation, Save } from 'lucide-react';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input } from '../../ui/components/Field.jsx';
import { useToast } from '../../ui/components/Toast.jsx';
import { validateProjectLinks } from '../../lib/projectLinks.js';
import { getErrorMessage } from '../../lib/firestore.js';
import { submitProjectLinks } from '../../services/students.service.js';
import { GUIDE_SECTIONS } from './ProjectSubmissionGuide.jsx';

export function ProjectProductLinks({
  student,
  links,
  onChange,
  onOpenGuide,
  disabled = false,
  compact = false,
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState({});

  const update = (key, value) => onChange?.(key, value);
  const showExtra = (key) => added[key] || Boolean(String(links[key] || '').trim());

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
    (links.githubUrl || '').trim() !== (student.projectGithubUrl || '').trim() ||
    (links.canvaUrl || '').trim() !== (student.projectCanvaUrl || '').trim() ||
    (links.slidesUrl || '').trim() !== (student.projectSlidesUrl || '').trim() ||
    (links.otherUrl || '').trim() !== (student.projectOtherUrl || '').trim();

  return (
    <div className={compact ? 'space-y-3' : 'card space-y-4 p-5'}>
      {!compact && (
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <Link2 className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Liên kết sản phẩm</h3>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <LinkField
          label="Canva"
          icon={Palette}
          value={links.canvaUrl}
          onChange={(value) => update('canvaUrl', value)}
          placeholder="https://www.canva.com/design/... hoặc canva.link/..."
          disabled={disabled || saving}
          hint={
            compact && onOpenGuide ? (
              <GuideHint onOpen={() => onOpenGuide(GUIDE_SECTIONS.canva)} label="Hướng dẫn Canva" />
            ) : undefined
          }
        />

        {showExtra('githubUrl') ? (
          <LinkField
            label="GitHub"
            icon={Code2}
            value={links.githubUrl}
            onChange={(value) => update('githubUrl', value)}
            placeholder="https://github.com/..."
            disabled={disabled || saving}
            hint={compact && onOpenGuide ? <GithubGuideHints onOpenGuide={onOpenGuide} /> : undefined}
          />
        ) : null}

        {showExtra('slidesUrl') ? (
          <LinkField
            label="Google Slides"
            icon={Presentation}
            value={links.slidesUrl || ''}
            onChange={(value) => update('slidesUrl', value)}
            placeholder="https://docs.google.com/presentation/d/..."
            disabled={disabled || saving}
            hint="Share → Anyone with the link → Copy link"
          />
        ) : null}

        {showExtra('otherUrl') ? (
          <LinkField
            label="Link khác"
            icon={Globe}
            value={links.otherUrl || ''}
            onChange={(value) => update('otherUrl', value)}
            placeholder="https://..."
            disabled={disabled || saving}
            hint="Sản phẩm đang chạy trên mạng, hoặc tài liệu liên quan"
          />
        ) : null}

        {showExtra('githubUrl') && showExtra('slidesUrl') && showExtra('otherUrl') ? null : (
          <div className="flex flex-wrap gap-2">
            {!showExtra('githubUrl') ? (
              <AddLinkButton
                label="GitHub"
                disabled={disabled || saving}
                onClick={() => setAdded((prev) => ({ ...prev, githubUrl: true }))}
              />
            ) : null}
            {!showExtra('slidesUrl') ? (
              <AddLinkButton
                label="Google Slides"
                disabled={disabled || saving}
                onClick={() => setAdded((prev) => ({ ...prev, slidesUrl: true }))}
              />
            ) : null}
            {!showExtra('otherUrl') ? (
              <AddLinkButton
                label="Link khác"
                disabled={disabled || saving}
                onClick={() => setAdded((prev) => ({ ...prev, otherUrl: true }))}
              />
            ) : null}
          </div>
        )}
      </div>

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

function LinkField({ label, icon: Icon, value, onChange, placeholder, disabled, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="url"
          inputMode="url"
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
          disabled={disabled}
        />
      </div>
    </Field>
  );
}

function AddLinkButton({ label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function GuideHint({ onOpen, label }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
    >
      {label}
    </button>
  );
}

function GithubGuideHints({ onOpenGuide }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <GuideHint onOpen={() => onOpenGuide(GUIDE_SECTIONS.github)} label="Hướng dẫn GitHub" />
      <span className="text-slate-300 dark:text-slate-600">|</span>
      <GuideHint onOpen={() => onOpenGuide(GUIDE_SECTIONS.git)} label="Git commit & push" />
    </span>
  );
}

export function ProjectLinksReadonly({ githubUrl, canvaUrl, slidesUrl, otherUrl, className = '' }) {
  if (!githubUrl && !canvaUrl && !slidesUrl && !otherUrl) return null;

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
      {slidesUrl && (
        <a
          href={slidesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
          onClick={(e) => e.stopPropagation()}
        >
          <Presentation className="h-3.5 w-3.5" />
          Slides
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      )}
      {otherUrl && (
        <a
          href={otherUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
          onClick={(e) => e.stopPropagation()}
        >
          <Globe className="h-3.5 w-3.5" />
          Link khác
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
      )}
    </div>
  );
}
