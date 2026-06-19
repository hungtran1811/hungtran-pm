/** Logo vector chính — file gốc của bạn trong public/ */
export const BRAND_LOGO_SRC = '/logo-wordmark.svg';

const SIZES = {
  /** Sidebar admin, drawer mobile — ~34px cao */
  sm: {
    img: 'h-[34px] w-auto',
    wordmark: 'text-[15px]',
    sub: 'text-[11px] leading-snug',
    row: 'gap-2',
    block: 'gap-1',
  },
  /** Header cổng học sinh — ~38px cao */
  md: {
    img: 'h-[38px] w-auto',
    wordmark: 'text-base',
    sub: 'text-xs leading-snug',
    row: 'gap-2.5',
    block: 'gap-1',
  },
  /** Trang chủ / đăng nhập — nổi bật nhưng không tràn mobile */
  lg: {
    img: 'h-[72px] w-auto sm:h-[80px]',
    wordmark: 'text-2xl sm:text-[1.65rem]',
    sub: 'text-sm leading-snug',
    row: 'gap-3',
    block: 'gap-1.5',
  },
};

function LogoImage({ sizeKey, className = '' }) {
  const s = SIZES[sizeKey] || SIZES.md;
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt=""
      width={317}
      height={336}
      decoding="async"
      draggable={false}
      className={`block shrink-0 object-contain object-left ${s.img} ${className}`}
    />
  );
}

function BrandWordmark({ sizeKey }) {
  const s = SIZES[sizeKey] || SIZES.md;
  return (
    <span
      className={`shrink-0 font-semibold leading-none tracking-tight ${s.wordmark}`}
      aria-label="hungtranPM"
    >
      <span className="text-slate-800 dark:text-slate-100">hung</span>
      <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
        tranpm
      </span>
    </span>
  );
}

export function BrandLogo({
  size = 'md',
  subtitle,
  showWordmark = false,
  className = '',
}) {
  const s = SIZES[size] || SIZES.md;

  if (showWordmark) {
    return (
      <div className={`flex min-w-0 flex-col ${s.block} ${className}`}>
        <div className={`flex min-w-0 items-center ${s.row}`}>
          <LogoImage sizeKey={size} />
          <BrandWordmark sizeKey={size} />
        </div>
        {subtitle && (
          <p className={`truncate font-medium text-slate-500 dark:text-slate-400 ${s.sub}`}>{subtitle}</p>
        )}
      </div>
    );
  }

  if (!subtitle) {
    return (
      <div className={`inline-flex shrink-0 items-center ${className}`}>
        <LogoImage sizeKey={size} />
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 max-w-[11rem] flex-col ${s.block} ${className}`}>
      <LogoImage sizeKey={size} />
      <p className={`truncate font-medium text-slate-500 dark:text-slate-400 ${s.sub}`}>{subtitle}</p>
    </div>
  );
}
