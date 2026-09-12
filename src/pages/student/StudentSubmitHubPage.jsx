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
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size="lg" />
          <h1 className="mt-6 text-2xl font-bold text-slate-800 dark:text-slate-50">Nộp bài</h1>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <Field label="Mã lớp">
            <Input
              value={classCode}
              onChange={(event) => setClassCode(event.target.value)}
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
