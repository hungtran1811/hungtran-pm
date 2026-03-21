export function renderBrandLogo({
  id = '',
  className = '',
  subtitle = '',
  tone = 'light',
  compact = false,
} = {}) {
  const idAttr = id ? `id="${id}"` : '';
  const classAttr = className ? ` ${className}` : '';
  const toneClass = tone === 'dark' ? ' brand-lockup--dark' : ' brand-lockup--light';
  const compactClass = compact ? ' brand-lockup--compact' : '';
  const subtitleMarkup = subtitle ? `<div class="brand-lockup__subtitle">${subtitle}</div>` : '';

  return `
    <div ${idAttr} class="brand-lockup${toneClass}${compactClass}${classAttr}" aria-label="hungtranPM">
      <svg class="brand-lockup__mark" viewBox="0 0 72 72" role="img" aria-hidden="true">
        <rect x="10" y="10" width="52" height="52" rx="16" fill="var(--brand-mark-surface)" stroke="var(--brand-mark-border)" stroke-width="2"></rect>
        <rect x="23" y="35" width="7" height="15" rx="3.5" fill="var(--brand-mark-primary)"></rect>
        <rect x="33" y="28" width="7" height="22" rx="3.5" fill="var(--brand-mark-primary)"></rect>
        <rect x="43" y="20" width="7" height="30" rx="3.5" fill="var(--brand-mark-accent)"></rect>
        <path d="M20 52h32" stroke="var(--brand-mark-border)" stroke-width="2.2" stroke-linecap="round"></path>
      </svg>
      <div class="brand-lockup__text">
        <div class="brand-lockup__title">hungtranPM</div>
        ${subtitleMarkup}
      </div>
    </div>
  `;
}
