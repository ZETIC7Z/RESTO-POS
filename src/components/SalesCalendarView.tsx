import { useMemo, useState } from 'react';
import {
  addDays,
  dayKey,
  fmtDateTime,
  fmtDayLong,
  fmtMonth,
  fmtTime,
  manilaHour,
  OrderRow,
  PaymentMethod,
  PAYMENT_METHODS,
  peso,
  pesoCompact,
  Product,
  Profile,
  StoreSettings,
  weekdayOf,
} from '../data/posData';
import { supabase } from '../lib/supabase';
import { OrderEditorModal } from './OrderEditorModal';
import { ReceiptModal, ZReadingModal } from './ReceiptModal';
import { Btn, cx, downloadCsv, Icon, Stat } from './ui';

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

export function SalesCalendarView({
  orders,
  products,
  settings,
  adminProfile,
  onRefresh,
}: {
  orders: OrderRow[];
  products: Product[];
  settings: StoreSettings;
  adminProfile: Profile;
  onRefresh: () => Promise<void>;
}) {
  const todayKey = dayKey(Date.now());
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [monthCursor, setMonthCursor] = useState<string>(`${todayKey.slice(0, 7)}-01`);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentMethod>('ALL');

  const [receiptOrder, setReceiptOrder] = useState<OrderRow | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderRow | null>(null);
  const [showZReading, setShowZReading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<
      string,
      {
        orders: OrderRow[];
        validOrders: OrderRow[];
        cancelledOrders: OrderRow[];
        gross: number;
        netSales: number;
        vat: number;
        discount: number;
        itemsCount: number;
      }
    >();

    const ensure = (k: string) => {
      let entry = map.get(k);
      if (!entry) {
        entry = {
          orders: [],
          validOrders: [],
          cancelledOrders: [],
          gross: 0,
          netSales: 0,
          vat: 0,
          discount: 0,
          itemsCount: 0,
        };
        map.set(k, entry);
      }
      return entry;
    };

    for (const o of orders) {
      const k = o.order_date || dayKey(o.created_at);
      const bucket = ensure(k);
      bucket.orders.push(o);
      if (o.status !== 'cancelled') {
        bucket.validOrders.push(o);
        const total = Number(o.total_amount) || 0;
        const vat = Number(o.vat_amount) || 0;
        bucket.gross += total;
        bucket.netSales += total - vat;
        bucket.vat += vat;
        bucket.discount += Number(o.discount_amount) || 0;
        const lineQty =
          o.order_items && o.order_items.length > 0
            ? o.order_items.reduce((s, i) => s + Number(i.quantity), 0)
            : (o.receipt_snapshot?.items || []).reduce((s, i) => s + Number(i.quantity), 0);
        bucket.itemsCount += lineQty;
      } else {
        bucket.cancelledOrders.push(o);
      }
    }

    return map;
  }, [orders]);

  const monthCells = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const ymPrefix = monthCursor.slice(0, 7);

  const monthSummary = useMemo(() => {
    let gross = 0;
    let netSales = 0;
    let vat = 0;
    let discount = 0;
    let orderCount = 0;
    let activeDays = 0;

    byDay.forEach((v, k) => {
      if (k.startsWith(ymPrefix)) {
        gross += v.gross;
        netSales += v.netSales;
        vat += v.vat;
        discount += v.discount;
        orderCount += v.validOrders.length;
        if (v.validOrders.length > 0) activeDays += 1;
      }
    });

    return { gross, netSales, vat, discount, orderCount, activeDays };
  }, [byDay, ymPrefix]);

  const dayData = byDay.get(selectedDate) ?? {
    orders: [],
    validOrders: [],
    cancelledOrders: [],
    gross: 0,
    netSales: 0,
    vat: 0,
    discount: 0,
    itemsCount: 0,
  };

  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, sales: 0, orders: 0 }));
    for (const o of dayData.validOrders) {
      const h = manilaHour(o.created_at);
      buckets[h].sales += Number(o.total_amount) || 0;
      buckets[h].orders += 1;
    }
    return buckets.slice(7, 22);
  }, [dayData.validOrders]);

  const maxHourlySales = Math.max(1, ...hourly.map((b) => b.sales));

  const paymentBreakdown = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {
      Cash: { total: 0, count: 0 },
      GCash: { total: 0, count: 0 },
      Maya: { total: 0, count: 0 },
      Card: { total: 0, count: 0 },
    };
    for (const o of dayData.validOrders) {
      if (!map[o.payment_method]) map[o.payment_method] = { total: 0, count: 0 };
      map[o.payment_method].total += Number(o.total_amount) || 0;
      map[o.payment_method].count += 1;
    }
    return map;
  }, [dayData.validOrders]);

  const filteredDayOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...dayData.orders]
      .filter((o) => (paymentFilter === 'ALL' ? true : o.payment_method === paymentFilter))
      .filter((o) => {
        if (!q) return true;
        const itemText =
          o.order_items && o.order_items.length > 0
            ? o.order_items.map((i) => i.product_name).join(' ')
            : (o.receipt_snapshot?.items || []).map((i) => i.product_name).join(' ');
        return (
          o.or_number.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.cashier_name.toLowerCase().includes(q) ||
          itemText.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [dayData.orders, paymentFilter, searchQuery]);

  const handleSelectDate = (key: string) => {
    setSelectedDate(key);
    setConfirmDeleteId(null);
    if (key.slice(0, 7) !== monthCursor.slice(0, 7)) {
      setMonthCursor(`${key.slice(0, 7)}-01`);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setBusyId(orderId);
    try {
      const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
      if (error) throw error;
      await onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to cancel order.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteOrder = async (order: OrderRow) => {
    setBusyId(order.id);
    try {
      if (order.status !== 'cancelled') {
        const { error: cancelErr } = await supabase.rpc('cancel_order', {
          p_order_id: order.id,
        });
        if (cancelErr) throw cancelErr;
      }
      const { error: delErr } = await supabase.from('orders').delete().eq('id', order.id);
      if (delErr) throw delErr;
      setConfirmDeleteId(null);
      await onRefresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete order.');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportDayCsv = () => {
    const rows: (string | number)[][] = [
      [
        'OR Number',
        'Queue #',
        'Date & Time (Asia/Manila)',
        'Status',
        'Customer',
        'Cashier',
        'Payment Method',
        'Discount Type',
        'Items',
        'Discount (PHP)',
        'VATable Sales (PHP)',
        '12% VAT (PHP)',
        'Total Amount (PHP)',
      ],
      ...dayData.orders.map((o) => {
        const itemsText =
          o.order_items && o.order_items.length > 0
            ? o.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join('; ')
            : (o.receipt_snapshot?.items || [])
                .map((i) => `${i.quantity}x ${i.product_name}`)
                .join('; ');
        return [
          o.or_number,
          o.order_number,
          fmtDateTime(o.created_at),
          o.status.toUpperCase(),
          o.customer_name,
          o.cashier_name,
          o.payment_method,
          o.discount_type,
          itemsText,
          Number(o.discount_amount).toFixed(2),
          Number(o.vatable_sales).toFixed(2),
          Number(o.vat_amount).toFixed(2),
          Number(o.total_amount).toFixed(2),
        ];
      }),
    ];
    downloadCsv(`el-farm-cafe-sales-${selectedDate}.csv`, rows);
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header & Month Rollup */}
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">
              <Icon name="cloud_done" className="text-[14px]" />
              Live Supabase Sales Calendar &amp; Order Manager
            </span>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white">
              Sales Calendar &amp; Order Ledger
            </h2>
            <p className="text-xs text-white/55">
              Tap any date to inspect total orders, edit submitted receipts, void/restore stock, or print Z-Reading.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Btn size="md" variant="ghost" icon="today" onClick={() => handleSelectDate(todayKey)}>
              Today ({todayKey})
            </Btn>
            <Btn
              size="md"
              variant="soft"
              icon="receipt_long"
              onClick={() => setShowZReading(true)}
            >
              Print Day Z-Reading
            </Btn>
            <Btn size="md" variant="primary" icon="download" onClick={handleExportDayCsv}>
              Export {selectedDate} CSV
            </Btn>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass-card rounded-2xl p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {fmtMonth(monthCursor)} Gross Sales
            </p>
            <p className="mt-1 text-lg font-extrabold text-emerald-300 tabular-nums">
              {peso(monthSummary.gross)}
            </p>
            <p className="text-[11px] text-white/40">
              Across {monthSummary.activeDays} active days
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {fmtMonth(monthCursor)} Valid Orders
            </p>
            <p className="mt-1 text-lg font-extrabold text-white tabular-nums">
              {monthSummary.orderCount.toLocaleString()} orders
            </p>
            <p className="text-[11px] text-white/40">Live synced from cloud POS</p>
          </div>
          <div className="glass-card rounded-2xl p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {fmtMonth(monthCursor)} Net (ex-VAT)
            </p>
            <p className="mt-1 text-lg font-extrabold text-sky-300 tabular-nums">
              {peso(monthSummary.netSales)}
            </p>
            <p className="text-[11px] text-white/40">12% VAT: {peso(monthSummary.vat)}</p>
          </div>
          <div className="glass-card rounded-2xl p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {fmtMonth(monthCursor)} Discounts
            </p>
            <p className="mt-1 text-lg font-extrabold text-amber-300 tabular-nums">
              {peso(monthSummary.discount)}
            </p>
            <p className="text-[11px] text-white/40">Senior/PWD &amp; promos</p>
          </div>
        </div>
      </div>

      {/* Calendar + Selected Date Metrics */}
      <div className="grid gap-6 xl:grid-cols-12">
        <div className="glass rounded-[28px] p-5 sm:p-6 xl:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Btn
                size="md"
                variant="ghost"
                icon="chevron_left"
                onClick={() => setMonthCursor((c) => shiftMonth(c, -1))}
              />
              <h3 className="min-w-[180px] text-center text-lg font-extrabold text-white">
                {fmtMonth(monthCursor)}
              </h3>
              <Btn
                size="md"
                variant="ghost"
                icon="chevron_right"
                onClick={() => setMonthCursor((c) => shiftMonth(c, 1))}
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sales-date-picker" className="text-xs font-bold text-white/55">
                Pick Date:
              </label>
              <input
                id="sales-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && handleSelectDate(e.target.value)}
                className="input !h-11 !w-auto px-3 text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-white/45">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {monthCells.map((cell) => {
              const info = byDay.get(cell.key);
              const count = info?.validOrders.length ?? 0;
              const gross = info?.gross ?? 0;
              const isSelected = cell.key === selectedDate;
              const isToday = cell.key === todayKey;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => handleSelectDate(cell.key)}
                  className={cx(
                    'flex min-h-[76px] flex-col justify-between rounded-2xl border p-2 text-left transition active:scale-[0.97] sm:min-h-[86px] sm:p-2.5',
                    !cell.inMonth && 'opacity-35',
                    isSelected
                      ? 'border-orange-400 bg-gradient-to-b from-orange-500/30 to-orange-600/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_26px_-10px_rgba(255,96,32,0.85)]'
                      : count > 0
                      ? 'border-white/12 bg-white/[0.05] hover:border-emerald-400/40 hover:bg-white/[0.09]'
                      : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cx(
                        'inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-extrabold',
                        isSelected
                          ? 'bg-orange-500 text-white'
                          : isToday
                          ? 'border border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                          : 'text-white/80'
                      )}
                    >
                      {cell.dayNum}
                    </span>
                    {count > 0 && (
                      <span
                        className={cx(
                          'rounded-md px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums',
                          isSelected
                            ? 'bg-black/40 text-orange-200'
                            : 'bg-emerald-500/15 text-emerald-300'
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    {gross > 0 ? (
                      <p
                        className={cx(
                          'truncate text-xs font-extrabold tabular-nums sm:text-[13px]',
                          isSelected ? 'text-white' : 'text-emerald-300'
                        )}
                      >
                        {pesoCompact(gross)}
                      </p>
                    ) : (
                      <p className="text-[10px] text-white/25">—</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Stats + Payments + Hourly */}
        <div className="flex flex-col gap-6 xl:col-span-5">
          <div className="glass rounded-[28px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-300">
                  Selected Date Breakdown
                </p>
                <h3 className="mt-0.5 text-xl font-extrabold text-white">
                  {fmtDayLong(selectedDate)}
                </h3>
                <p className="text-xs text-white/50">
                  Date Key: <span className="font-mono text-white/80">{selectedDate}</span>
                </p>
              </div>
              <span className="rounded-2xl border border-orange-400/30 bg-orange-500/15 px-3.5 py-1.5 text-sm font-extrabold text-orange-200 tabular-nums">
                {dayData.validOrders.length} Valid Orders
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat
                label="Total Orders"
                value={`${dayData.validOrders.length}`}
                sub={`${dayData.itemsCount} dishes · ${dayData.cancelledOrders.length} cancelled`}
                tone="text-orange-300"
                icon="shopping_bag"
              />
              <Stat
                label="Gross Income"
                value={peso(dayData.gross)}
                sub={`Avg ${peso(
                  dayData.validOrders.length ? dayData.gross / dayData.validOrders.length : 0
                )}`}
                tone="text-emerald-300"
                icon="payments"
              />
              <Stat
                label="Net Sales (ex-VAT)"
                value={peso(dayData.netSales)}
                sub={`12% VAT: ${peso(dayData.vat)}`}
                tone="text-white"
                icon="account_balance"
              />
              <Stat
                label="Discounts"
                value={peso(dayData.discount)}
                sub="SC/PWD & promo"
                tone="text-amber-300"
                icon="sell"
              />
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-white/50">
                Payment Channels ({selectedDate})
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {PAYMENT_METHODS.map((pm) => {
                  const stat = paymentBreakdown[pm.id] ?? { total: 0, count: 0 };
                  return (
                    <div key={pm.id} className="glass-card rounded-xl p-2.5">
                      <div className="flex items-center justify-between text-xs text-white/60">
                        <span className="font-bold text-white">{pm.id}</span>
                        <span>{stat.count}x</span>
                      </div>
                      <p className="mt-1 text-sm font-extrabold text-emerald-300 tabular-nums">
                        {peso(stat.total)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-white/50">
                  Hourly Sales Activity (7 AM – 9 PM)
                </p>
                <span className="text-[11px] text-white/40">Manila Time (UTC+8)</span>
              </div>
              <div className="flex h-28 items-end gap-1.5 pt-2">
                {hourly.map((b) => {
                  const pct = Math.max(6, Math.round((b.sales / maxHourlySales) * 100));
                  const label =
                    b.hour === 12
                      ? '12p'
                      : b.hour > 12
                      ? `${b.hour - 12}p`
                      : `${b.hour}a`;
                  return (
                    <div
                      key={b.hour}
                      title={`${label}: ${b.orders} orders · ${peso(b.sales)}`}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div className="flex h-20 w-full items-end rounded-lg bg-white/[0.04] p-0.5">
                        <div
                          style={{ height: `${b.sales > 0 ? pct : 4}%` }}
                          className={cx(
                            'w-full rounded-md transition-all',
                            b.sales > 0
                              ? 'bg-gradient-to-t from-orange-500 to-amber-300'
                              : 'bg-white/10'
                          )}
                        />
                      </div>
                      <span className="text-[9px] font-bold text-white/45">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Itemized Order List for Selected Date */}
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              Orders on {fmtDayLong(selectedDate)} ({filteredDayOrders.length})
            </h3>
            <p className="text-xs text-white/50">
              Reprint 80mm receipt, edit submitted items, cancel (restore stock), or delete orders directly in Supabase.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Search OR#, customer, dish, cashier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input !h-11 !w-64 text-xs"
            />
            <div className="flex rounded-2xl border border-white/10 bg-white/[0.04] p-1">
              {(['ALL', 'Cash', 'GCash', 'Maya', 'Card'] as const).map((pm) => (
                <button
                  key={pm}
                  type="button"
                  onClick={() => setPaymentFilter(pm)}
                  className={cx(
                    'rounded-xl px-3 py-1.5 text-xs font-bold transition',
                    paymentFilter === pm
                      ? 'bg-orange-500 text-white'
                      : 'text-white/60 hover:text-white'
                  )}
                >
                  {pm}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredDayOrders.length === 0 ? (
          <div className="py-12 text-center text-white/45">
            <Icon name="receipt_long" className="text-4xl text-white/25" />
            <p className="mt-2 text-sm font-bold">No orders recorded on {selectedDate}.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">
                  <th className="px-3 py-2">OR / Queue</th>
                  <th className="px-3 py-2">Timestamp</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">Cashier</th>
                  <th className="px-3 py-2">Status / Pay</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDayOrders.map((o) => {
                  const isCancelled = o.status === 'cancelled';
                  const items =
                    o.order_items && o.order_items.length > 0
                      ? o.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')
                      : (o.receipt_snapshot?.items || [])
                          .map((i) => `${i.quantity}x ${i.product_name}`)
                          .join(', ');

                  return (
                    <tr
                      key={o.id}
                      className={cx(
                        'glass-card rounded-2xl transition',
                        isCancelled && 'opacity-55'
                      )}
                    >
                      <td className="rounded-l-2xl px-3 py-3 font-mono text-xs font-bold">
                        <span className="text-orange-300">{o.or_number}</span>
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/75">
                          #{String(o.order_number).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className="font-bold text-white">{fmtTime(o.created_at)}</p>
                        <p className="font-mono text-[11px] text-white/45">{o.order_date}</p>
                      </td>
                      <td className="px-3 py-3 text-xs font-bold text-white">
                        {o.customer_name}
                      </td>
                      <td className="max-w-xs px-3 py-3 text-xs text-white/80">
                        <p className="line-clamp-2">{items}</p>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-white/75">
                        {o.cashier_name}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-lg border border-white/15 bg-white/[0.06] px-2 py-0.5 font-bold text-white">
                            {o.payment_method}
                          </span>
                          <span
                            className={cx(
                              'rounded-lg px-2 py-0.5 font-extrabold uppercase',
                              isCancelled
                                ? 'bg-red-500/25 text-red-300'
                                : o.status === 'ready'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-white/10 text-white/70'
                            )}
                          >
                            {o.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-extrabold tabular-nums">
                        <span
                          className={isCancelled ? 'line-through text-red-300' : 'text-emerald-300'}
                        >
                          {peso(o.total_amount)}
                        </span>
                      </td>
                      <td className="rounded-r-2xl px-3 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <Btn
                            size="md"
                            variant="ghost"
                            icon="print"
                            onClick={() => setReceiptOrder(o)}
                            className="!h-10 !px-2.5 text-xs"
                          >
                            Receipt
                          </Btn>
                          {!isCancelled && (
                            <>
                              <Btn
                                size="md"
                                variant="soft"
                                icon="edit"
                                onClick={() => setEditingOrder(o)}
                                className="!h-10 !px-2.5 text-xs"
                              >
                                Edit
                              </Btn>
                              <Btn
                                size="md"
                                variant="ghost"
                                icon="cancel"
                                disabled={busyId === o.id}
                                onClick={() => void handleCancelOrder(o.id)}
                                className="!h-10 !px-2.5 text-xs text-amber-300"
                              >
                                Cancel
                              </Btn>
                            </>
                          )}
                          {confirmDeleteId === o.id ? (
                            <Btn
                              size="md"
                              variant="danger"
                              icon="delete_forever"
                              disabled={busyId === o.id}
                              onClick={() => void handleDeleteOrder(o)}
                              className="!h-10 !px-2.5 text-xs"
                            >
                              Confirm Delete
                            </Btn>
                          ) : (
                            <Btn
                              size="md"
                              variant="danger"
                              icon="delete"
                              onClick={() => setConfirmDeleteId(o.id)}
                              className="!h-10 !px-2.5 text-xs"
                            >
                              Delete
                            </Btn>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          settings={settings}
          onClose={() => setReceiptOrder(null)}
        />
      )}

      {editingOrder && (
        <OrderEditorModal
          order={editingOrder}
          products={products}
          onClose={() => setEditingOrder(null)}
          onSaved={onRefresh}
        />
      )}

      {showZReading && (
        <ZReadingModal
          dateKey={selectedDate}
          orders={dayData.orders}
          settings={settings}
          printedBy={adminProfile.full_name}
          onClose={() => setShowZReading(false)}
        />
      )}
    </div>
  );
}
