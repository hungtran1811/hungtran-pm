/** Biểu tượng thương hiệu hungtranPM — dùng logo + vòng gradient đặc trưng. */
const LOGO_ICON = '/logo-icon.svg';

const GRADIENT_STOPS = [
  { offset: '0%', color: '#13D4E6' },
  { offset: '40%', color: '#1596FF' },
  { offset: '70%', color: '#5142FF' },
  { offset: '100%', color: '#8B2AF6' },
];

export function BrandMarkIllustration({ variant = 'idle', className = '' }) {
  const loading = variant === 'loading';
  const gradId = `pm-mark-grad-${variant}`;

  return (
    <div
      className={`brand-mark ${loading ? 'brand-mark--loading' : 'brand-mark--idle'} ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 200 200" className="brand-mark-orbit" fill="none">
        <defs>
          <linearGradient id={gradId} x1="24" y1="24" x2="176" y2="176" gradientUnits="userSpaceOnUse">
            {GRADIENT_STOPS.map((s) => (
              <stop key={s.offset} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <radialGradient id={`${gradId}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1596FF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8B2AF6" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="100" r="92" fill={`url(#${gradId}-glow)`} className="brand-mark-glow" />
        <circle
          cx="100"
          cy="100"
          r="86"
          stroke={`url(#${gradId})`}
          strokeWidth="1.5"
          className="brand-mark-ring brand-mark-ring-outer"
        />
        <circle
          cx="100"
          cy="100"
          r="72"
          stroke={`url(#${gradId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          className="brand-mark-ring brand-mark-ring-inner"
        />
        {loading && (
          <circle
            cx="100"
            cy="100"
            r="78"
            stroke={`url(#${gradId})`}
            strokeWidth="3"
            strokeLinecap="round"
            className="brand-mark-ring brand-mark-ring-progress"
          />
        )}
      </svg>

      <div className="brand-mark-core">
        <img src={LOGO_ICON} alt="" width={317} height={336} decoding="async" draggable={false} className="brand-mark-logo" />
      </div>

      <div className="brand-mark-paws">
        {[0, 1, 2].map((i) => (
          <span key={i} className="brand-mark-paw" style={{ animationDelay: `${i * 0.14}s` }} />
        ))}
      </div>
    </div>
  );
}

/** @deprecated alias — giữ import cũ */
export const WaitingCatIllustration = BrandMarkIllustration;

export function SelectClassPrompt({
  title = 'Chọn lớp để bắt đầu',
  description = 'Dùng bộ lọc phía trên để chọn lớp — biểu tượng PM sẽ hiển thị dữ liệu ngay sau đó.',
}) {
  return (
    <div className="brand-empty-panel">
      <BrandMarkIllustration variant="idle" className="brand-mark--prompt" />
      <p className="brand-empty-title">{title}</p>
      {description && <p className="brand-empty-desc">{description}</p>}
    </div>
  );
}

export function LoadingCatState({ message = 'Đang tải dữ liệu...' }) {
  return (
    <div className="brand-empty-panel brand-empty-panel--loading">
      <BrandMarkIllustration variant="loading" className="brand-mark--prompt" />
      <p className="brand-empty-message">{message}</p>
    </div>
  );
}
