import React, { useState } from 'react';
import { Account, Role, Session, Settings } from '../data/posData';
import { Btn, cx, Icon, requestFullscreen, useFullscreen } from './ui';

export function LoginScreen({
  settings,
  lanUrl,
  onLogin,
  onOpenQr,
}: {
  settings: Settings;
  lanUrl: string;
  onLogin: (session: Session) => void;
  onOpenQr: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState('');
  const { isFs, toggle: toggleFs } = useFullscreen();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    const p = password;

    // Match against configured accounts (plus guaranteed built-in admin/admin and user/user fallback)
    const accounts: Account[] =
      settings.accounts?.length > 0
        ? settings.accounts
        : [
            { username: 'admin', password: 'admin', role: 'admin', name: 'Administrator' },
            { username: 'user', password: 'user', role: 'cashier', name: 'Cashier' },
          ];

    const match = accounts.find(
      (a) => a.username.toLowerCase() === u && a.password === p && a.role === role
    );
    const anyRoleMatch = accounts.find(
      (a) => a.username.toLowerCase() === u && a.password === p
    );

    if (!match) {
      if (anyRoleMatch) {
        setErr(
          `Account "${anyRoleMatch.username}" belongs to the ${anyRoleMatch.role.toUpperCase()} role. Please select ${
            anyRoleMatch.role === 'admin' ? 'Admin' : 'Cashier'
          } below.`
        );
      } else {
        setErr('Invalid username or password. Use admin / admin or user / user.');
      }
      return;
    }

    setErr('');
    requestFullscreen();
    onLogin({
      username: match.username,
      role: match.role,
      name: match.name,
      loginAt: Date.now(),
    });
  };

  const quickFill = (u: string, p: string, r: Role) => {
    setUsername(u);
    setPassword(p);
    setRole(r);
    setErr('');
  };

  return (
    <div className="relative flex min-h-full w-full flex-col justify-between overflow-y-auto px-4 py-6 sm:px-8">
      {/* Ambient 3D background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-orange-500/20 blur-[130px]" />
        <div className="absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-emerald-500/15 blur-[130px]" />
      </div>

      {/* Top Bar: Brand + Tablet QR + Fullscreen */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9a4d] to-[#ff5a1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_12px_28px_-8px_rgba(255,96,32,0.85)]">
            <Icon name="restaurant" className="text-[26px] text-white" />
          </div>
          <div>
            <p className="text-base font-extrabold tracking-tight text-white">
              {settings.storeName}
            </p>
            <p className="flex items-center gap-1 text-xs text-white/55">
              <Icon name="location_on" className="text-[14px] text-orange-400" />
              {settings.address}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Btn
            size="md"
            variant="soft"
            icon="qr_code_2"
            onClick={onOpenQr}
            title="Show QR code to open POS on tablet or mobile"
          >
            Tablet QR Connect
          </Btn>
          <Btn
            size="md"
            variant="ghost"
            icon={isFs ? 'fullscreen_exit' : 'fullscreen'}
            onClick={toggleFs}
            title="Toggle full-screen POS mode (hides browser URL bar)"
          >
            {isFs ? 'Exit Full Screen' : 'Full Screen'}
          </Btn>
        </div>
      </header>

      {/* Main 3D Glass Login Card */}
      <main className="relative z-10 my-6 flex flex-1 items-center justify-center">
        <div className="glass w-full max-w-md rounded-[32px] p-6 sm:p-9">
          <div className="mb-6 flex items-center gap-3.5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-[#ff9a4d] to-[#ff5a1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_30px_-10px_rgba(255,96,32,0.9)]">
              <Icon name="point_of_sale" className="text-[30px] text-white" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-300">
                Smart Fast-Food POS
              </span>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
                {settings.storeName}
              </h1>
              <p className="text-xs text-white/55">
                {settings.address} · Sign in to start
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {/* USERNAME */}
            <div>
              <label
                htmlFor="login-username"
                className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-white/60"
              >
                Username
              </label>
              <div className="relative">
                <Icon
                  name="person"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-white/40"
                />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setErr('');
                  }}
                  placeholder="Enter username (admin or user)"
                  className="input h-14 !pl-12 text-base font-semibold"
                  required
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-white/60"
              >
                Password
              </label>
              <div className="relative">
                <Icon
                  name="lock"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-white/40"
                />
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErr('');
                  }}
                  placeholder="Enter password"
                  className="input h-14 !pl-12 !pr-12 text-base font-semibold"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <Icon name={showPass ? 'visibility_off' : 'visibility'} className="text-[20px]" />
                </button>
              </div>
            </div>

            {/* ROLE SELECTOR (Large Touch Cards) */}
            <div>
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-white/60">
                Role
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRole('cashier');
                    setErr('');
                  }}
                  className={cx(
                    'flex h-16 items-center gap-3 rounded-2xl border px-4 text-left transition active:scale-[0.985]',
                    role === 'cashier'
                      ? 'border-orange-400/60 bg-gradient-to-b from-orange-500/25 to-orange-600/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-10px_rgba(255,106,43,0.65)]'
                      : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]'
                  )}
                >
                  <span
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                      role === 'cashier'
                        ? 'border-orange-400 bg-orange-500 text-white'
                        : 'border-white/30'
                    )}
                  >
                    {role === 'cashier' && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold leading-tight">Cashier</p>
                    <p className="text-[11px] text-white/50">Orders & Receipt</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole('admin');
                    setErr('');
                  }}
                  className={cx(
                    'flex h-16 items-center gap-3 rounded-2xl border px-4 text-left transition active:scale-[0.985]',
                    role === 'admin'
                      ? 'border-emerald-400/60 bg-gradient-to-b from-emerald-500/25 to-emerald-600/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-10px_rgba(23,194,122,0.65)]'
                      : 'border-white/10 bg-white/[0.04] text-white/65 hover:bg-white/[0.08]'
                  )}
                >
                  <span
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
                      role === 'admin'
                        ? 'border-emerald-400 bg-emerald-500 text-white'
                        : 'border-white/30'
                    )}
                  >
                    {role === 'admin' && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold leading-tight">Admin</p>
                    <p className="text-[11px] text-white/50">Sales & Full Control</p>
                  </div>
                </button>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-2 rounded-2xl border border-red-400/35 bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-200">
                <Icon name="error_outline" className="text-[18px] text-red-300" />
                <span>{err}</span>
              </div>
            )}

            <Btn
              type="submit"
              variant="success"
              size="xl"
              icon="login"
              className="w-full"
            >
              Sign in ({role === 'admin' ? 'Admin Full Access' : 'Cashier Terminal'})
            </Btn>
          </form>

          {/* 1-Tap Quick Fill Credentials Helper for Tablet / Demo */}
          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-2.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
              One-Tap Quick Fill Credentials
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => quickFill('user', 'user', 'cashier')}
                className="glass-card flex h-14 items-center justify-between rounded-2xl px-3.5 text-left transition hover:border-orange-400/40 active:scale-[0.98]"
              >
                <div>
                  <p className="text-xs font-extrabold text-orange-300">Cashier Login</p>
                  <p className="font-mono text-xs text-white/75">user / user</p>
                </div>
                <Icon name="touch_app" className="text-[20px] text-orange-300" />
              </button>

              <button
                type="button"
                onClick={() => quickFill('admin', 'admin', 'admin')}
                className="glass-card flex h-14 items-center justify-between rounded-2xl px-3.5 text-left transition hover:border-emerald-400/40 active:scale-[0.98]"
              >
                <div>
                  <p className="text-xs font-extrabold text-emerald-300">Admin Login</p>
                  <p className="font-mono text-xs text-white/75">admin / admin</p>
                </div>
                <Icon name="admin_panel_settings" className="text-[20px] text-emerald-300" />
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/40">
              LAN URL: <span className="font-mono text-white/70">{lanUrl}</span>
            </p>
          </div>
        </div>
      </main>

      {/* Developer Attribution Footer */}
      <footer className="relative z-10 mx-auto flex flex-col items-center justify-center gap-1.5 pt-2 text-center text-xs text-white/50">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <img src="/zeticuz-logo.svg" alt="ZETICUZ" className="h-4 w-4 opacity-85" />
          <span className="font-semibold tracking-wide text-white/70">
            SITE DEVELOPED BY: Sam Pangilinan · © 2026
          </span>
          <a
            href="https://www.zeticuz.xyz/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-orange-300 transition hover:border-orange-400/40 hover:bg-orange-500/15"
          >
            Explore Developer Portfolio & Projects ↗
          </a>
        </div>
      </footer>
    </div>
  );
}
