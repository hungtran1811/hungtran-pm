import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import { BrandLogo } from '../ui/components/BrandLogo.jsx';
import { ThemeToggle } from '../ui/components/ThemeToggle.jsx';
import {
  OAUTH_APP_NAME,
  PRIVACY_SECTIONS_EN,
  PRIVACY_SECTIONS_VI,
  PRIVACY_UPDATED_LABEL,
  SUPPORT_EMAIL,
} from '../data/publicLegal.js';

function SectionList({ heading, sections }) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{heading}</h2>
      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{section.title}</h3>
          {section.paragraphs.map((text) => (
            <p key={text} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {text}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

export function PrivacyPage() {
  useEffect(() => {
    document.title = `Privacy Policy — ${OAUTH_APP_NAME}`;
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-brand-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <Link to="/" className="inline-flex" aria-label={OAUTH_APP_NAME}>
          <BrandLogo size="md" />
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-slate-800 dark:text-slate-50">
          Privacy Policy — {OAUTH_APP_NAME}
        </h1>
        <p className="mt-1 text-sm text-slate-400">Updated {PRIVACY_UPDATED_LABEL}</p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Contact:{' '}
          <a className="font-medium text-brand-600 hover:underline dark:text-brand-300" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </p>

        <div className="card mt-6 space-y-10 p-6">
          <SectionList heading="English" sections={PRIVACY_SECTIONS_EN} />
          <hr className="border-slate-200 dark:border-slate-700" />
          <SectionList heading="Tiếng Việt — Chính sách quyền riêng tư" sections={PRIVACY_SECTIONS_VI} />
        </div>

        <p className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm font-medium text-slate-400 transition hover:text-brand-600 dark:hover:text-brand-300"
          >
            Back to {OAUTH_APP_NAME}
          </Link>
        </p>
      </div>
    </div>
  );
}
