import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Btn, cx, Icon, Modal } from './ui';

type DeviceTarget = '/login' | '/cashier' | '/crew' | '/display';

const DEVICE_TARGETS: { path: DeviceTarget; label: string; desc: string; icon: string }[] = [
  { path: '/login', label: 'Staff Sign-In', desc: 'Cashier or Admin login portal', icon: 'login' },
  { path: '/cashier', label: 'Cashier Tablet', desc: 'POS terminal register', icon: 'point_of_sale' },
  { path: '/crew', label: 'Kitchen Tablet', desc: 'KDS order prep screen', icon: 'soup_kitchen' },
  { path: '/display', label: 'Smart TV Queue', desc: 'Customer Preparing / Serving TV', icon: 'tv' },
];

export function QrModal({
  storeName = 'EL Farm Cafe',
  defaultPath = '/login',
  onClose,
}: {
  storeName?: string;
  defaultPath?: DeviceTarget;
  onClose: () => void;
}) {
  const [targetPath, setTargetPath] = useState<DeviceTarget>(defaultPath);
  const [copied, setCopied] = useState(false);

  const url = `${window.location.origin}${targetPath}`;
  const isLocalhost = /localhost|127\.0\.0\.1/.test(window.location.hostname);

  return (
    <Modal
      title={`${storeName} — Multi-Device QR Connect`}
      subtitle="Scan with any tablet, phone, or Smart TV browser to launch directly into that screen"
      onClose={onClose}
      wide
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DEVICE_TARGETS.map((item) => {
          const active = targetPath === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                setTargetPath(item.path);
                setCopied(false);
              }}
              className={cx(
                'flex flex-col items-start rounded-2xl border p-3 text-left transition active:scale-[0.98]',
                active
                  ? 'border-orange-400 bg-orange-500/20 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]'
              )}
            >
              <div className="flex items-center gap-1.5 text-xs font-extrabold">
                <Icon name={item.icon} className="text-[18px] text-orange-300" />
                <span>{item.label}</span>
              </div>
              <span className="mt-1 text-[10px] text-white/50">{item.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="grid items-center gap-6 md:grid-cols-[auto,1fr]">
        <div className="mx-auto rounded-[28px] bg-white p-5 shadow-[0_30px_60px_-20px_rgba(255,120,40,0.45)]">
          <QRCode value={url} size={240} level="M" bgColor="#ffffff" fgColor="#0b0d14" />
        </div>
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              Cloud Device URL ({targetPath})
            </span>
            <p className="select-all break-all font-mono text-base font-bold text-emerald-300 sm:text-lg">
              {url}
            </p>
          </div>
          <ol className="space-y-2.5 text-sm text-white/75">
            {[
              ['cloud_done', 'Powered by Supabase Cloud & Vercel — tablets and Smart TVs sync live from anywhere.'],
              ['qr_code_scanner', 'Point your tablet/phone Camera app at the QR code and tap the link.'],
              ['fullscreen', 'Tap Full Screen or Add to Home Screen so the browser URL bar stays hidden.'],
            ].map(([icon, text]) => (
              <li key={icon} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-300">
                  <Icon name={icon} className="text-[20px]" />
                </span>
                <span className="pt-1.5">{text}</span>
              </li>
            ))}
          </ol>
          <div className="flex gap-3">
            <Btn
              variant="primary"
              size="lg"
              icon={copied ? 'check' : 'content_copy'}
              className="flex-1"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
                setCopied(true);
              }}
            >
              {copied ? 'Copied URL' : 'Copy Link'}
            </Btn>
            <Btn size="lg" onClick={onClose} className="flex-1">
              Done
            </Btn>
          </div>
          {isLocalhost && (
            <p className="text-xs text-amber-300">
              Currently running on localhost. Once deployed on Vercel (or opened via LAN IP), this QR automatically encodes the shared device URL.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
