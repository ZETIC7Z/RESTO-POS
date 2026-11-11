import type { Addon, Discount, OrderLine, Totals } from '../data/posData';

const r2 = (n: number) => Math.round(n * 100) / 100;

export const lineUnit = (l: OrderLine) =>
  l.price + l.addons.reduce((s, a) => s + a.price, 0);

export const lineKey = (menuId: string, addons: Addon[]) =>
  `${menuId}::${addons.map((a) => a.id).sort().join(',')}`;

/**
 * Philippine VAT-inclusive pricing.
 * - Regular / promo discounts: discount off the VAT-inclusive subtotal, VAT extracted from the result.
 * - Senior Citizen / PWD (statutory): VAT is removed first (VAT-exempt), then 20% off the VAT-exclusive base.
 */
export function computeTotals(
  lines: OrderLine[],
  discount: Discount | null | undefined,
  vatRate: number
): Totals {
  const subTotal = r2(lines.reduce((s, l) => s + lineUnit(l) * l.qty, 0));
  const div = 1 + vatRate / 100;
  const active =
    discount && subTotal > 0 && subTotal >= discount.minOrder ? discount : null;

  if (active?.statutory) {
    const base = r2(subTotal / div);
    const lessVat = r2(subTotal - base);
    const disc = r2((base * (active.percent ?? 20)) / 100);
    return {
      subTotal,
      lessVat,
      discount: disc,
      vatableSales: 0,
      vat: 0,
      vatExempt: base,
      total: r2(base - disc),
    };
  }

  let disc = 0;
  if (active) {
    disc = active.percent
      ? r2((subTotal * active.percent) / 100)
      : Math.min(subTotal, active.fixed ?? 0);
  }
  const total = r2(subTotal - disc);
  const vatable = r2(total / div);
  return {
    subTotal,
    lessVat: 0,
    discount: disc,
    vatableSales: vatable,
    vat: r2(total - vatable),
    vatExempt: 0,
    total,
  };
}

export const calcTotals = computeTotals;

