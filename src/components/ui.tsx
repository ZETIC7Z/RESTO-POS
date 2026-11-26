import React, { useEffect, useState } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(' ');

export function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('material-icons-round select-none leading-none', className)}>
      {name}
    </span>
  );
}

type Variant = 'primary' | 'ghost' | 'danger' | 'success' | 'soft';
type Size = 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-white bg-gradient-to-b from-[#ff9a4d] to-[#ff5a1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_30px_-12px_rgba(255,96,32,0.85)] hover:brightness-110',
  success:
    'text-[#04130b] bg-gradient-to-b from-[#5cf0a8] to-[#17c27a] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_30px_-12px_rgba(23,194,122,0.8)] hover:brightness-110',
  danger:
    'text-red-200 bg-red-500/15 border border-red-400/30 hover:bg-red-500/25',
  ghost:
    'text-white bg-white/[0.06] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] hover:bg-white/[0.11]',
  soft: 'text-orange-200 bg-orange-500/12 border border-orange-400/25 hover:bg-orange-500/20',
};
const SIZES: Record<Size, string> = {
  md: 'h-12 min-w-12 px-4 text-sm rounded-xl gap-2',
  lg: 'h-14 min-w-14 px-5 text-base rounded-2xl gap-2.5',
  xl: 'h-16 min-w-16 px-6 text-lg rounded-2xl gap-3',
};

export function Btn({
  variant = 'ghost',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: string;
}) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex select-none items-center justify-center font-bold transition active:translate-y-px active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {icon && <Icon name={icon} className={size === 'md' ? 'text-[20px]' : 'text-[24px]'} />}
      {children}
    </button>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cx(
          'glass animate-pop flex max-h-full w-full flex-col overflow-hidden rounded-[28px] bg-[#11141d]/90',
          wide ? 'max-w-4xl' : 'max-w-lg'
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-white/50">{subtitle}</p>}
          </div>
          <Btn aria-label="Close" icon="close" onClick={onClose} className="!px-0" />
        </div>
        <div className="overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'text-white',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  icon?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</span>
        {icon && <Icon name={icon} className="text-[18px] text-white/30" />}
      </div>
      <p className={cx('mt-2 text-xl font-extrabold tabular-nums', tone)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/40">{sub}</p>}
    </div>
  );
}

/** Re-renders every `ms` — for live clocks and "x min ago". */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(esc).join(',')).join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Fullscreen ───────────────────────────────────────────────

export function requestFullscreen() {
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  try {
    if (document.fullscreenElement) return;
    if (el.requestFullscreen) void el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    else el.webkitRequestFullscreen?.();
  } catch {
    /* not supported (e.g. iPhone Safari) — use Add to Home Screen */
  }
}

export function useFullscreen() {
  const [isFs, setIsFs] = useState(!!document.fullscreenElement);
  useEffect(() => {
    const on = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else requestFullscreen();
  };
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { isFs: isFs || standalone, toggle, supported: !!document.documentElement.requestFullscreen };
}

export function BrandLogo({
  size = 'md',
  alt = 'EL Farm Cafe',
  className,
}: {
  size?: 'md' | 'lg';
  alt?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'relative shrink-0 overflow-hidden rounded-2xl border border-amber-400/45 bg-black shadow-[inset_0_1px_0_rgba(255,215,128,0.35),0_12px_28px_-8px_rgba(245,158,11,0.55)]',
        size === 'lg' ? 'h-14 w-14' : 'h-11 w-11 sm:h-12 sm:w-12',
        className
      )}
    >
      <img
        src="/el-farm-logo.jpg"
        alt={alt}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export function DeveloperFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cx(
        'flex flex-col items-center justify-center gap-1.5 py-2 text-center text-xs text-white/50',
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <img src="/zeticuz-logo.svg" alt="ZETICUZ" className="h-4 w-4 opacity-85" />
        <span className="font-semibold tracking-wide text-white/70">
          SITE DEVELOPED BY: Sam Pangilinan · © {new Date().getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => window.open('https://www.zeticuz.xyz/', '_blank', 'noopener,noreferrer')}
          className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-orange-300 transition hover:border-orange-400/40 hover:bg-orange-500/15"
        >
          Explore Developer Portfolio &amp; Projects ↗
        </button>
      </div>
    </footer>
  );
}
