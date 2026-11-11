import React, { useMemo, useState } from 'react';
import {
  addDays,
  dayKey,
  dayStart,
  Expense,
  ExpenseCategory,
  EXPENSE_CATEGORIES,
  fmtDateTime,
  fmtDayLong,
  fmtMonth,
  fmtTime,
  manilaHour,
  Order,
  PaymentMethod,
  PAYMENT_METHODS,
  peso,
  pesoCompact,
  Session,
  Settings,
  uid,
  weekdayOf,
} from '../data/posData';
import { ZReadingModal } from './ReceiptModal';
import { Btn, cx, downloadCsv, Icon, Modal, Stat } from './ui';

function buildMonthGrid(monthCursor: string): { key: string; inMonth: boolean; dayNum: number }[] {
  // monthCursor is YYYY-MM-01
  const ym = monthCursor.slice(0, 7);
  const firstDayKey = `${ym}-01`;
  const startDow = weekdayOf(firstDayKey); // 0 = Sun .. 6 = Sat
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
  expenses,
  settings,
  session,
  onSelectReceipt,
  onUpdateOrder,
  onAddExpense,
  onDeleteExpense,
}: {
  orders: Order[];
  expenses: Expense[];
  settings: Settings;
  session: Session;
  onSelectReceipt: (o: Order) => void;
  onUpdateOrder: (updated: Order) => void;
  onAddExpense: (exp: Expense) => void;
  onDeleteExpense: (exp: Expense) => void;
}) {
  const todayKey = dayKey(Date.now());
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [monthCursor, setMonthCursor] = useState<string>(`${todayKey.slice(0, 7)}-01`);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [showZReading, setShowZReading] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Expense form state
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Ingredients');
  const [expAmount, setExpAmount] = useState('');

  // Group all orders & expenses by YYYY-MM-DD (Asia/Manila)
  const byDay = useMemo(() => {
    const map = new Map<
      string,
      {
        orders: Order[];
        paidOrders: Order[];
        voidOrders: Order[];
        expenses: Expense[];
        gross: number;
        netSales: number;
        vat: number;
        discount: number;
        expenseTotal: number;
        itemsCount: number;
      }
    >();

    const ensure = (k: string) => {
      let entry = map.get(k);
      if (!entry) {
        entry = {
          orders: [],
          paidOrders: [],
          voidOrders: [],
          expenses: [],
          gross: 0,
          netSales: 0,
          vat: 0,
          discount: 0,
          expenseTotal: 0,
          itemsCount: 0,
        };
        map.set(k, entry);
      }
      return entry;
    };

    for (const o of orders) {
      if (o.deleted) continue;
      const k = dayKey(o.createdAt);
      const bucket = ensure(k);
      bucket.orders.push(o);
      if (o.status === 'paid') {
        bucket.paidOrders.push(o);
        bucket.gross += o.total;
        bucket.netSales += o.total - o.vat;
        bucket.vat += o.vat;
        bucket.discount += o.discount + o.lessVat;
        bucket.itemsCount += o.items.reduce((s, i) => s + i.qty, 0);
      } else {
        bucket.voidOrders.push(o);
      }
    }

    for (const ex of expenses) {
      if (ex.deleted) continue;
      const k = dayKey(ex.createdAt);
      const bucket = ensure(k);
      bucket.expenses.push(ex);
      bucket.expenseTotal += ex.amount;
    }

    return map;
  }, [orders, expenses]);

  const monthCells = useMemo(() => buildMonthGrid(monthCursor), [monthCursor]);
  const ymPrefix = monthCursor.slice(0, 7);

  // Month-to-Date totals for currently viewed calendar month
  const monthSummary = useMemo(() => {
    let gross = 0;
    let netSales = 0;
    let vat = 0;
    let exp = 0;
    let orderCount = 0;
    let activeDays = 0;
    byDay.forEach((v, k) => {
      if (k.startsWith(ymPrefix)) {
        gross += v.gross;
        netSales += v.netSales;
        vat += v.vat;
        exp += v.expenseTotal;
        orderCount += v.paidOrders.length;
        if (v.paidOrders.length > 0) activeDays += 1;
      }
    });
    return {
      gross,
      netSales,
      vat,
      exp,
      profit: netSales - exp,
      orderCount,
      activeDays,
    };
  }, [byDay, ymPrefix]);

  // Selected Day data
  const dayData = byDay.get(selectedDate) ?? {
    orders: [],
    paidOrders: [],
    voidOrders: [],
    expenses: [],
    gross: 0,
    netSales: 0,
    vat: 0,
    discount: 0,
    expenseTotal: 0,
    itemsCount: 0,
  };

  const dayNetProfit = dayData.netSales - dayData.expenseTotal;

  // Hourly breakdown for selected day (6 AM to 10 PM)
  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      sales: 0,
      orders: 0,
    }));
    for (const o of dayData.paidOrders) {
      const h = manilaHour(o.createdAt);
      buckets[h].sales += o.total;
      buckets[h].orders += 1;
    }
    return buckets.slice(7, 22); // 7am - 9pm restaurant operating window
  }, [dayData.paidOrders]);

  const maxHourlySales = Math.max(1, ...hourly.map((b) => b.sales));

  // Payment method breakdown for selected day
  const paymentBreakdown = useMemo(() => {
    const map: Record<PaymentMethod, { total: number; count: number }> = {
      Cash: { total: 0, count: 0 },
      GCash: { total: 0, count: 0 },
      Maya: { total: 0, count: 0 },
      Card: { total: 0, count: 0 },
    };
    for (const o of dayData.paidOrders) {
      map[o.payment].total += o.total;
      map[o.payment].count += 1;
    }
    return map;
  }, [dayData.paidOrders]);

  // Top dishes sold on selected day
  const topDishes = useMemo(() => {
    const map = new Map<string, { title: string; image: string; qty: number; revenue: number }>();
    for (const o of dayData.paidOrders) {
      for (const ln of o.items) {
        const addonSum = ln.addons.reduce((s, a) => s + a.price, 0);
        const rev = (ln.price + addonSum) * ln.qty;
        const cur = map.get(ln.menuId) ?? {
          title: ln.title,
          image: ln.image,
          qty: 0,
          revenue: 0,
        };
        cur.qty += ln.qty;
        cur.revenue += rev;
        map.set(ln.menuId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  }, [dayData.paidOrders]);

  // Filtered timestamped orders for the selected day
  const filteredDayOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...dayData.orders]
      .filter((o) => (paymentFilter === 'ALL' ? true : o.payment === paymentFilter))
      .filter((o) => {
        if (!q) return true;
        return (
          o.receiptNo.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.cashier.toLowerCase().includes(q) ||
          o.table.toLowerCase().includes(q) ||
          o.items.some((i) => i.title.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [dayData.orders, paymentFilter, searchQuery]);

  const handleSelectDate = (key: string) => {
    setSelectedDate(key);
    if (key.slice(0, 7) !== monthCursor.slice(0, 7)) {
      setMonthCursor(`${key.slice(0, 7)}-01`);
    }
  };

  const handleExportDayCsv = () => {
    const rows: (string | number)[][] = [
      [
        'Receipt No',
        'Queue No',
        'Date & Time (Asia/Manila)',
        'Status',
        'Order Type',
        'Table',
        'Customer',
        'Cashier',
        'Payment Method',
        'Items',
        'Subtotal (PHP)',
        'Discount (PHP)',
        'VATable Sales (PHP)',
        '12% VAT (PHP)',
        'Total Collected (PHP)',
      ],
      ...dayData.orders.map((o) => [
        o.receiptNo,
        o.queueNo,
        fmtDateTime(o.createdAt),
        o.status.toUpperCase(),
        o.orderType,
        o.table,
        o.customerName,
        o.cashier,
        o.payment,
        o.items.map((i) => `${i.qty}x ${i.title}`).join('; '),
        o.subTotal.toFixed(2),
        (o.discount + o.lessVat).toFixed(2),
        o.vatableSales.toFixed(2),
        o.vat.toFixed(2),
        o.total.toFixed(2),
      ]),
    ];
    downloadCsv(`ligaya-kusina-sales-${selectedDate}.csv`, rows);
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount);
    if (!expTitle.trim() || !Number.isFinite(amt) || amt <= 0) return;
    // Stamp expense on the selectedDate (at noon Manila time if past day, or now if today)
    const createdAt =
      selectedDate === todayKey ? Date.now() : dayStart(selectedDate) + 12 * 3_600_000;
    onAddExpense({
      id: uid('exp'),
      title: expTitle.trim(),
      category: expCategory,
      amount: amt,
      createdAt,
      updatedAt: Date.now(),
      recordedBy: session.name,
    });
    setExpTitle('');
    setExpAmount('');
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Top Banner: Month Summary + Quick Date Actions */}
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-300">
              <Icon name="verified_user" className="text-[14px]" />
              Admin Transparent Income & Calendar Ledger
            </span>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white">
              Sales Calendar & Daily Order Inspector
            </h2>
            <p className="text-xs text-white/55">
              Tap any date on the calendar below to inspect that day&apos;s total orders, timestamps, VAT, expenses, and receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Btn
              size="md"
              variant="ghost"
              icon="today"
              onClick={() => handleSelectDate(todayKey)}
            >
              Jump to Today ({todayKey})
            </Btn>
            <Btn
              size="md"
              variant="soft"
              icon="receipt_long"
              onClick={() => setShowZReading(true)}
            >
              Print Day Z-Reading
            </Btn>
            <Btn
              size="md"
              variant="primary"
              icon="download"
              onClick={handleExportDayCsv}
            >
              Export {selectedDate} CSV
            </Btn>
          </div>
        </div>

        {/* Monthly Rollup Bar */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="glass-card rounded-2xl p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {fmtMonth(monthCursor)} Gross Sales
            </p>
            <p className="mt-1 text-lg font-extrabold text-emerald-300 tabular-nums">
              {peso(monthSummary.gross)}
            </p>
            <p className="text-[11px] text-white/40">
              Across {monthSummary.activeDays} active operating days
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {fmtMonth(monthCursor)} Total Orders
            </p>
            <p className="mt-1 text-lg font-extrabold text-white tabular-nums">
              {monthSummary.orderCount.toLocaleString()} orders
            </p>
            <p className="text-[11px] text-white/40">
              12% VAT collected: {peso(monthSummary.vat)}
            </p>
          </div>
          <div className="glass-card rounded-2xl p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {fmtMonth(monthCursor)} Expenses
            </p>
            <p className="mt-1 text-lg font-extrabold text-orange-300 tabular-nums">
              {peso(monthSummary.exp)}
            </p>
            <p className="text-[11px] text-white/40">Ingredients, utilities & staff</p>
          </div>
          <div className="glass-card rounded-2xl p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/45">
              {fmtMonth(monthCursor)} Net Profit
            </p>
            <p className="mt-1 text-lg font-extrabold text-sky-300 tabular-nums">
              {peso(monthSummary.profit)}
            </p>
            <p className="text-[11px] text-white/40">Net ex-VAT minus expenses</p>
          </div>
        </div>
      </div>

      {/* Main Split: Interactive Monthly Calendar (Left) + Selected Day KPIs & Hourly/Payment (Right) */}
      <div className="grid gap-6 xl:grid-cols-12">
        {/* Interactive Calendar Card */}
        <div className="glass rounded-[28px] p-5 sm:p-6 xl:col-span-7">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Btn
                size="md"
                variant="ghost"
                icon="chevron_left"
                aria-label="Previous month"
                onClick={() => setMonthCursor((c) => shiftMonth(c, -1))}
              />
              <h3 className="min-w-[180px] text-center text-lg font-extrabold text-white">
                {fmtMonth(monthCursor)}
              </h3>
              <Btn
                size="md"
                variant="ghost"
                icon="chevron_right"
                aria-label="Next month"
                onClick={() => setMonthCursor((c) => shiftMonth(c, 1))}
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="calendar-date-picker" className="text-xs font-bold text-white/55">
                Pick Date:
              </label>
              <input
                id="calendar-date-picker"
                type="date"
                value={selectedDate}
                onChange={(e) => e.target.value && handleSelectDate(e.target.value)}
                className="input !h-11 !w-auto px-3 text-xs font-bold"
              />
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-white/45">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>

          {/* 42 Day Cells */}
          <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
            {monthCells.map((cell) => {
              const info = byDay.get(cell.key);
              const count = info?.paidOrders.length ?? 0;
              const gross = info?.gross ?? 0;
              const isSelected = cell.key === selectedDate;
              const isToday = cell.key === todayKey;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => handleSelectDate(cell.key)}
                  title={`${cell.key}: ${count} orders · ${peso(gross)}`}
                  className={cx(
                    'group relative flex min-h-[76px] flex-col justify-between rounded-2xl border p-2 text-left transition active:scale-[0.97] sm:min-h-[86px] sm:p-2.5',
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
                        {count} ord
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
                      <p className="text-[10px] text-white/25">No sales</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Date Complete Summary & Charts (Right) */}
        <div className=" flex flex-col gap-6 xl:col-span-5">
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
                {dayData.paidOrders.length} Orders
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label="Total Orders in Day"
                value={`${dayData.paidOrders.length}`}
                sub={`${dayData.itemsCount} dishes sold · ${dayData.voidOrders.length} void`}
                tone="text-orange-300"
                icon="shopping_bag"
              />
              <Stat
                label="Gross Income"
                value={peso(dayData.gross)}
                sub={`Avg ticket ${peso(
                  dayData.paidOrders.length ? dayData.gross / dayData.paidOrders.length : 0
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
                label="Discounts Given"
                value={peso(dayData.discount)}
                sub="SC/PWD & promos"
                tone="text-amber-300"
                icon="sell"
              />
              <Stat
                label="Day Expenses"
                value={peso(dayData.expenseTotal)}
                sub={`${dayData.expenses.length} recorded items`}
                tone="text-rose-300"
                icon="trending_down"
              />
              <Stat
                label="Day Net Profit"
                value={peso(dayNetProfit)}
                sub="Net sales minus expenses"
                tone={dayNetProfit >= 0 ? 'text-sky-300' : 'text-red-300'}
                icon="savings"
              />
            </div>

            {/* Payment Method Breakdown for Selected Date */}
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="mb-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-white/50">
                Payment Channels ({selectedDate})
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {PAYMENT_METHODS.map((pm) => {
                  const stat = paymentBreakdown[pm.id];
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

            {/* Hourly Sales Chart for Selected Date */}
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

      {/* Second Row: Top Dishes on Selected Date + Expense Logger for Selected Date */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Top Dishes */}
        <div className="glass rounded-[28px] p-5 sm:p-6 lg:col-span-6">
          <h3 className="text-base font-extrabold text-white">
            Top Selling Menu Items on {selectedDate}
          </h3>
          <p className="text-xs text-white/50">
            Ranked by gross revenue generated on this day
          </p>
          {topDishes.length === 0 ? (
            <p className="mt-6 text-center text-sm text-white/40">
              No paid orders recorded on {selectedDate}.
            </p>
          ) : (
            <div className="mt-4 space-y-2.5">
              {topDishes.map((d, idx) => (
                <div
                  key={d.title}
                  className="glass-card flex items-center justify-between gap-3 rounded-2xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/20 text-xs font-extrabold text-orange-300">
                      #{idx + 1}
                    </span>
                    <img
                      src={d.image}
                      alt={d.title}
                      className="h-11 w-11 rounded-xl object-cover"
                    />
                    <div>
                      <p className="text-sm font-extrabold text-white">{d.title}</p>
                      <p className="text-xs text-white/50">{d.qty} servings sold</p>
                    </div>
                  </div>
                  <p className="text-sm font-extrabold text-emerald-300 tabular-nums">
                    {peso(d.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day Expenses Logger */}
        <div className="glass rounded-[28px] p-5 sm:p-6 lg:col-span-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white">
                Expenses Recorded on {selectedDate}
              </h3>
              <p className="text-xs text-white/50">
                Deducted from net sales to compute daily net profit
              </p>
            </div>
            <span className="text-base font-extrabold text-rose-300 tabular-nums">
              {peso(dayData.expenseTotal)}
            </span>
          </div>

          <form onSubmit={handleAddExpenseSubmit} className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
            <input
              type="text"
              placeholder="Expense description (e.g. LPG refill, fresh chicken)"
              value={expTitle}
              onChange={(e) => setExpTitle(e.target.value)}
              className="input sm:col-span-5"
              required
            />
            <select
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
              className="input sm:col-span-3"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-[#11141d] text-white">
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Amount ₱"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              className="input sm:col-span-2"
              required
            />
            <Btn type="submit" variant="primary" icon="add" className="sm:col-span-2">
              Add
            </Btn>
          </form>

          <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
            {dayData.expenses.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/40">
                No expenses logged for {selectedDate}.
              </p>
            ) : (
              dayData.expenses.map((ex) => (
                <div
                  key={ex.id}
                  className="glass-card flex items-center justify-between gap-3 rounded-2xl px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-sm font-bold text-white">{ex.title}</p>
                    <p className="text-[11px] text-white/45">
                      {ex.category} · {fmtTime(ex.createdAt)} · by {ex.recordedBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-rose-300 tabular-nums">
                      -{peso(ex.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteExpense(ex)}
                      title="Delete expense"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-white/45 hover:bg-red-500/20 hover:text-red-300"
                    >
                      <Icon name="delete_outline" className="text-[18px]" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Full Timestamped Order List for Selected Date */}
      <div className="glass rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-white">
              Itemized Orders on {fmtDayLong(selectedDate)} ({filteredDayOrders.length})
            </h3>
            <p className="text-xs text-white/50">
              Every order shows its exact date &amp; time, cashier, payment channel, and Admin edit/void controls.
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
            <p className="mt-2 text-sm font-bold">No orders match this date/filter.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-[11px] font-extrabold uppercase tracking-wider text-white/45">
                  <th className="px-3 py-2">Receipt / Queue</th>
                  <th className="px-3 py-2">Date &amp; Exact Time</th>
                  <th className="px-3 py-2">Type / Table / Guest</th>
                  <th className="px-3 py-2">Items Ordered</th>
                  <th className="px-3 py-2">Cashier</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDayOrders.map((o) => {
                  const isVoid = o.status === 'void';
                  return (
                    <tr
                      key={o.id}
                      className={cx(
                        'glass-card rounded-2xl transition',
                        isVoid && 'opacity-55'
                      )}
                    >
                      <td className="rounded-l-2xl px-3 py-3 font-mono text-xs font-bold">
                        <div className="flex items-center gap-2">
                          <span className="text-orange-300">{o.receiptNo}</span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/75">
                            #{String(o.queueNo).padStart(3, '0')}
                          </span>
                        </div>
                        {isVoid && (
                          <span className="mt-1 inline-block rounded bg-red-500/25 px-1.5 py-0.5 text-[10px] font-extrabold text-red-300">
                            VOID: {o.voidReason || 'Cancelled'}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className="font-bold text-white">{fmtDateTime(o.createdAt)}</p>
                        <p className="font-mono text-[11px] text-white/45">
                          {selectedDate} · {fmtTime(o.createdAt)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className="font-bold text-white">
                          {o.orderType} · {o.table}
                        </p>
                        <p className="text-white/55">{o.customerName}</p>
                      </td>
                      <td className="max-w-xs px-3 py-3 text-xs text-white/80">
                        <p className="line-clamp-2">
                          {o.items.map((i) => `${i.qty}x ${i.title}`).join(', ')}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-white/75">
                        {o.cashier}
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span className="rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 font-bold text-white">
                          {o.payment}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-extrabold tabular-nums">
                        <span className={isVoid ? 'line-through text-red-300' : 'text-emerald-300'}>
                          {peso(o.total)}
                        </span>
                        {o.discount > 0 && (
                          <p className="text-[10px] text-amber-300">
                            Disc -{peso(o.discount)}
                          </p>
                        )}
                      </td>
                      <td className="rounded-r-2xl px-3 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Btn
                            size="md"
                            variant="ghost"
                            icon="receipt"
                            onClick={() => onSelectReceipt(o)}
                            title="View / Print Official Receipt"
                          >
                            Receipt
                          </Btn>
                          <Btn
                            size="md"
                            variant="soft"
                            icon="edit"
                            onClick={() => setEditingOrder(o)}
                            title="Admin Edit / Void Order"
                          >
                            Edit
                          </Btn>
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

      {/* Z-Reading Modal */}
      {showZReading && (
        <ZReadingModal
          dateKey={selectedDate}
          orders={dayData.orders}
          expenses={dayData.expenses}
          settings={settings}
          printedBy={session.name}
          onClose={() => setShowZReading(false)}
        />
      )}

      {/* Admin Edit / Void Order Modal */}
      {editingOrder && (
        <AdminEditOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={(updated) => {
            onUpdateOrder(updated);
            setEditingOrder(null);
          }}
        />
      )}
    </div>
  );
}

function AdminEditOrderModal({
  order,
  onClose,
  onSave,
}: {
  order: Order;
  onClose: () => void;
  onSave: (o: Order) => void;
}) {
  const [customerName, setCustomerName] = useState(order.customerName);
  const [table, setTable] = useState(order.table);
  const [payment, setPayment] = useState<PaymentMethod>(order.payment);
  const [status, setStatus] = useState<'paid' | 'void'>(order.status);
  const [voidReason, setVoidReason] = useState(order.voidReason || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...order,
      customerName: customerName.trim() || 'Walk-in Guest',
      table: table.trim() || 'Counter',
      payment,
      status,
      voidReason: status === 'void' ? voidReason.trim() || 'Admin Void' : undefined,
      updatedAt: Date.now(),
    });
  };

  return (
    <Modal
      title={`Admin Edit Sale · ${order.receiptNo}`}
      subtitle={`Recorded ${fmtDateTime(order.createdAt)} · Total ${peso(order.total)}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              Customer Name
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              Table / Counter
            </label>
            <input
              type="text"
              value={table}
              onChange={(e) => setTable(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-white/60">
            Payment Method
          </label>
          <div className="grid grid-cols-4 gap-2">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => setPayment(pm.id)}
                className={cx(
                  'h-12 rounded-xl border text-xs font-extrabold transition',
                  payment === pm.id
                    ? 'border-orange-400 bg-orange-500/25 text-white'
                    : 'border-white/10 bg-white/[0.04] text-white/65'
                )}
              >
                {pm.id}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-bold uppercase text-white/60">
            Sale Status
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStatus('paid')}
              className={cx(
                'h-14 rounded-2xl border font-extrabold transition',
                status === 'paid'
                  ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                  : 'border-white/10 bg-white/[0.04] text-white/60'
              )}
            >
              PAID (Active Sale)
            </button>
            <button
              type="button"
              onClick={() => setStatus('void')}
              className={cx(
                'h-14 rounded-2xl border font-extrabold transition',
                status === 'void'
                  ? 'border-red-400 bg-red-500/25 text-red-200'
                  : 'border-white/10 bg-white/[0.04] text-white/60'
              )}
            >
              VOID / CANCELLED
            </button>
          </div>
        </div>

        {status === 'void' && (
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-white/60">
              Void Reason
            </label>
            <input
              type="text"
              placeholder="e.g. Customer changed mind / wrong punch"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              className="input"
              required
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Btn variant="ghost" size="lg" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" variant="success" size="lg" icon="save">
            Save Sale Changes
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
