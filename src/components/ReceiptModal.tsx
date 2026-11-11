import QRCode from 'react-qr-code';
import {
  Expense,
  fmtDateTime,
  fmtDayLong,
  Order,
  PaymentMethod,
  PAYMENT_METHODS,
  peso,
  Settings,
} from '../data/posData';
import { Btn, Modal } from './ui';

export function ReceiptModal({
  order,
  settings,
  onClose,
  onNewOrder,
}: {
  order: Order;
  settings: Settings;
  onClose: () => void;
  onNewOrder?: () => void;
}) {
  const printNow = () => window.print();

  return (
    <Modal
      title={`Official Receipt · ${order.receiptNo}`}
      subtitle={`Queue #${String(order.queueNo).padStart(3, '0')} · ${fmtDateTime(order.createdAt)}`}
      onClose={onClose}
    >
      <div className="flex flex-col items-center">
        {/* Printable 80mm Thermal Receipt */}
        <div
          id="printable-receipt"
          className="w-full max-w-[330px] rounded-2xl bg-white p-5 font-mono text-[12px] leading-snug text-black shadow-2xl"
        >
          <div className="border-b border-dashed border-black/40 pb-3 text-center">
            <p className="text-base font-extrabold uppercase tracking-tight">
              {settings.storeName}
            </p>
            <p className="text-[11px]">{settings.address}</p>
            <p className="text-[10px] text-black/70">{settings.tin}</p>
            <div className="mt-2 inline-block rounded border border-black px-3 py-0.5 text-sm font-extrabold">
              QUEUE #{String(order.queueNo).padStart(3, '0')}
            </div>
            {order.status === 'void' && (
              <p className="mt-1 rounded bg-black px-2 py-0.5 text-xs font-extrabold text-white">
                *** VOIDED ({order.voidReason || 'CANCELLED'}) ***
              </p>
            )}
          </div>

          <div className="space-y-0.5 border-b border-dashed border-black/40 py-2.5 text-[11px]">
            <div className="flex justify-between">
              <span>OR No.:</span>
              <span className="font-bold">{order.receiptNo}</span>
            </div>
            <div className="flex justify-between">
              <span>Date/Time:</span>
              <span>{fmtDateTime(order.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Type / Table:</span>
              <span className="font-bold">
                {order.orderType} · {order.table}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{order.customerName || 'Walk-in Guest'}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{order.cashier}</span>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-1.5 border-b border-dashed border-black/40 py-2.5">
            {order.items.map((ln) => {
              const addonSum = ln.addons.reduce((s, a) => s + a.price, 0);
              const lineTotal = (ln.price + addonSum) * ln.qty;
              return (
                <div key={ln.id}>
                  <div className="flex justify-between font-bold">
                    <span>
                      {ln.qty}x {ln.title}
                    </span>
                    <span>{peso(lineTotal)}</span>
                  </div>
                  {ln.addons.length > 0 && (
                    <p className="pl-3 text-[10px] text-black/75">
                      + {ln.addons.map((a) => `${a.name} (₱${a.price})`).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Totals & BIR VAT Breakdown */}
          <div className="space-y-0.5 border-b border-dashed border-black/40 py-2.5 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{peso(order.subTotal)}</span>
            </div>
            {order.lessVat > 0 && (
              <div className="flex justify-between">
                <span>Less 12% VAT (SC/PWD):</span>
                <span>-{peso(order.lessVat)}</span>
              </div>
            )}
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span>Discount ({order.discountCode || 'PROMO'}):</span>
                <span>-{peso(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-sm font-extrabold">
              <span>TOTAL DUE:</span>
              <span>{peso(order.total)}</span>
            </div>
            <div className="flex justify-between">
              <span>
                Paid ({order.payment}
                {order.paymentRef ? ` #${order.paymentRef}` : ''}):
              </span>
              <span>{peso(order.tendered)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>CHANGE (SUKLI):</span>
              <span>{peso(order.change)}</span>
            </div>
          </div>

          <div className="space-y-0.5 border-b border-dashed border-black/40 py-2 text-[10px] text-black/80">
            <div className="flex justify-between">
              <span>VATable Sales:</span>
              <span>{peso(order.vatableSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT Amount ({settings.vatRate}%):</span>
              <span>{peso(order.vat)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT-Exempt Sales:</span>
              <span>{peso(order.vatExempt)}</span>
            </div>
          </div>

          <div className="flex flex-col items-center pt-3 text-center">
            <div className="rounded bg-white p-1.5">
              <QRCode
                value={`${settings.storeName}|${order.receiptNo}|${order.total.toFixed(2)}|${new Date(
                  order.createdAt
                ).toISOString()}`}
                size={84}
                level="M"
              />
            </div>
            <p className="mt-2 text-[11px] font-bold">{settings.receiptFooter}</p>
            <p className="mt-0.5 text-[9px] text-black/60">
              THIS SERVES AS YOUR OFFICIAL RECEIPT
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-5 grid w-full grid-cols-2 gap-3">
          <Btn size="lg" variant="primary" icon="print" onClick={printNow}>
            Print Receipt
          </Btn>
          <Btn
            size="lg"
            variant="success"
            icon="add_shopping_cart"
            onClick={() => {
              onNewOrder?.();
              onClose();
            }}
          >
            Next Customer
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

export function ZReadingModal({
  dateKey,
  orders,
  expenses,
  settings,
  printedBy,
  onClose,
}: {
  dateKey: string;
  orders: Order[];
  expenses: Expense[];
  settings: Settings;
  printedBy: string;
  onClose: () => void;
}) {
  const paid = orders.filter((o) => o.status === 'paid' && !o.deleted);
  const voided = orders.filter((o) => o.status === 'void' && !o.deleted);
  const grossSub = paid.reduce((s, o) => s + o.subTotal, 0);
  const totalSales = paid.reduce((s, o) => s + o.total, 0);
  const totalVat = paid.reduce((s, o) => s + o.vat, 0);
  const vatable = paid.reduce((s, o) => s + o.vatableSales, 0);
  const vatExempt = paid.reduce((s, o) => s + o.vatExempt, 0);
  const discounts = paid.reduce((s, o) => s + o.discount + o.lessVat, 0);
  const expTotal = expenses.filter((e) => !e.deleted).reduce((s, e) => s + e.amount, 0);
  const netProfit = totalSales - totalVat - expTotal;

  const byPay: Record<PaymentMethod, number> = { Cash: 0, GCash: 0, Maya: 0, Card: 0 };
  paid.forEach((o) => {
    byPay[o.payment] = (byPay[o.payment] || 0) + o.total;
  });

  return (
    <Modal
      title={`Z-Reading Report · ${dateKey}`}
      subtitle={fmtDayLong(dateKey)}
      onClose={onClose}
    >
      <div className="flex flex-col items-center">
        <div
          id="printable-receipt"
          className="w-full max-w-[330px] rounded-2xl bg-white p-5 font-mono text-[12px] leading-snug text-black shadow-2xl"
        >
          <div className="border-b border-dashed border-black/40 pb-2.5 text-center">
            <p className="text-base font-extrabold uppercase">{settings.storeName}</p>
            <p className="text-[11px]">{settings.address}</p>
            <p className="text-[10px]">{settings.tin}</p>
            <p className="mt-1.5 rounded bg-black px-2 py-0.5 text-xs font-extrabold text-white">
              DAILY Z-READING REPORT
            </p>
          </div>

          <div className="space-y-0.5 border-b border-dashed border-black/40 py-2 text-[11px]">
            <div className="flex justify-between">
              <span>Report Date:</span>
              <span className="font-bold">{dateKey}</span>
            </div>
            <div className="flex justify-between">
              <span>Printed By:</span>
              <span>{printedBy}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid Orders:</span>
              <span className="font-bold">{paid.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Voided Orders:</span>
              <span>{voided.length}</span>
            </div>
          </div>

          <div className="space-y-0.5 border-b border-dashed border-black/40 py-2 text-[11px]">
            <div className="flex justify-between">
              <span>Gross Subtotal:</span>
              <span>{peso(grossSub)}</span>
            </div>
            <div className="flex justify-between">
              <span>Less Discounts/SC:</span>
              <span>-{peso(discounts)}</span>
            </div>
            <div className="flex justify-between font-extrabold">
              <span>TOTAL COLLECTED:</span>
              <span>{peso(totalSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>VATable Sales:</span>
              <span>{peso(vatable)}</span>
            </div>
            <div className="flex justify-between">
              <span>12% VAT:</span>
              <span>{peso(totalVat)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT-Exempt:</span>
              <span>{peso(vatExempt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Day Expenses:</span>
              <span>-{peso(expTotal)}</span>
            </div>
            <div className="flex justify-between border-t border-black/20 pt-1 font-extrabold">
              <span>NET PROFIT:</span>
              <span>{peso(netProfit)}</span>
            </div>
          </div>

          <div className="space-y-0.5 py-2 text-[11px]">
            <p className="font-bold uppercase">Payment Breakdown</p>
            {PAYMENT_METHODS.map((pm) => (
              <div key={pm.id} className="flex justify-between">
                <span>{pm.id}:</span>
                <span>{peso(byPay[pm.id] || 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 grid w-full grid-cols-2 gap-3">
          <Btn size="lg" variant="primary" icon="print" onClick={() => window.print()}>
            Print Z-Reading
          </Btn>
          <Btn size="lg" variant="ghost" onClick={onClose}>
            Close
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
