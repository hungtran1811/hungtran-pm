import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../ui/components/Button.jsx';
import { Field, Input } from '../../ui/components/Field.jsx';
import { ThemeToggle } from '../../ui/components/ThemeToggle.jsx';
import { BrandLogo } from '../../ui/components/BrandLogo.jsx';
import { studentSubmitPath } from '../../lib/studentWorkspace.js';

export function StudentSubmitHubPage() {
  const navigate = useNavigate();
  const [classCode, setClassCode] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const code = classCode.trim();
    if (code) navigate(studentSubmitPath(code));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-brand-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-500/15"
        aria-hidden="true"
      />
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Nộp bài
          </p>
          <h1 className="mt-1.5 text-2xl font-bold text-slate-800 dark:text-slate-50">Gửi file buổi này</h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6 shadow-md ring-1 ring-brand-100/80 dark:ring-brand-500/20">
          <Field label="Mã lớp">
            <Input
              value={classCode}
              onChange={(event) => setClassCode(event.target.value)}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData('text').trim();
                if (pasted) {
                  event.preventDefault();
                  setClassCode(pasted);
                }
              }}
              placeholder="Nhập hoặc dán mã lớp..."
              autoFocus
              className="text-lg"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full min-h-12 text-base shadow-md" disabled={!classCode.trim()}>
            Tiếp tục
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm font-medium text-slate-400 transition hover:text-brand-600 dark:hover:text-brand-300"
          >
            Về cổng học sinh
          </Link>
        </div>
      </div>
    </div>
  );
}
