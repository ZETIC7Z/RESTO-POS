import React, { useState } from 'react';
import { BARMM_05_PRESETS, StoreSettings } from '../data/posData';
import { supabase } from '../lib/supabase';
import { QrModal } from './QrModal';
import { Btn, Icon } from './ui';

export function StoreSettingsView({
  settings,
  onSaved,
}: {
  settings: StoreSettings;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<StoreSettings>(settings);
  const [applyToAllCashiers, setApplyToAllCashiers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [showQr, setShowQr] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    try {
      const rate = Number(form.default_hourly_rate) || 54.5;
      const mult = Number(form.ot_multiplier) || 1.25;

      const { error } = await supabase
        .from('store_settings')
        .update({
          store_name: form.store_name.trim(),
          address: form.address.trim(),
          tin: form.tin.trim(),
          default_hourly_rate: rate,
          ot_multiplier: mult,
        })
        .eq('id', 1);

      if (error) throw error;

      if (applyToAllCashiers) {
        const { error: profErr } = await supabase
          .from('profiles')
          .update({ hourly_rate: rate })
          .eq('role', 'cashier');
        if (profErr) throw profErr;
      }

      await onSaved();
      setSavedMsg('Store settings saved live in Supabase!');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 pb-10 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="glass space-y-5 rounded-[28px] p-5 sm:p-6 lg:col-span-7"
      >
        <div>
          <h2 className="text-xl font-extrabold text-white">
            Store Branding, TIN &amp; BARMM-05 Payroll Rates
          </h2>
          <p className="text-xs text-white/55">
            Synced globally across Cashier POS receipts, TV Queue Display, and 80mm Payroll Payslips.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              Restaurant / Company Name
            </label>
            <input
              type="text"
              required
              value={form.store_name}
              onChange={(e) => setForm({ ...form, store_name: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              Store Address
            </label>
            <input
              type="text"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              BIR TIN
            </label>
            <input
              type="text"
              value={form.tin}
              onChange={(e) => setForm({ ...form, tin: e.target.value })}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Default Rate (₱/hr)
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={form.default_hourly_rate}
                onChange={(e) =>
                  setForm({ ...form, default_hourly_rate: Number(e.target.value) })
                }
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                OT Multiplier
              </label>
              <input
                type="number"
                step="0.05"
                min="1"
                required
                value={form.ot_multiplier}
                onChange={(e) =>
                  setForm({ ...form, ot_multiplier: Number(e.target.value) })
                }
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Lamitan City BARMM-05 Quick Presets */}
        <div className="glass-card space-y-2.5 rounded-2xl p-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-orange-300">
            Lamitan City, Basilan (Wage Order No. BARMM-05) Presets
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {BARMM_05_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, default_hourly_rate: preset.hourly }))
                }
                className="rounded-xl border border-white/15 bg-white/[0.05] p-3 text-left transition hover:border-emerald-400/50 hover:bg-emerald-500/10"
              >
                <p className="text-xs font-extrabold text-white">{preset.label}</p>
                <p className="mt-0.5 text-[11px] text-white/50">{preset.note}</p>
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 pt-1 text-xs font-bold text-white/80">
            <input
              type="checkbox"
              checked={applyToAllCashiers}
              onChange={(e) => setApplyToAllCashiers(e.target.checked)}
              className="h-4 w-4 accent-orange-500"
            />
            Also update existing active cashiers&apos; hourly rate on save
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Btn type="submit" size="lg" variant="success" icon="save" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings to Cloud'}
          </Btn>
          {savedMsg && (
            <span className="text-xs font-extrabold text-emerald-300">
              ✓ {savedMsg}
            </span>
          )}
        </div>
      </form>

      {/* Multi-Device Quick Connect Card */}
      <div className="glass space-y-4 rounded-[28px] p-5 sm:p-6 lg:col-span-5">
        <div className="flex items-center gap-2.5">
          <Icon name="devices" className="text-2xl text-orange-300" />
          <div>
            <h3 className="text-lg font-extrabold text-white">
              Multi-Device Cloud Terminals
            </h3>
            <p className="text-xs text-white/55">
              Pair tablets, kitchen monitors, and Smart TVs via QR code
            </p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          {[
            ['/cashier', 'Cashier Tablet POS Register', 'point_of_sale'],
            ['/crew', 'Kitchen Tablet Display (KDS)', 'soup_kitchen'],
            ['/display', 'Smart TV Customer Queue Screen', 'tv'],
            ['/login', 'Staff Sign-In Portal', 'login'],
          ].map(([route, title, icon]) => (
            <div
              key={route}
              className="glass-card flex items-center justify-between rounded-2xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Icon name={icon} className="text-[20px] text-orange-300" />
                <div>
                  <p className="font-extrabold text-white">{title}</p>
                  <p className="font-mono text-white/50">
                    {window.location.origin}
                    {route}
                  </p>
                </div>
              </div>
              <a
                href={route}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-white/10 px-3 py-1.5 font-bold text-emerald-300 hover:bg-white/20"
              >
                Open ↗
              </a>
            </div>
          ))}
        </div>

        <Btn
          size="lg"
          variant="soft"
          icon="qr_code_2"
          onClick={() => setShowQr(true)}
          className="w-full"
        >
          Show Scannable Device QR Code
        </Btn>
      </div>

      {showQr && (
        <QrModal
          storeName={settings.store_name}
          defaultPath="/cashier"
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
