import React, { useMemo, useState } from 'react';
import {
  AttendanceLog,
  dayKey,
  daysInMonth,
  fmtTime,
  hoursBetween,
  peso,
  Profile,
  StoreSettings,
} from '../data/posData';
import { supabase } from '../lib/supabase';
import { PayslipModal, PayslipPrintData } from './ReceiptModal';
import { Btn, cx, Icon, Stat } from './ui';

export function PayrollView({
  profiles,
  attendanceLogs,
  settings,
  adminProfile,
  onRefresh,
}: {
  profiles: Profile[];
  attendanceLogs: AttendanceLog[];
  settings: StoreSettings;
  adminProfile: Profile;
  onRefresh: () => Promise<void>;
}) {
  const todayKey = dayKey(Date.now());
  const defaultHalf = Number(todayKey.slice(8, 10)) <= 15 ? 'first' : 'second';

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

  const [monthYm, setMonthYm] = useState<string>(todayKey.slice(0, 7)); // YYYY-MM
  const [cutoffHalf, setCutoffHalf] = useState<'first' | 'second'>(defaultHalf);

  const { cutoffStart, cutoffEnd } = useMemo(() => {
    const [y, m] = monthYm.split('-').map(Number);
    const lastDay = daysInMonth(y, m);
    if (cutoffHalf === 'first') {
      return { cutoffStart: `${monthYm}-01`, cutoffEnd: `${monthYm}-15` };
    }
    return {
      cutoffStart: `${monthYm}-16`,
      cutoffEnd: `${monthYm}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [monthYm, cutoffHalf]);

  // Manual Overtime Entry by Exact Date
  const [otDate, setOtDate] = useState<string>(todayKey);
  const [otHoursInput, setOtHoursInput] = useState<string>('1');
  const [otNotes, setOtNotes] = useState<string>('');
  const [savingOt, setSavingOt] = useState(false);

  const [payslipPreview, setPayslipPreview] = useState<PayslipPrintData | null>(null);

  const cutoffLogs = useMemo(() => {
    if (!effectiveCashier) return [];
    return attendanceLogs
      .filter(
        (l) =>
          l.cashier_id === effectiveCashier.id &&
          l.shift_date >= cutoffStart &&
          l.shift_date <= cutoffEnd
      )
      .sort((a, b) => a.shift_date.localeCompare(b.shift_date));
  }, [attendanceLogs, effectiveCashier, cutoffStart, cutoffEnd]);

  const payrollStats = useMemo(() => {
    const nowMs = Date.now();
    const daysSet = new Set(cutoffLogs.map((l) => l.shift_date));
    const regularHours = cutoffLogs.reduce(
      (s, l) => s + hoursBetween(l.login_time, l.logout_time, nowMs),
      0
    );
    const overtimeHours = cutoffLogs.reduce(
      (s, l) => s + (Number(l.overtime_hours) || 0),
      0
    );
    const hourlyRate =
      Number(effectiveCashier?.hourly_rate) || settings.default_hourly_rate;
    const otMult = Number(settings.ot_multiplier) || 1.25;

    const regularPay = Math.round(regularHours * hourlyRate * 100) / 100;
    const overtimePay = Math.round(overtimeHours * hourlyRate * otMult * 100) / 100;
    const netPayout = Math.round((regularPay + overtimePay) * 100) / 100;

    return {
      daysWorked: daysSet.size,
      regularHours,
      overtimeHours,
      hourlyRate,
      otMult,
      regularPay,
      overtimePay,
      netPayout,
    };
  }, [cutoffLogs, effectiveCashier, settings]);

  const handleSaveOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCashier) return;
    const otVal = Number(otHoursInput);
    if (!Number.isFinite(otVal) || otVal < 0) return;

    setSavingOt(true);
    try {
      const existing = attendanceLogs.find(
        (l) => l.cashier_id === effectiveCashier.id && l.shift_date === otDate
      );

      if (existing) {
        const { error } = await supabase
          .from('attendance_logs')
          .update({
            overtime_hours: otVal,
            notes: otNotes.trim() || existing.notes || 'Admin approved overtime',
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Admin logging OT on an exact date with no clock-in row creates a balanced 0-regular-hour OT entry
        const noonIso = new Date(`${otDate}T12:00:00+08:00`).toISOString();
        const { error } = await supabase.from('attendance_logs').insert({
          cashier_id: effectiveCashier.id,
          shift_date: otDate,
          login_time: noonIso,
          logout_time: noonIso,
          overtime_hours: otVal,
          notes: otNotes.trim() || 'Admin manual overtime entry',
        });
        if (error) throw error;
      }

      setOtNotes('');
      await onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save overtime hours.');
    } finally {
      setSavingOt(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">
              Wage Order No. BARMM-05 · Lamitan City, Basilan
            </span>
            <h2 className="mt-1.5 text-2xl font-extrabold text-white">
              Cashier Payroll &amp; 80mm Thermal Payslip Printer
            </h2>
            <p className="text-xs text-white/55">
              Select a cashier and semi-monthly cutoff (auto 28/29/30/31-day handling), log overtime on exact dates, and print thermal payslips.
            </p>
          </div>

          {effectiveCashier && (
            <Btn
              size="lg"
              variant="primary"
              icon="print"
              onClick={() =>
                setPayslipPreview({
                  cashierName: effectiveCashier.full_name,
                  username: effectiveCashier.username,
                  cutoffStart,
                  cutoffEnd,
                  daysWorked: payrollStats.daysWorked,
                  regularHours: payrollStats.regularHours,
                  overtimeHours: payrollStats.overtimeHours,
                  hourlyRate: payrollStats.hourlyRate,
                  otMultiplier: payrollStats.otMult,
                  regularPay: payrollStats.regularPay,
                  overtimePay: payrollStats.overtimePay,
                  netPayout: payrollStats.netPayout,
                  preparedBy: adminProfile.full_name,
                })
              }
            >
              Print Payslip (80mm Thermal / QMS Printer)
            </Btn>
          )}
        </div>

        {/* Selectors: Cashier + Month + Semi-Monthly Cutoff */}
        <div className="mt-5 grid gap-3 sm:grid-cols-12">
          <div className="sm:col-span-5">
            <label className="mb-1 block text-xs font-bold uppercase text-white/55">
              Select Cashier
            </label>
            <select
              value={effectiveCashier?.id || ''}
              onChange={(e) => setSelectedCashierId(e.target.value)}
              className="input font-bold"
            >
              {cashiers.length === 0 ? (
                <option value="" className="bg-[#11141d]">
                  No cashiers registered yet
                </option>
              ) : (
                cashiers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#11141d]">
                    {c.full_name} (@{c.username}) — {peso(c.hourly_rate)}/hr
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="sm:col-span-3">
            <label className="mb-1 block text-xs font-bold uppercase text-white/55">
              Payroll Month
            </label>
            <input
              type="month"
              value={monthYm}
              onChange={(e) => {
                if (e.target.value) setMonthYm(e.target.value);
              }}
              className="input font-bold"
            />
          </div>

          <div className="sm:col-span-4">
            <span className="mb-1 block text-xs font-bold uppercase text-white/55">
              Cutoff Period ({cutoffStart} to {cutoffEnd})
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCutoffHalf('first')}
                className={cx(
                  'h-14 rounded-2xl border text-xs font-extrabold transition',
                  cutoffHalf === 'first'
                    ? 'chip-active'
                    : 'border-white/10 bg-white/[0.04] text-white/65'
                )}
              >
                1st – 15th
              </button>
              <button
                type="button"
                onClick={() => setCutoffHalf('second')}
                className={cx(
                  'h-14 rounded-2xl border text-xs font-extrabold transition',
                  cutoffHalf === 'second'
                    ? 'chip-active'
                    : 'border-white/10 bg-white/[0.04] text-white/65'
                )}
              >
                16th – End ({cutoffEnd.slice(8, 10)})
              </button>
            </div>
          </div>
        </div>

        {/* Summary KPIs */}
        {effectiveCashier && (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat
              label="Days Worked"
              value={`${payrollStats.daysWorked} days`}
              sub={`${cutoffStart} .. ${cutoffEnd}`}
              tone="text-white"
            />
            <Stat
              label="Regular Hours Pay"
              value={peso(payrollStats.regularPay)}
              sub={`${payrollStats.regularHours.toFixed(2)} hrs × ${peso(
                payrollStats.hourlyRate
              )}/hr`}
              tone="text-sky-300"
            />
            <Stat
              label="Overtime Pay"
              value={peso(payrollStats.overtimePay)}
              sub={`${payrollStats.overtimeHours.toFixed(2)} hrs × ${
                payrollStats.otMult
              }x`}
              tone="text-amber-300"
            />
            <Stat
              label="Rate Reference"
              value={`${peso(payrollStats.hourlyRate)}/hr`}
              sub={`₱${(payrollStats.hourlyRate * 8).toFixed(2)} / 8-hr day`}
              tone="text-white/85"
            />
            <Stat
              label="Total Net Payout"
              value={peso(payrollStats.netPayout)}
              sub="BARMM-05 compliant"
              tone="text-emerald-300"
            />
          </div>
        )}
      </div>

      {/* Add Overtime Hours by Exact Date + Cutoff Shift Log */}
      {effectiveCashier && (
        <div className="grid gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleSaveOvertime}
            className="glass space-y-4 rounded-[28px] p-5 sm:p-6 lg:col-span-5"
          >
            <div>
              <h3 className="text-lg font-extrabold text-white">
                Add / Update Overtime Hours by Exact Date
              </h3>
              <p className="text-xs text-white/55">
                Pick the exact shift date where overtime occurred. Paid at{' '}
                <span className="font-bold text-amber-300">{payrollStats.otMult}x</span>{' '}
                rate.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Exact Overtime Date
              </label>
              <input
                type="date"
                value={otDate}
                onChange={(e) => setOtDate(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Overtime Hours on {otDate}
              </label>
              <input
                type="number"
                min="0"
                max="16"
                step="0.25"
                value={otHoursInput}
                onChange={(e) => setOtHoursInput(e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Overtime Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Weekend rush / inventory close"
                value={otNotes}
                onChange={(e) => setOtNotes(e.target.value)}
                className="input"
              />
            </div>

            <Btn
              type="submit"
              size="lg"
              variant="success"
              icon="more_time"
              disabled={savingOt}
              className="w-full"
            >
              {savingOt ? 'Saving Overtime...' : 'Save Overtime Hours'}
            </Btn>
          </form>

          <div className="glass rounded-[28px] p-5 sm:p-6 lg:col-span-7">
            <h3 className="text-lg font-extrabold text-white">
              Cutoff Shift Breakdown ({cutoffLogs.length} logs)
            </h3>
            <p className="text-xs text-white/55">
              Showing all recorded shifts for {effectiveCashier.full_name} between{' '}
              {cutoffStart} and {cutoffEnd}.
            </p>

            {cutoffLogs.length === 0 ? (
              <div className="py-12 text-center text-white/45">
                <Icon name="schedule" className="text-4xl text-white/25" />
                <p className="mt-2 text-sm font-bold">
                  No shifts recorded during this cutoff period.
                </p>
              </div>
            ) : (
              <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
                {cutoffLogs.map((l) => {
                  const reg = hoursBetween(l.login_time, l.logout_time, Date.now());
                  const ot = Number(l.overtime_hours) || 0;
                  return (
                    <div
                      key={l.id}
                      className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-xs"
                    >
                      <div>
                        <p className="font-mono font-extrabold text-white">{l.shift_date}</p>
                        <p className="text-white/55">
                          In {fmtTime(l.login_time)} · Out{' '}
                          {l.logout_time ? fmtTime(l.logout_time) : 'Still On Duty'}
                          {l.notes ? ` · ${l.notes}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 font-extrabold tabular-nums">
                        <span className="text-sky-300">{reg.toFixed(2)}h reg</span>
                        {ot > 0 && <span className="text-amber-300">+{ot.toFixed(2)}h OT</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {payslipPreview && (
        <PayslipModal
          payslip={payslipPreview}
          settings={settings}
          onClose={() => setPayslipPreview(null)}
        />
      )}
    </div>
  );
}
