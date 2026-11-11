import {
  addDays,
  DEFAULT_SETTINGS,
  DISCOUNTS,
  dayKey,
  dayStart,
  INITIAL_MENU,
  weekdayOf,
  type Expense,
  type KitchenStatus,
  type Order,
  type OrderLine,
  type OrderType,
  type PaymentMethod,
  type PosDb,
  type TableTab,
} from './posData';
import { computeTotals } from '../lib/pricing';

/** Deterministic PRNG so demo history is stable. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_DAYS = 45;

/** Builds a fresh database with menu, settings and ~45 days of demo sales history. */
export function buildSeedDb(now = Date.now()): PosDb {
  const rnd = mulberry32(20261111);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const menu = INITIAL_MENU.map((x) => ({ ...x, updatedAt: now }));
  const today = dayKey(now);
  const orders: Order[] = [];
  const expenses: Expense[] = [];
  let receipt = 0;
  let todayQueue = 0;

  for (let d = DEMO_DAYS; d >= 0; d--) {
    const key = addDays(today, -d);
    const wd = weekdayOf(key);
    const weekend = wd === 0 || wd === 6;
    const count = Math.floor((weekend ? 22 : 13) + rnd() * 12);
    const start = dayStart(key);
    const times: number[] = [];
    for (let i = 0; i < count; i++) {
      // Lunch & dinner peaks between 10:00 and 21:00
      const peak = rnd() < 0.5 ? 12 : 18.5;
      const hour = Math.min(21.5, Math.max(10, peak + (rnd() - 0.5) * 5));
      const ts = start + hour * 3_600_000;
      if (ts < now - 60_000) times.push(ts);
    }
    times.sort((a, b) => a - b);

    times.forEach((ts, qi) => {
      const lines: OrderLine[] = [];
      const n = 1 + Math.floor(rnd() * 4);
      for (let i = 0; i < n; i++) {
        const mi = pick(menu);
        const ex = lines.find((l) => l.menuId === mi.id);
        if (ex) ex.qty += 1;
        else
          lines.push({
            id: `l-${key}-${qi}-${i}`,
            menuId: mi.id,
            title: mi.title,
            image: mi.image,
            price: mi.price,
            qty: 1 + Math.floor(rnd() * 2),
            addons: [],
          });
      }
      const disc = rnd() < 0.1 ? DISCOUNTS[0] : rnd() < 0.05 ? DISCOUNTS[1] : null;
      const totals = computeTotals(lines, disc, 12);
      const r = rnd();
      const payment: PaymentMethod = r < 0.6 ? 'Cash' : r < 0.85 ? 'GCash' : r < 0.95 ? 'Maya' : 'Card';
      const r2 = rnd();
      const orderType: OrderType = r2 < 0.55 ? 'Dine-In' : r2 < 0.85 ? 'Take-Out' : 'Delivery';
      const tendered =
        payment === 'Cash' ? Math.ceil(totals.total / 100) * 100 : totals.total;
      receipt += 1;
      const isToday = key === today;
      if (isToday) todayQueue = qi + 1;
      const recent = isToday && times.length - qi <= 4;
      const kitchenStatus: KitchenStatus = recent
        ? (['New', 'Cooking', 'Ready', 'Cooking'] as KitchenStatus[])[times.length - qi - 1]
        : 'Served';
      const voided = !isToday && rnd() < 0.015;
      orders.push({
        id: `ord-seed-${key}-${qi}`,
        receiptNo: `OR-${String(receipt).padStart(6, '0')}`,
        queueNo: qi + 1,
        createdAt: ts,
        updatedAt: ts,
        orderType,
        table: orderType === 'Dine-In' ? `Table ${1 + Math.floor(rnd() * 12)}` : orderType,
        customerName: disc?.statutory ? 'Senior Citizen' : 'Walk-in',
        cashier: rnd() < 0.7 ? 'Cashier' : 'Administrator',
        items: lines,
        ...totals,
        discountCode: totals.discount > 0 ? disc?.code : undefined,
        tendered,
        change: Math.round((tendered - totals.total) * 100) / 100,
        payment,
        paymentRef: payment === 'Cash' ? undefined : `${payment.toUpperCase()}-${100000 + Math.floor(rnd() * 899999)}`,
        kitchenStatus,
        status: voided ? 'void' : 'paid',
        voidReason: voided ? 'Customer cancelled' : undefined,
      });
    });

    // Daily market expense
    const exTs = start + 7.5 * 3_600_000;
    if (exTs < now) {
      expenses.push({
        id: `exp-seed-${key}-1`,
        title: 'Market: chicken, pork, vegetables & rice',
        category: 'Ingredients',
        amount: Math.round(1800 + rnd() * 1400),
        createdAt: exTs,
        updatedAt: exTs,
        recordedBy: 'Administrator',
      });
      if (rnd() < 0.35) {
        expenses.push({
          id: `exp-seed-${key}-2`,
          title: pick(['LPG refill', 'Ice & drinking water', 'Take-out boxes & cups', 'Receipt paper rolls']),
          category: pick(['Utilities', 'Packaging', 'Other'] as const),
          amount: Math.round(300 + rnd() * 900),
          createdAt: exTs + 3_600_000,
          updatedAt: exTs + 3_600_000,
          recordedBy: 'Administrator',
        });
      }
    }
  }

  const tab = (table: string, minutesAgo: number, ids: [string, number][], name: string): TableTab => ({
    id: `tab-${table}`,
    table,
    orderType: 'Dine-In',
    customerName: name,
    items: ids.map(([mid, qty], i) => {
      const mi = menu.find((x) => x.id === mid)!;
      return { id: `tl-${table}-${i}`, menuId: mi.id, title: mi.title, image: mi.image, price: mi.price, qty, addons: [] };
    }),
    discountId: null,
    kitchenStatus: 'Cooking',
    openedAt: now - minutesAgo * 60_000,
    updatedAt: now,
    cashier: 'Cashier',
  });

  return {
    version: 1,
    menuItems: menu,
    orders,
    tabs: [
      tab('Table 3', 18, [['ph-chk-3', 1], ['ph-noodle-1', 3], ['ph-drink-1', 4]], 'Reyes Family'),
      tab('Table 5', 7, [['ph-silog-1', 2], ['ph-drink-4', 2]], 'Walk-in'),
    ],
    expenses,
    settings: { ...DEFAULT_SETTINGS, updatedAt: now },
    counters: { receipt, queueDate: today, queue: todayQueue },
  };
}
