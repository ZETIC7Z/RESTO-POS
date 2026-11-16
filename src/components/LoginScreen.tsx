import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Role } from '../data/posData';
import { useAuth } from '../lib/AuthContext';
import { QrModal } from './QrModal';
import { BrandLogo, Btn, cx, DeveloperFooter, Icon, requestFullscreen, useFullscreen } from './ui';

export function LoginScreen() {
  const { profile, storeSettings, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('cashier');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const { isFs, toggle: toggleFs } = useFullscreen();

  if (!loading && profile) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/cashier'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setSubmitting(true);
    try {
      const signedProfile = await signIn(identifier, password, role);
      requestFullscreen();
      navigate(signedProfile.role === 'admin' ? '/admin' : '/cashier', { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-full w-full flex-col justify-between overflow-y-auto px-4 py-6 sm:px-8">
      {/* Ambient 3D background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-orange-500/20 blur-[130px]" />
        <div className="absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-emerald-500/15 blur-[130px]" />
      </div>

      {/* Top Bar: Brand + Public Queue Link + Tablet QR + Fullscreen */}
      <header className="relative z-10 mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" alt={storeSettings.store_name} />
          <div>
            <p className="text-base font-extrabold tracking-tight text-white">
              {storeSettings.store_name}
            </p>
            <p className="flex items-center gap-1 text-xs text-white/55">
              <Icon name="location_on" className="text-[14px] text-orange-400" />
              {storeSettings.address}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/display"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/25"
          >
            <Icon name="tv" className="text-[20px]" />
            Queue TV Display
          </Link>
          <Btn
            size="md"
            variant="soft"
            icon="qr_code_2"
            onClick={() => setShowQr(true)}
            title="Show QR code to open POS on tablet, kitchen screen, or Smart TV"
          >
            Device QR Connect
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
            <BrandLogo size="lg" alt={storeSettings.store_name} />
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">
                Cloud Supabase POS
              </span>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">
                {storeSettings.store_name}
              </h1>
              <p className="text-xs text-white/55">
                {storeSettings.address} · Staff Sign-In
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* USERNAME OR EMAIL */}
            <div>
              <label
                htmlFor="login-identifier"
                className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.14em] text-white/60"
              >
                Username or Email
              </label>
              <div className="relative">
                <Icon
                  name="person"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-white/40"
                />
                <input
                  id="login-identifier"
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    setErr('');
                  }}
                  placeholder="Enter username or email"
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

            {/* ROLE SELECTOR */}
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
                    <p className="text-[11px] text-white/50">Time-In &amp; POS</p>
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
                    <p className="text-[11px] text-white/50">Sales &amp; Payroll</p>
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
              disabled={submitting}
              className="w-full"
            >
              {submitting
                ? 'Signing In...'
                : role === 'cashier'
                ? 'Sign In & Clock In Shift'
                : 'Sign In as Admin'}
            </Btn>
          </form>

          <div className="mt-5 border-t border-white/10 pt-4 text-center text-xs text-white/50">
            {role === 'cashier'
              ? 'Cashier login automatically records your Time-In shift in attendance logs.'
              : 'Admin manages Sales Calendar, Menu Stock, Employees & BARMM-05 Payroll.'}
          </div>
        </div>
      </main>

      <DeveloperFooter className="relative z-10" />

      {showQr && (
        <QrModal
          storeName={storeSettings.store_name}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
