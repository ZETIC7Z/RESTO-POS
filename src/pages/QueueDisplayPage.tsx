import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo, Icon, useFullscreen, useNow } from '../components/ui';
import { dayKey, fmtDateTime, OrderRow } from '../data/posData';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

function TvClock() {
  const now = useNow(1000);
  return <span className="font-mono text-lg font-bold text-white/85">{fmtDateTime(now)}</span>;
}

function playReadyChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [587.33, 880]; // D5 -> A5 pleasant restaurant chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.16);
      gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + idx * 0.16 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.16 + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.16);
      osc.stop(ctx.currentTime + idx * 0.16 + 0.6);
    });
  } catch {
    /* ignore audio errors on restricted devices */
  }
}

export function QueueDisplayPage() {
  const { storeSettings } = useAuth();
  const { isFs, toggle: toggleFs } = useFullscreen();
  const [preparing, setPreparing] = useState<OrderRow[]>([]);
  const [ready, setReady] = useState<OrderRow[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [wakeActive, setWakeActive] = useState(false);

  const prevReadyIds = useRef<Set<string>>(new Set());
  const initialLoaded = useRef(false);

  const fetchDisplayOrders = useCallback(async () => {
    const today = dayKey(Date.now());
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, or_number, customer_name, status, order_date, created_at')
      .eq('order_date', today)
      .in('status', ['preparing', 'ready'])
      .order('order_number', { ascending: true });

    if (!data) return;
    const rows = data as OrderRow[];
    const prepList = rows.filter((r) => r.status === 'preparing');
    const readyList = rows.filter((r) => r.status === 'ready');

    if (initialLoaded.current && soundEnabled) {
      const hasNewReady = readyList.some((r) => !prevReadyIds.current.has(r.id));
      if (hasNewReady) {
        playReadyChime();
      }
    }

    prevReadyIds.current = new Set(readyList.map((r) => r.id));
    initialLoaded.current = true;
    setPreparing(prepList);
    setReady(readyList);
  }, [soundEnabled]);

  useEffect(() => {
    void fetchDisplayOrders();

    const channel = supabase
      .channel('tv-queue-display-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => void fetchDisplayOrders()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchDisplayOrders]);

  // Keep Smart TV / Android TV display awake
  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          sentinel = await navigator.wakeLock.request('screen');
          setWakeActive(true);
        }
      } catch {
        setWakeActive(false);
      }
    };

    void acquireWakeLock();
    const onVis = () => {
      if (document.visibilityState === 'visible') void acquireWakeLock();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void sentinel?.release();
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[#05070c] text-white select-none">
      {/* Zero-Clutter TV Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 bg-black/50 px-6 py-4">
        <div className="flex items-center gap-3.5">
          <BrandLogo size="md" alt={storeSettings.store_name} />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">
              {storeSettings.store_name}
            </h1>
            <p className="text-xs text-white/55">{storeSettings.address}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TvClock />
          {wakeActive && (
            <span className="hidden items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-300 sm:inline-flex">
              <Icon name="bolt" className="text-[14px]" />
              TV Stay-Awake Active
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              if (next) playReadyChime();
            }}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-bold text-white/80 hover:bg-white/15"
            title="Toggle & test Ready chime sound"
          >
            <Icon name={soundEnabled ? 'volume_up' : 'volume_off'} className="text-[18px]" />
            <span>{soundEnabled ? 'Chime On' : 'Muted'}</span>
          </button>
          <button
            type="button"
            onClick={toggleFs}
            className="flex h-11 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs font-bold text-white/80 hover:bg-white/15"
          >
            <Icon name={isFs ? 'fullscreen_exit' : 'fullscreen'} className="text-[18px]" />
          </button>
          <Link
            to="/login"
            className="flex h-11 items-center rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white/50 hover:text-white"
          >
            Staff
          </Link>
        </div>
      </header>

      {/* Split-Screen Customer Queue Board */}
      <main className="grid flex-1 grid-cols-1 gap-5 overflow-hidden p-5 md:grid-cols-2">
        {/* LEFT: PREPARING */}
        <section className="glass flex flex-col overflow-hidden rounded-[32px] border border-amber-400/30">
          <div className="border-b border-amber-400/25 bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-6 py-5 text-center">
            <h2 className="text-3xl font-extrabold uppercase tracking-[0.16em] text-amber-300 sm:text-4xl">
              PREPARING
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {preparing.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xl font-bold text-white/25">
                Waiting for orders...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {preparing.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-col items-center justify-center rounded-3xl border border-amber-400/30 bg-white/[0.05] px-4 py-6 text-center"
                  >
                    <span className="font-mono text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
                      #{String(o.order_number).padStart(2, '0')}
                    </span>
                    <span className="mt-2 truncate max-w-full text-xs font-bold uppercase tracking-wider text-white/50">
                      {o.customer_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: NOW SERVING */}
        <section className="flex flex-col overflow-hidden rounded-[32px] border-2 border-emerald-400 bg-gradient-to-b from-emerald-950/60 to-black/90 shadow-[0_0_80px_-20px_rgba(16,185,129,0.5)]">
          <div className="border-b border-emerald-400/40 bg-emerald-500 px-6 py-5 text-center">
            <h2 className="text-3xl font-extrabold uppercase tracking-[0.16em] text-black sm:text-4xl">
              NOW SERVING
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {ready.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xl font-bold text-emerald-300/30">
                Ready orders will appear here
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {ready.map((o) => (
                  <div
                    key={o.id}
                    className="animate-pop flex flex-col items-center justify-center rounded-3xl border-2 border-emerald-400 bg-emerald-500/20 px-5 py-8 text-center shadow-[0_18px_40px_-15px_rgba(16,185,129,0.75)]"
                  >
                    <span className="font-mono text-6xl font-black tracking-tight text-emerald-300 sm:text-7xl">
                      #{String(o.order_number).padStart(2, '0')}
                    </span>
                    <span className="mt-2 truncate max-w-full text-sm font-extrabold uppercase tracking-wider text-white">
                      {o.customer_name} · PLEASE CLAIM
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
