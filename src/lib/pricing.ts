import type { DiscountType } from '../data/posData';

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ComputedOrderTotals {
  subTotal: number;
  lessVat: number;
  discountAmount: number;
  vatableSales: number;
  vatAmount: number;
  vatExempt: number;
  totalAmount: number;
}

/**
 * Philippine BIR VAT-inclusive & RA 9994 (Senior Citizen / PWD) pricing engine.
 * - 'none': Total = subtotal; 12% VAT extracted from VAT-inclusive price.
 * - 'senior_pwd': 12% VAT removed first (VAT-exempt base), then 20% statutory discount.
 * - 'promo': 10% promo discount off VAT-inclusive subtotal; 12% VAT extracted from result.
 */
export function computeOrderTotals(
  lines: { unit_price: number; quantity: number }[],
  discountType: DiscountType,
  vatRate = 12
): ComputedOrderTotals {
  const subTotal = r2(
    lines.reduce((s, l) => s + Number(l.unit_price) * Number(l.quantity), 0)
  );
  const div = 1 + vatRate / 100;

  if (subTotal <= 0) {
    return {
      subTotal: 0,
      lessVat: 0,
      discountAmount: 0,
      vatableSales: 0,
      vatAmount: 0,
      vatExempt: 0,
      totalAmount: 0,
    };
  }

  if (discountType === 'senior_pwd') {
    const base = r2(subTotal / div);
    const lessVat = r2(subTotal - base);
    const discountAmount = r2(base * 0.2);
    return {
      subTotal,
      lessVat,
      discountAmount,
      vatableSales: 0,
      vatAmount: 0,
      vatExempt: base,
      totalAmount: r2(base - discountAmount),
    };
  }

  const discountAmount = discountType === 'promo' ? r2(subTotal * 0.1) : 0;
  const totalAmount = r2(subTotal - discountAmount);
  const vatableSales = r2(totalAmount / div);

  return {
    subTotal,
    lessVat: 0,
    discountAmount,
    vatableSales,
    vatAmount: r2(totalAmount - vatableSales),
    vatExempt: 0,
    totalAmount,
  };
}
