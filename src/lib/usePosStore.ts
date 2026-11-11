import { useCallback, useEffect, useRef, useState } from 'react';
import type { Patch, PosDb } from '../data/posData';
import { buildSeedDb } from '../data/seed';
import { mergePatch } from './merge';

const CACHE_KEY = 'ligaya_db_cache_v3';
const PENDING_KEY = 'ligaya_pending_v3';
const POLL_MS = 3000;

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full — server copy is the source of truth */
  }
};

/**
 * Shared POS database for all devices on the restaurant network.
 * - Polls the PC server every 3s (only downloads when something changed).
 * - Changes apply instantly on this device, then sync; if Wi-Fi drops they are queued and retried.
 */
export function usePosStore() {
  const [db, setDb] = useState<PosDb>(() => readJson<PosDb | null>(CACHE_KEY, null) ?? buildSeedDb());
  const [online, setOnline] = useState<boolean | null>(null);
  const [lanIp, setLanIp] = useState('');
  const versionRef = useRef(-1);
  const pending = useRef<Patch[]>(readJson<Patch[]>(PENDING_KEY, []));
  const busy = useRef(false);
  const rerun = useRef(false);

  const accept = (server: PosDb) => {
    versionRef.current = server.version;
    let next = server;
    for (const p of pending.current) next = mergePatch(next, p);
    setDb(next);
    writeJson(CACHE_KEY, next);
  };

  const sync = useCallback(async (): Promise<void> => {
    if (busy.current) {
      rerun.current = true;
      return;
    }
    busy.current = true;
    try {
      while (pending.current.length) {
        const res = await fetch('/api/pos/patch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pending.current[0]),
        });
        if (!res.ok) throw new Error(`patch ${res.status}`);
        const data = await res.json();
        pending.current.shift();
        writeJson(PENDING_KEY, pending.current);
        if (data.lanIp) setLanIp(data.lanIp);
        accept(data.db);
      }
      const res = await fetch(`/api/pos/state?v=${versionRef.current}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`state ${res.status}`);
      const data = await res.json();
      if (data.lanIp) setLanIp(data.lanIp);
      if (!data.unchanged) accept(data.db);
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      busy.current = false;
      if (rerun.current) {
        rerun.current = false;
        void sync();
      }
    }
  }, []);

  useEffect(() => {
    void sync();
    const t = window.setInterval(() => void sync(), POLL_MS);
    const onVis = () => document.visibilityState === 'visible' && void sync();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('online', onVis);
    };
  }, [sync]);

  const patch = useCallback(
    (p: Patch) => {
      pending.current.push(p);
      writeJson(PENDING_KEY, pending.current);
      setDb((cur) => {
        const next = mergePatch(cur, p);
        writeJson(CACHE_KEY, next);
        return next;
      });
      void sync();
    },
    [sync]
  );

  const resetDemo = useCallback(async () => {
    pending.current = [];
    writeJson(PENDING_KEY, []);
    try {
      const res = await fetch('/api/pos/reset', { method: 'POST' });
      const data = await res.json();
      accept(data.db);
    } catch {
      const fresh = buildSeedDb();
      setDb(fresh);
      writeJson(CACHE_KEY, fresh);
    }
  }, []);

  const synced: 'online' | 'local' = online ? 'online' : 'local';

  return {
    db,
    online,
    synced,
    lanIp,
    patch,
    commit: patch,
    resetDemo,
    resetAll: resetDemo,
    pendingCount: pending.current.length,
  };
}
