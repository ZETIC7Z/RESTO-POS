import { useState } from 'react';
import QRCode from 'react-qr-code';
import { Btn, Icon, Modal } from './ui';

/** URL other devices should open. On the PC (localhost) we swap in the Wi-Fi IP. */
export function deviceUrl(lanIp: string) {
  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const host = isLocal && lanIp ? lanIp : hostname;
  return `${protocol}//${host}${port ? `:${port}` : ''}/`;
}

export function QrModal({
  lanIp = '',
  url: explicitUrl,
  storeName = 'Ligaya Kusina Express',
  onClose,
}: {
  lanIp?: string;
  url?: string;
  storeName?: string;
  onClose: () => void;
}) {
  const url = explicitUrl || deviceUrl(lanIp);
  const [copied, setCopied] = useState(false);
  return (
    <Modal
      title={`${storeName} — Tablet & Mobile QR Connect`}
      subtitle="Scan with any tablet or phone camera on your Wi-Fi — the POS opens automatically"
      onClose={onClose}
      wide
    >
      <div className="grid items-center gap-6 md:grid-cols-[auto,1fr]">
        <div className="mx-auto rounded-[28px] bg-white p-5 shadow-[0_30px_60px_-20px_rgba(255,120,40,0.45)]">
          <QRCode value={url} size={260} level="M" bgColor="#ffffff" fgColor="#0b0d14" />
        </div>
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              Direct Wi-Fi POS URL
            </span>
            <p className="select-all break-all font-mono text-lg font-bold text-emerald-300">{url}</p>
          </div>
          <ol className="space-y-3 text-sm text-white/75">
            {[
              ['wifi', 'Connect the tablet/phone to the same Wi-Fi as this PC.'],
              ['qr_code_scanner', 'Open the Camera app and point it at the QR code, then tap the link.'],
              ['fullscreen', 'Sign in — the POS switches to full screen automatically (address bar hidden).'],
              ['add_to_home_screen', 'Optional: browser menu → "Add to Home screen" to launch it like an app.'],
            ].map(([icon, text]) => (
              <li key={icon} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-500/15 text-orange-300">
                  <Icon name={icon} className="text-[20px]" />
                </span>
                <span className="pt-2">{text}</span>
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
              {copied ? 'Copied' : 'Copy link'}
            </Btn>
            <Btn size="lg" onClick={onClose} className="flex-1">
              Done
            </Btn>
          </div>
          {/localhost|127\.0\.0\.1/.test(url) && (
            <p className="text-xs text-amber-300">
              Couldn&apos;t detect this PC&apos;s Wi-Fi address yet — make sure the PC is connected to the restaurant Wi-Fi.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
