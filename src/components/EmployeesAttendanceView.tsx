import React, { useMemo, useState } from 'react';
import {
  addDays,
  AttendanceLog,
  dayKey,
  fmtMonth,
  fmtTime,
  hoursBetween,
  peso,
  Profile,
  StoreSettings,
  weekdayOf,
} from '../data/posData';
import { createNonPersistedClient, supabase } from '../lib/supabase';
import { Btn, cx, Icon, Modal, Stat } from './ui';

function buildMonthGrid(monthCursor: string): { key: string; inMonth: boolean; dayNum: number }[] {
  const ym = monthCursor.slice(0, 7);
  const firstDayKey = `${ym}-01`;
  const startDow = weekdayOf(firstDayKey);
  const gridStart = addDays(firstDayKey, -startDow);
  return Array.from({ length: 42 }, (_, i) => {
    const k = addDays(gridStart, i);
    return {
      key: k,
      inMonth: k.slice(0, 7) === ym,
      dayNum: Number(k.slice(8, 10)),
    };
  });
}

function shiftMonth(monthCursor: string, delta: number): string {
  const [y, m] = monthCursor.slice(0, 7).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function EmployeesAttendanceView({
  profiles,
  attendanceLogs,
  settings,
  onRefresh,
}: {
  profiles: Profile[];
  attendanceLogs: AttendanceLog[];
  settings: StoreSettings;
  onRefresh: () => Promise<void>;
}) {
  const todayKey = dayKey(Date.now());
  const currentYear = todayKey.slice(0, 4);

  const cashiers = useMemo(
    () =>
      profiles
        .filter((p) => p.role === 'cashier')
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [profiles]
  );

  const [selectedCashierId, setSelectedCashierId] = useState<string>('');
  const effectiveCashier = useMemo(
    () => cashiers.find((c) => c.id === selectedCashierId) ?? cashiers[0] ?? null,
    [cashiers, selectedCashierId]
  );

  const [monthCursor, setMonthCursor] = useState<string>(`${todayKey.slice(0, 7)}-01`);

  // Create Cashier Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [hourlyRate, setHourlyRate] = useState(String(settings.default_hourly_rate));
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const monthCells = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const ymPrefix = monthCursor.slice(0, 7);

  // Per-cashier attendance summary & Year-End Christmas Bonus Leaderboard
  const leaderboard = useMemo(() => {
    const nowMs = Date.now();
    const weekStart = addDays(todayKey, -weekdayOf(todayKey)); // Sunday start of current week

    return cashiers.map((c) => {
      const logs = attendanceLogs.filter((l) => l.cashier_id === c.id);
      const ytdDates = new Set(
        logs.filter((l) => l.shift_date.startsWith(currentYear)).map((l) => l.shift_date)
      );
      const monthLogs = logs.filter((l) => l.shift_date.startsWith(ymPrefix));
      const monthDates = new Set(monthLogs.map((l) => l.shift_date));
      const weekLogs = logs.filter(
        (l) => l.shift_date >= weekStart && l.shift_date <= todayKey
      );

      const monthHours = monthLogs.reduce(
        (s, l) => s + hoursBetween(l.login_time, l.logout_time, nowMs),
        0
      );
      const monthOt = monthLogs.reduce((s, l) => s + (Number(l.overtime_hours) || 0), 0);
      const weekHours = weekLogs.reduce(
        (s, l) => s + hoursBetween(l.login_time, l.logout_time, nowMs),
        0
      );

      // Compute absences in selected month (past/today dates from cashier's hire date with no login log)
      const hiredDay = dayKey(c.created_at);
      let absencesInMonth = 0;
      monthCells.forEach((cell) => {
        if (
          cell.inMonth &&
          cell.key <= todayKey &&
          cell.key >= hiredDay &&
          !monthDates.has(cell.key)
        ) {
          absencesInMonth += 1;
        }
      });

      const ytdHours = logs
        .filter((l) => l.shift_date.startsWith(currentYear))
        .reduce(
          (s, l) =>
            s +
            hoursBetween(l.login_time, l.logout_time, nowMs) +
            (Number(l.overtime_hours) || 0),
          0
        );

      return {
        cashier: c,
        daysWorkedMonth: monthDates.size,
        daysWorkedYtd: ytdDates.size,
        absencesInMonth,
        weekHours,
        monthHours,
        monthOt,
        ytdHours,
      };
    });
  }, [cashiers, attendanceLogs, currentYear, ymPrefix, todayKey, monthCells]);

  const sortedLeaderboard = useMemo(
    () =>
      [...leaderboard]
        .filter((r) => r.cashier.is_active)
        .sort(
          (a, b) =>
            b.daysWorkedYtd - a.daysWorkedYtd || b.ytdHours - a.ytdHours
        ),
    [leaderboard]
  );

  const selectedSummary = useMemo(
    () =>
      leaderboard.find((r) => r.cashier.id === effectiveCashier?.id) ?? null,
    [leaderboard, effectiveCashier]
  );

  const selectedCashierLogsByDay = useMemo(() => {
    const map = new Map<string, AttendanceLog[]>();
    if (!effectiveCashier) return map;
    for (const log of attendanceLogs) {
      if (log.cashier_id !== effectiveCashier.id) continue;
      const arr = map.get(log.shift_date) ?? [];
      arr.push(log);
      map.set(log.shift_date, arr);
    }
    return map;
  }, [attendanceLogs, effectiveCashier]);

  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateErr('');
    setCreating(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanUsername = username.trim().toLowerCase();
      const cleanName = fullName.trim();
      const rateNum = Number(hourlyRate) || settings.default_hourly_rate;

      if (!cleanEmail || !cleanUsername || !cleanName || password.length < 6) {
        throw new Error('All fields are required and password must be at least 6 characters.');
      }

      // Primary path: Non-persisted client signUp + Admin confirmation/profile upsert RPC
      const tempClient = createNonPersistedClient();
      const { data: signUpData, error: signUpErr } = await tempClient.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            username: cleanUsername,
          },
        },
      });

      if (!signUpErr && signUpData.user) {
        const { error: upsertErr } = await supabase.rpc('admin_upsert_cashier_profile', {
          p_user_id: signUpData.user.id,
          p_email: cleanEmail,
          p_username: cleanUsername,
          p_full_name: cleanName,
          p_hourly_rate: rateNum,
        });
        if (upsertErr) throw upsertErr;
      } else {
        // Fallback path if Supabase email signUp is rate-limited
        const { error: directErr } = await supabase.rpc('admin_create_cashier_account', {
          p_email: cleanEmail,
          p_password: password,
          p_username: cleanUsername,
          p_full_name: cleanName,
          p_hourly_rate: rateNum,
        });
        if (directErr) {
          throw new Error(directErr.message || signUpErr?.message || 'Failed to create cashier.');
        }
      }

      setFullName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setHourlyRate(String(settings.default_hourly_rate));
      setShowCreateModal(false);
      await onRefresh();
    } catch (error) {
      setCreateErr(error instanceof Error ? error.message : 'Failed to create cashier account.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (c: Profile) => {
    setBusyId(c.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !c.is_active })
        .eq('id', c.id);
      if (error) throw error;
      await onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveCashier = async (c: Profile) => {
    setBusyId(c.id);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', c.id);
      if (error) throw error;
      setConfirmRemoveId(null);
      await onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to remove cashier.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Top Row: Cashier Roster (Left) + Individual Attendance Calendar (Right) */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Roster Panel */}
        <div className="glass rounded-[28px] p-5 sm:p-6 xl:col-span-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-white">
                Cashier Accounts ({cashiers.length})
              </h2>
              <p className="text-xs text-white/55">
                Select any cashier to inspect their attendance calendar, absences &amp; worked hours.
              </p>
            </div>
            <Btn
              size="md"
              variant="success"
              icon="person_add"
              onClick={() => {
                setCreateErr('');
                setHourlyRate(String(settings.default_hourly_rate));
                setShowCreateModal(true);
              }}
            >
              Add Cashier
            </Btn>
          </div>

          {cashiers.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/50">
              <Icon name="badge" className="text-4xl text-white/25" />
              <p className="mt-2 text-sm font-bold text-white">No cashiers added yet</p>
              <p className="mt-1 text-xs">
                Click &ldquo;Add Cashier&rdquo; to provision a cashier login synced with Supabase Auth.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {cashiers.map((c) => {
                const selected = effectiveCashier?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCashierId(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCashierId(c.id);
                      }
                    }}
                    className={cx(
                      'glass-card cursor-pointer rounded-2xl border p-3.5 transition',
                      selected
                        ? 'border-orange-400 bg-orange-500/15'
                        : 'hover:border-white/25'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-white">{c.full_name}</span>
                          <span
                            className={cx(
                              'rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase',
                              c.is_active
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-red-500/20 text-red-300'
                            )}
                          >
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-orange-300">
                          @{c.username} · {c.email}
                        </p>
                        <p className="mt-1 text-xs text-white/55">
                          Rate: <span className="font-bold text-white">{peso(c.hourly_rate)}/hr</span>
                        </p>
                      </div>

                      <div
                        className="flex flex-col gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Btn
                          size="md"
                          variant="ghost"
                          disabled={busyId === c.id}
                          onClick={() => void handleToggleActive(c)}
                          className="!h-9 !px-2.5 text-xs"
                        >
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </Btn>
                        {confirmRemoveId === c.id ? (
                          <Btn
                            size="md"
                            variant="danger"
                            disabled={busyId === c.id}
                            onClick={() => void handleRemoveCashier(c)}
                            className="!h-9 !px-2.5 text-xs"
                          >
                            Confirm Remove
                          </Btn>
                        ) : (
                          <Btn
                            size="md"
                            variant="danger"
                            onClick={() => setConfirmRemoveId(c.id)}
                            className="!h-9 !px-2.5 text-xs"
                          >
                            Remove
                          </Btn>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Cashier Attendance Calendar */}
        <div className="glass rounded-[28px] p-5 sm:p-6 xl:col-span-7">
          {!effectiveCashier ? (
            <div className="flex h-full min-h-[380px] flex-col items-center justify-center text-center text-white/45">
              <Icon name="calendar_month" className="text-5xl text-white/25" />
              <p className="mt-2 text-base font-bold text-white">Select or Add a Cashier</p>
              <p className="text-xs">
                Automatic login/logout timestamps appear on each employee&apos;s monthly calendar.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-orange-300">
                    Individual Attendance Calendar
                  </span>
                  <h3 className="text-xl font-extrabold text-white">
                    {effectiveCashier.full_name} (@{effectiveCashier.username})
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <Btn
                    size="md"
                    variant="ghost"
                    icon="chevron_left"
                    onClick={() => setMonthCursor((c) => shiftMonth(c, -1))}
                  />
                  <span className="min-w-[150px] text-center text-sm font-extrabold text-white">
                    {fmtMonth(monthCursor)}
                  </span>
                  <Btn
                    size="md"
                    variant="ghost"
                    icon="chevron_right"
                    onClick={() => setMonthCursor((c) => shiftMonth(c, 1))}
                  />
                </div>
              </div>

              {selectedSummary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat
                    label="Days Worked (Month)"
                    value={`${selectedSummary.daysWorkedMonth}`}
                    sub={`YTD: ${selectedSummary.daysWorkedYtd} days`}
                    tone="text-emerald-300"
                  />
                  <Stat
                    label="Absences (Month)"
                    value={`${selectedSummary.absencesInMonth}`}
                    sub="Unworked past days"
                    tone={selectedSummary.absencesInMonth > 0 ? 'text-rose-300' : 'text-white'}
                  />
                  <Stat
                    label="Weekly Hours"
                    value={`${selectedSummary.weekHours.toFixed(1)} hrs`}
                    sub="Current week"
                    tone="text-sky-300"
                  />
                  <Stat
                    label="Monthly Hours"
                    value={`${selectedSummary.monthHours.toFixed(1)} hrs`}
                    sub={`OT: ${selectedSummary.monthOt.toFixed(1)} hrs`}
                    tone="text-amber-300"
                  />
                </div>
              )}

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-white/45">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Monthly Calendar Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {monthCells.map((cell) => {
                  const logs = selectedCashierLogsByDay.get(cell.key) ?? [];
                  const worked = logs.length > 0;
                  const hiredDay = dayKey(effectiveCashier.created_at);
                  const isAbsent =
                    cell.inMonth &&
                    !worked &&
                    cell.key <= todayKey &&
                    cell.key >= hiredDay;

                  const firstLogin = logs[0]?.login_time;
                  const lastLogout = logs[logs.length - 1]?.logout_time ?? null;
                  const dayHours = logs.reduce(
                    (s, l) => s + hoursBetween(l.login_time, l.logout_time, Date.now()),
                    0
                  );
                  const dayOt = logs.reduce(
                    (s, l) => s + (Number(l.overtime_hours) || 0),
                    0
                  );

                  return (
                    <div
                      key={cell.key}
                      className={cx(
                        'min-h-[82px] rounded-2xl border p-2 text-left text-[10px]',
                        !cell.inMonth && 'opacity-30',
                        worked
                          ? 'border-emerald-400/45 bg-emerald-500/12'
                          : isAbsent
                          ? 'border-rose-400/40 bg-rose-500/10'
                          : 'border-white/5 bg-white/[0.02]'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">
                          {cell.dayNum}
                        </span>
                        {worked && (
                          <span className="rounded bg-emerald-500/25 px-1 py-0.5 font-extrabold text-emerald-200 tabular-nums">
                            {dayHours.toFixed(1)}h
                          </span>
                        )}
                        {isAbsent && (
                          <span className="rounded bg-rose-500/30 px-1 py-0.5 font-extrabold text-rose-200">
                            ABSENT
                          </span>
                        )}
                      </div>

                      {worked && firstLogin && (
                        <div className="mt-1 space-y-0.5 text-[10px] leading-tight text-white/80">
                          <p className="truncate">In: {fmtTime(firstLogin)}</p>
                          <p className="truncate text-white/60">
                            Out: {lastLogout ? fmtTime(lastLogout) : 'Active'}
                          </p>
                          {dayOt > 0 && (
                            <p className="font-extrabold text-amber-300">
                              +{dayOt}h OT
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Year-End Christmas Bonus Leaderboard */}
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-300">
              <Icon name="emoji_events" className="text-[14px]" />
              {currentYear} Year-End Recognition
            </span>
            <h3 className="mt-1 text-xl font-extrabold text-white">
              Most Hardworking Cashier — Christmas Bonus Leaderboard
            </h3>
            <p className="text-xs text-white/55">
              Ranked automatically by Total Days Worked (Year-to-Date) and total worked hours.
            </p>
          </div>
        </div>

        {sortedLeaderboard.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/45">
            No active cashiers to rank yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">
                  <th className="px-3 py-2">Rank</th>
                  <th className="px-3 py-2">Cashier Name</th>
                  <th className="px-3 py-2 text-right">YTD Days Worked</th>
                  <th className="px-3 py-2 text-right">Month Days</th>
                  <th className="px-3 py-2 text-right">Month Absences</th>
                  <th className="px-3 py-2 text-right">Weekly Hrs</th>
                  <th className="px-3 py-2 text-right">YTD Total Hrs</th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.map((row, idx) => (
                  <tr
                    key={row.cashier.id}
                    className={cx(
                      'glass-card rounded-2xl',
                      idx === 0 && 'border border-amber-400/50 bg-amber-500/10'
                    )}
                  >
                    <td className="rounded-l-2xl px-3 py-3 font-extrabold">
                      <span
                        className={cx(
                          'inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-extrabold',
                          idx === 0
                            ? 'bg-amber-400 text-black'
                            : idx === 1
                            ? 'bg-slate-300 text-black'
                            : idx === 2
                            ? 'bg-orange-400 text-black'
                            : 'bg-white/10 text-white'
                        )}
                      >
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-extrabold text-white">
                      {row.cashier.full_name}
                      {idx === 0 && (
                        <span className="ml-2 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-extrabold text-amber-300">
                          Top Bonus Candidate
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-emerald-300 tabular-nums">
                      {row.daysWorkedYtd} days
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-white tabular-nums">
                      {row.daysWorkedMonth} days
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-rose-300 tabular-nums">
                      {row.absencesInMonth}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-sky-300 tabular-nums">
                      {row.weekHours.toFixed(1)} hrs
                    </td>
                    <td className="rounded-r-2xl px-3 py-3 text-right font-extrabold text-amber-300 tabular-nums">
                      {row.ytdHours.toFixed(1)} hrs
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Cashier Modal */}
      {showCreateModal && (
        <Modal
          title="Create New Cashier Account"
          subtitle="Uses a secondary non-persisted Auth session so you remain signed in as Admin"
          onClose={() => setShowCreateModal(false)}
        >
          <form onSubmit={handleCreateCashier} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Username
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. maria"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="e.g. maria@elfarmcafe.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Password (min 6 chars)
                </label>
                <input
                  type="password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Hourly Rate (₱ BARMM-05)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {createErr && (
              <div className="rounded-2xl border border-red-400/35 bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-200">
                {createErr}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Btn size="lg" variant="ghost" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Btn>
              <Btn type="submit" size="lg" variant="success" icon="person_add" disabled={creating}>
                {creating ? 'Creating Account...' : 'Create Cashier'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
