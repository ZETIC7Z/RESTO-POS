import { dayKey, type Patch, type PosDb } from '../data/posData';

type Rec = { id: string; updatedAt: number };

function mergeList<T extends Rec>(
  cur: T[],
  inc: T[] | undefined,
  fix?: (prev: T, next: T) => T
): T[] {
  if (!inc || inc.length === 0) return cur;
  const map = new Map<string, T>();
  for (const c of cur) map.set(c.id, c);
  for (const it of inc) {
    const ex = map.get(it.id);
    if (!ex) map.set(it.id, it);
    else if (it.updatedAt >= ex.updatedAt) map.set(it.id, fix ? fix(ex, it) : it);
  }
  return Array.from(map.values());
}

/** Last-write-wins merge by record id. Used by both the server and the optimistic client. */
export function mergePatch(db: PosDb, p: Patch): PosDb {
  return {
    ...db,
    menuItems: mergeList(db.menuItems, p.menuItems),
    orders: mergeList(db.orders, p.orders, (prev, next) => ({
      ...next,
      receiptNo: next.receiptNo || prev.receiptNo,
      queueNo: next.queueNo || prev.queueNo,
    })),
    tabs: mergeList(db.tabs, p.tabs),
    expenses: mergeList(db.expenses, p.expenses),
    settings:
      p.settings && p.settings.updatedAt >= db.settings.updatedAt
        ? p.settings
        : db.settings,
  };
}

/**
 * Server-only: stamp arrival time (so the last device to save wins, regardless of device clocks),
 * assign official receipt + daily queue numbers to new orders, and deduct stock.
 */
export function applyServerAssignments(db: PosDb, p: Patch, now: number): PosDb {
  const stamp = <T extends Rec>(list?: T[]) =>
    list?.forEach((r) => (r.updatedAt = now));
  stamp(p.menuItems);
  stamp(p.orders);
  stamp(p.tabs);
  stamp(p.expenses);
  if (p.settings) p.settings.updatedAt = now;

  if (!p.orders?.length) return db;
  const existing = new Set(db.orders.map((o) => o.id));
  const today = dayKey(now);
  const counters = { ...db.counters };
  if (counters.queueDate !== today) {
    counters.queueDate = today;
    counters.queue = 0;
  }
  let menu = db.menuItems;
  for (const o of p.orders) {
    if (existing.has(o.id)) continue;
    if (!o.receiptNo) {
      counters.receipt += 1;
      o.receiptNo = `OR-${String(counters.receipt).padStart(6, '0')}`;
    }
    if (!o.queueNo) {
      counters.queue += 1;
      o.queueNo = counters.queue;
    }
    const sold = new Map<string, number>();
    for (const l of o.items) sold.set(l.menuId, (sold.get(l.menuId) || 0) + l.qty);
    menu = menu.map((mi) =>
      sold.has(mi.id)
        ? { ...mi, stock: Math.max(0, mi.stock - (sold.get(mi.id) || 0)), updatedAt: now }
        : mi
    );
  }
  return { ...db, counters, menuItems: menu };
}
