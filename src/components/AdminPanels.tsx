import React, { useState } from 'react';
import {
  Account,
  CATEGORIES,
  CategoryId,
  fmtDateTime,
  fmtTime,
  IMAGE_PRESETS,
  KitchenStatus,
  MenuItem,
  Order,
  OrderType,
  peso,
  Role,
  Settings,
  TableTab,
  uid,
} from '../data/posData';
import { calcTotals } from '../lib/pricing';
import { Btn, cx, Icon, Modal } from './ui';

// ── 1. Tables & Open Tabs View ───────────────────────────────

export function TablesView({
  tableCount,
  tabs,
  vatRate,
  onOpenTableForOrder,
  onResumeTab,
  onCloseTab,
}: {
  tableCount: number;
  tabs: TableTab[];
  vatRate: number;
  onOpenTableForOrder: (tableLabel: string) => void;
  onResumeTab: (tab: TableTab) => void;
  onCloseTab: (tab: TableTab) => void;
}) {
  const activeTabs = tabs.filter((t) => !t.deleted);
  const tableLabels = Array.from({ length: tableCount }, (_, i) => `Table ${i + 1}`);

  return (
    <div className="space-y-6 pb-10">
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Dining Room Floor &amp; Open Table Tabs
            </h2>
            <p className="text-xs text-white/55">
              Tap any free table to start a dine-in order, or tap an occupied table to add items or settle the bill.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Available ({tableCount - activeTabs.length})
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-500/15 px-3 py-1 text-orange-300">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              Occupied ({activeTabs.length})
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {tableLabels.map((label) => {
            const tab = activeTabs.find((t) => t.table === label);
            const totals = tab ? calcTotals(tab.items, null, vatRate) : null;

            return (
              <div
                key={label}
                className={cx(
                  'flex min-h-[168px] flex-col justify-between rounded-[24px] border p-4 transition',
                  tab
                    ? 'border-orange-400/50 bg-gradient-to-b from-orange-500/20 to-orange-600/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_14px_30px_-14px_rgba(255,96,32,0.75)]'
                    : 'glass-card hover:border-emerald-400/40'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-base font-extrabold text-white">{label}</span>
                    <p className="text-xs text-white/55">
                      {tab ? tab.customerName || 'Dine-In Guest' : 'Ready for seating'}
                    </p>
                  </div>
                  <span
                    className={cx(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider',
                      tab
                        ? 'bg-orange-500 text-white'
                        : 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                    )}
                  >
                    {tab ? tab.kitchenStatus : 'Free'}
                  </span>
                </div>

                {tab && totals ? (
                  <div className="my-3 space-y-1 border-y border-white/10 py-2 text-xs">
                    <div className="flex justify-between text-white/75">
                      <span>{tab.items.reduce((s, i) => s + i.qty, 0)} items</span>
                      <span>Opened {fmtTime(tab.openedAt)}</span>
                    </div>
                    <p className="truncate text-[11px] text-white/55">
                      {tab.items.map((i) => `${i.qty}x ${i.title}`).join(', ')}
                    </p>
                    <p className="pt-1 text-base font-extrabold text-emerald-300 tabular-nums">
                      {peso(totals.total)}
                    </p>
                  </div>
                ) : (
                  <div className="my-3 flex items-center justify-center py-4 text-white/20">
                    <Icon name="table_restaurant" className="text-4xl" />
                  </div>
                )}

                {tab ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Btn
                      size="md"
                      variant="primary"
                      icon="point_of_sale"
                      onClick={() => onResumeTab(tab)}
                    >
                      Load / Pay
                    </Btn>
                    <Btn
                      size="md"
                      variant="danger"
                      icon="close"
                      onClick={() => onCloseTab(tab)}
                    >
                      Clear
                    </Btn>
                  </div>
                ) : (
                  <Btn
                    size="md"
                    variant="ghost"
                    icon="add"
                    onClick={() => onOpenTableForOrder(label)}
                    className="w-full"
                  >
                    Start Table Order
                  </Btn>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── 2. Kitchen Display System (KDS) & Recent Cashier Tickets ─

const NEXT_KITCHEN: Record<KitchenStatus, KitchenStatus> = {
  New: 'Cooking',
  Cooking: 'Ready',
  Ready: 'Served',
  Served: 'Served',
};

export function KitchenView({
  orders,
  tabs,
  onAdvanceOrderKitchen,
  onAdvanceTabKitchen,
  onSelectReceipt,
}: {
  orders: Order[];
  tabs: TableTab[];
  onAdvanceOrderKitchen: (order: Order, next: KitchenStatus) => void;
  onAdvanceTabKitchen: (tab: TableTab, next: KitchenStatus) => void;
  onSelectReceipt: (order: Order) => void;
}) {
  const [filter, setFilter] = useState<'ACTIVE' | 'ALL'>('ACTIVE');

  const activePaidOrders = orders
    .filter((o) => !o.deleted && o.status === 'paid')
    .filter((o) => (filter === 'ACTIVE' ? o.kitchenStatus !== 'Served' : true))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 24);

  const activeTabs = tabs.filter(
    (t) => !t.deleted && (filter === 'ACTIVE' ? t.kitchenStatus !== 'Served' : true)
  );

  return (
    <div className="space-y-6 pb-10">
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Kitchen Display System (KDS) &amp; Order Queue
            </h2>
            <p className="text-xs text-white/55">
              Tap the large status button on any ticket to advance it from New → Cooking → Ready → Served.
            </p>
          </div>
          <div className="flex gap-2">
            <Btn
              size="md"
              variant={filter === 'ACTIVE' ? 'primary' : 'ghost'}
              icon="local_fire_department"
              onClick={() => setFilter('ACTIVE')}
            >
              Active Queue ({activePaidOrders.length + activeTabs.length})
            </Btn>
            <Btn
              size="md"
              variant={filter === 'ALL' ? 'primary' : 'ghost'}
              icon="history"
              onClick={() => setFilter('ALL')}
            >
              Recent Served Tickets
            </Btn>
          </div>
        </div>

        {activePaidOrders.length === 0 && activeTabs.length === 0 ? (
          <div className="py-14 text-center text-white/40">
            <Icon name="check_circle" className="text-5xl text-emerald-400/50" />
            <p className="mt-2 text-base font-extrabold text-white">All kitchen tickets served!</p>
            <p className="text-xs">New orders punched at the register will appear here immediately.</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeTabs.map((t) => (
              <div
                key={t.id}
                className="glass-card flex flex-col justify-between rounded-[24px] border-amber-400/40 p-4"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-amber-500/20 px-2.5 py-1 text-xs font-extrabold text-amber-300">
                      OPEN TAB · {t.table}
                    </span>
                    <span className="text-xs font-bold text-white/55">{fmtTime(t.openedAt)}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-white">{t.customerName}</p>
                  <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 text-sm">
                    {t.items.map((ln) => (
                      <li key={ln.id} className="font-bold text-white">
                        <span className="text-orange-300">{ln.qty}x</span> {ln.title}
                        {ln.addons.length > 0 && (
                          <span className="block pl-4 text-xs font-normal text-white/55">
                            + {ln.addons.map((a) => a.name).join(', ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-2">
                  {t.kitchenStatus !== 'Served' ? (
                    <Btn
                      size="lg"
                      variant="primary"
                      icon="soup_kitchen"
                      onClick={() => onAdvanceTabKitchen(t, NEXT_KITCHEN[t.kitchenStatus])}
                      className="w-full"
                    >
                      Mark {NEXT_KITCHEN[t.kitchenStatus]} ({t.kitchenStatus})
                    </Btn>
                  ) : (
                    <span className="block rounded-xl bg-emerald-500/15 py-2.5 text-center text-xs font-extrabold text-emerald-300">
                      SERVED AT TABLE
                    </span>
                  )}
                </div>
              </div>
            ))}

            {activePaidOrders.map((o) => {
              const tone =
                o.kitchenStatus === 'New'
                  ? 'border-orange-400/50'
                  : o.kitchenStatus === 'Cooking'
                  ? 'border-amber-400/50'
                  : o.kitchenStatus === 'Ready'
                  ? 'border-emerald-400/60'
                  : 'border-white/10 opacity-75';

              return (
                <div
                  key={o.id}
                  className={cx('glass-card flex flex-col justify-between rounded-[24px] p-4', tone)}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-xl bg-orange-500 px-2.5 py-1 font-mono text-sm font-extrabold text-white">
                          #{String(o.queueNo).padStart(3, '0')}
                        </span>
                        <div>
                          <p className="text-xs font-extrabold text-white">
                            {o.orderType} · {o.table}
                          </p>
                          <p className="text-[11px] text-white/50">{o.receiptNo}</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1 text-xs font-extrabold text-white">
                        {o.kitchenStatus}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-white/55">
                      {fmtDateTime(o.createdAt)} · Guest: {o.customerName}
                    </p>

                    <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 text-sm">
                      {o.items.map((ln) => (
                        <li key={ln.id} className="font-bold text-white">
                          <span className="text-orange-300">{ln.qty}x</span> {ln.title}
                          {ln.addons.length > 0 && (
                            <span className="block pl-4 text-xs font-normal text-white/55">
                              + {ln.addons.map((a) => a.name).join(', ')}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 flex gap-2 pt-2">
                    {o.kitchenStatus !== 'Served' && (
                      <Btn
                        size="lg"
                        variant={o.kitchenStatus === 'Ready' ? 'success' : 'primary'}
                        icon="check_circle"
                        onClick={() => onAdvanceOrderKitchen(o, NEXT_KITCHEN[o.kitchenStatus])}
                        className="flex-1"
                      >
                        Mark {NEXT_KITCHEN[o.kitchenStatus]}
                      </Btn>
                    )}
                    <Btn
                      size="lg"
                      variant="ghost"
                      icon="print"
                      onClick={() => onSelectReceipt(o)}
                      title="Reprint Official Receipt"
                    >
                      Receipt
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 3. Admin Menu & Inventory Manager ────────────────────────

export function MenuManagerView({
  menuItems,
  onSaveItem,
  onDeleteItem,
}: {
  menuItems: MenuItem[];
  onSaveItem: (item: MenuItem) => void;
  onDeleteItem: (item: MenuItem) => void;
}) {
  const [catFilter, setCatFilter] = useState<'ALL' | CategoryId>('ALL');
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState('');

  const activeItems = menuItems
    .filter((m) => !m.deleted)
    .filter((m) => (catFilter === 'ALL' ? true : m.category === catFilter))
    .filter((m) =>
      search.trim() ? m.title.toLowerCase().includes(search.trim().toLowerCase()) : true
    );

  const startNew = () => {
    setEditing({
      id: uid('menu'),
      title: '',
      description: '',
      category: 'Silog & Rice',
      price: 129,
      stock: 50,
      image: IMAGE_PRESETS[0].src,
      available: true,
      popular: false,
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              Menu &amp; Stock Inventory Manager ({activeItems.length} dishes)
            </h2>
            <p className="text-xs text-white/55">
              Add new Filipino dishes, adjust Peso prices, restock servings, or toggle 86/Sold-Out status.
            </p>
          </div>
          <Btn size="lg" variant="success" icon="add_circle" onClick={startNew}>
            Add New Dish
          </Btn>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCatFilter('ALL')}
              className={cx(
                'h-11 rounded-xl border px-3.5 text-xs font-extrabold transition',
                catFilter === 'ALL' ? 'chip-active' : 'border-white/10 bg-white/[0.04] text-white/65'
              )}
            >
              All Categories
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCatFilter(c.id)}
                className={cx(
                  'h-11 rounded-xl border px-3.5 text-xs font-extrabold transition',
                  catFilter === c.id ? 'chip-active' : 'border-white/10 bg-white/[0.04] text-white/65'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            placeholder="Search menu item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input !h-11 !w-64 text-xs"
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {activeItems.map((item) => (
            <div
              key={item.id}
              className="glass-card flex items-center justify-between gap-3.5 rounded-2xl p-3.5"
            >
              <div className="flex items-center gap-3.5">
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-extrabold text-white">{item.title}</span>
                    {!item.available && (
                      <span className="rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] font-bold text-red-300">
                        UNAVAILABLE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50">{item.category}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-sm font-extrabold text-orange-300 tabular-nums">
                      {peso(item.price)}
                    </span>
                    <span
                      className={cx(
                        'text-xs font-bold tabular-nums',
                        item.stock <= 10 ? 'text-red-300' : 'text-emerald-300'
                      )}
                    >
                      Stock: {item.stock}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex gap-1.5">
                  <Btn
                    size="md"
                    variant="ghost"
                    onClick={() =>
                      onSaveItem({ ...item, stock: item.stock + 20, updatedAt: Date.now() })
                    }
                    title="Add +20 stock"
                    className="!px-2.5 text-xs"
                  >
                    +20
                  </Btn>
                  <Btn
                    size="md"
                    variant="soft"
                    icon="edit"
                    onClick={() => setEditing(item)}
                    className="!px-2.5"
                  />
                </div>
                <Btn
                  size="md"
                  variant="danger"
                  icon="delete"
                  onClick={() => onDeleteItem(item)}
                  className="!h-9 !px-2.5 text-xs"
                >
                  Delete
                </Btn>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.title ? `Edit Dish · ${editing.title}` : 'Add New Menu Dish'}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveItem({ ...editing, updatedAt: Date.now() });
              setEditing(null);
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Dish Name
              </label>
              <input
                type="text"
                required
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="input"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Category
                </label>
                <select
                  value={editing.category}
                  onChange={(e) =>
                    setEditing({ ...editing, category: e.target.value as CategoryId })
                  }
                  className="input"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#11141d] text-white">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Price (₱ PHP)
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={editing.price}
                  onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })}
                  className="input"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                  Stock Count
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editing.stock}
                  onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Description
              </label>
              <input
                type="text"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="input"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Food Photo Preset
              </label>
              <select
                value={editing.image}
                onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                className="input"
              >
                {IMAGE_PRESETS.map((p) => (
                  <option key={p.src} value={p.src} className="bg-[#11141d] text-white">
                    {p.label} ({p.src})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <input
                  type="checkbox"
                  checked={editing.available}
                  onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                  className="h-5 w-5 accent-orange-500"
                />
                Available for ordering
              </label>
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <input
                  type="checkbox"
                  checked={!!editing.popular}
                  onChange={(e) => setEditing({ ...editing, popular: e.target.checked })}
                  className="h-5 w-5 accent-orange-500"
                />
                Bestseller badge
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <Btn variant="ghost" size="lg" onClick={() => setEditing(null)}>
                Cancel
              </Btn>
              <Btn type="submit" variant="success" size="lg" icon="save">
                Save Dish
              </Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── 4. Admin Store & Staff Accounts Settings ─────────────────

export function SettingsView({
  settings,
  onSaveSettings,
  onResetDemoData,
}: {
  settings: Settings;
  onSaveSettings: (s: Settings) => void;
  onResetDemoData: () => void;
}) {
  const [form, setForm] = useState<Settings>(settings);
  const [savedBanner, setSavedBanner] = useState(false);
  const [newAccUser, setNewAccUser] = useState('');
  const [newAccPass, setNewAccPass] = useState('');
  const [newAccName, setNewAccName] = useState('');
  const [newAccRole, setNewAccRole] = useState<Role>('cashier');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({ ...form, updatedAt: Date.now() });
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  const addAccount = () => {
    if (!newAccUser.trim() || !newAccPass.trim()) return;
    const next: Account = {
      username: newAccUser.trim().toLowerCase(),
      password: newAccPass,
      name: newAccName.trim() || newAccUser.trim(),
      role: newAccRole,
    };
    const updated = {
      ...form,
      accounts: [...form.accounts.filter((a) => a.username !== next.username), next],
      updatedAt: Date.now(),
    };
    setForm(updated);
    onSaveSettings(updated);
    setNewAccUser('');
    setNewAccPass('');
    setNewAccName('');
  };

  return (
    <div className="grid gap-6 pb-10 lg:grid-cols-12">
      <form
        onSubmit={handleSubmit}
        className="glass space-y-4 rounded-[28px] p-5 sm:p-6 lg:col-span-7"
      >
        <h2 className="text-xl font-extrabold text-white">
          Restaurant Profile &amp; Receipt Configuration
        </h2>
        <p className="text-xs text-white/55">
          Printed on all 80mm Official Receipts, Z-Readings, and synced across all LAN tablets.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              Restaurant Name
            </label>
            <input
              type="text"
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              Store Address
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              BIR TIN Header
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
                VAT Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={form.vatRate}
                onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
                className="input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-white/60">
                Dining Tables
              </label>
              <input
                type="number"
                min="1"
                max="40"
                value={form.tableCount}
                onChange={(e) => setForm({ ...form, tableCount: Number(e.target.value) })}
                className="input"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-white/60">
            Official Receipt Footer Message
          </label>
          <input
            type="text"
            value={form.receiptFooter}
            onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
            className="input"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Btn type="submit" size="lg" variant="success" icon="save">
            Save Store Settings
          </Btn>
          {savedBanner && (
            <span className="text-xs font-extrabold text-emerald-300">
              ✓ Settings saved &amp; synced across LAN!
            </span>
          )}
        </div>
      </form>

      {/* Staff Login Accounts & Database Backup */}
      <div className="space-y-6 lg:col-span-5">
        <div className="glass rounded-[28px] p-5 sm:p-6">
          <h3 className="text-lg font-extrabold text-white">
            POS Login Accounts (Admin &amp; Cashier)
          </h3>
          <p className="text-xs text-white/55">
            Admin has full control over sales calendar &amp; settings; Cashier sees only POS register, tables &amp; kitchen.
          </p>

          <div className="mt-4 space-y-2">
            {form.accounts.map((acc) => (
              <div
                key={acc.username}
                className="glass-card flex items-center justify-between rounded-2xl px-4 py-3"
              >
                <div>
                  <p className="text-sm font-extrabold text-white">
                    {acc.name}{' '}
                    <span className="font-mono text-xs text-orange-300">
                      ({acc.username} / {acc.password})
                    </span>
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-white/50">
                    Role: {acc.role}
                  </p>
                </div>
                <span
                  className={cx(
                    'rounded-full px-3 py-1 text-xs font-extrabold uppercase',
                    acc.role === 'admin'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-orange-500/20 text-orange-300'
                  )}
                >
                  {acc.role}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-bold uppercase text-white/55">
              Add / Update Staff Account
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Username"
                value={newAccUser}
                onChange={(e) => setNewAccUser(e.target.value)}
                className="input !h-11 text-xs"
              />
              <input
                type="text"
                placeholder="Password"
                value={newAccPass}
                onChange={(e) => setNewAccPass(e.target.value)}
                className="input !h-11 text-xs"
              />
              <input
                type="text"
                placeholder="Staff Display Name"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
                className="input !h-11 text-xs"
              />
              <select
                value={newAccRole}
                onChange={(e) => setNewAccRole(e.target.value as Role)}
                className="input !h-11 text-xs"
              >
                <option value="cashier" className="bg-[#11141d]">
                  Cashier
                </option>
                <option value="admin" className="bg-[#11141d]">
                  Admin
                </option>
              </select>
            </div>
            <Btn
              size="md"
              variant="primary"
              icon="person_add"
              onClick={addAccount}
              className="mt-2.5 w-full"
            >
              Save Staff Account
            </Btn>
          </div>
        </div>

        <div className="glass rounded-[28px] p-5 sm:p-6">
          <h3 className="text-base font-extrabold text-white">Database &amp; Demo History</h3>
          <p className="mt-1 text-xs text-white/55">
            Regenerate the 45-day Ligaya Kusina Express sales history and restore default Philippine menu items.
          </p>
          <Btn
            size="md"
            variant="danger"
            icon="restart_alt"
            onClick={onResetDemoData}
            className="mt-3 w-full"
          >
            Reset &amp; Reseed 45-Day Demo Database
          </Btn>
        </div>
      </div>
    </div>
  );
}
