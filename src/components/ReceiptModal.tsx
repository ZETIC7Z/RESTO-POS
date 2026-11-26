import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import {
  fmtDateTime,
  fmtDayLong,
  OrderRow,
  PaymentMethod,
  PAYMENT_METHODS,
  peso,
  StoreSettings,
} from '../data/posData';
import { Btn, Modal } from './ui';

const LOGO_SRC = `${import.meta.env.BASE_URL}el-farm-logo.jpg`;

function PrintPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div id="pos-print-root" aria-hidden="true">
      {children}
    </div>,
    document.body
  );
}

export function ReceiptModal({
  order,
  settings,
  autoPrint = false,
  onClose,
  onNewOrder,
}: {
  order: OrderRow;
  settings: StoreSettings;
  autoPrint?: boolean;
  onClose: () => void;
  onNewOrder?: () => void;
}) {
  useEffect(() => {
    if (!autoPrint) return;
    const t = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        /* print dialog blocked or unavailable */
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [autoPrint, order.id]);

  const snap = order.receipt_snapshot || {};
  const items =
    order.order_items && order.order_items.length > 0
      ? order.order_items.map((i) => ({
          key: i.id,
          product_name: i.product_name,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        }))
      : (snap.items || []).map((i, idx) => ({
          key: `${i.product_id}-${idx}`,
          product_name: i.product_name,
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
        }));

  const subTotal =
    typeof snap.sub_total === 'number'
      ? snap.sub_total
      : items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const lessVat =
    typeof snap.less_vat === 'number'
      ? snap.less_vat
      : order.discount_type === 'senior_pwd'
      ? Math.max(0, subTotal - subTotal / 1.12)
      : 0;

  const vatExempt =
    typeof snap.vat_exempt === 'number'
      ? snap.vat_exempt
      : order.discount_type === 'senior_pwd'
      ? subTotal / 1.12
      : 0;

  const renderReceiptContent = (isPrintCopy: boolean) => (
    <div
      id={isPrintCopy ? 'printable-receipt-copy' : 'printable-receipt'}
      className={
        isPrintCopy
          ? 'pos-print-sheet'
          : 'w-full max-w-[330px] rounded-2xl bg-white p-5 font-mono text-[12px] leading-snug text-black shadow-2xl'
      }
    >
      <div className="border-b border-dashed border-black/45 pb-3 text-center">
        <img
          src={LOGO_SRC}
          alt={snap.store_name || settings.store_name}
          className={isPrintCopy ? 'mx-auto mb-1.5 h-12 w-12 rounded-lg object-cover' : 'mx-auto mb-1.5 h-11 w-11 rounded-lg object-cover'}
        />
        <p className="text-base font-extrabold uppercase tracking-tight text-black">
          {snap.store_name || settings.store_name}
        </p>
        <p className="text-[11px] text-black">{snap.address || settings.address}</p>
        <p className="text-[10px] text-black/75">VAT REG TIN: {snap.tin || settings.tin}</p>
        <div className="mt-2 inline-block rounded border border-black px-3 py-0.5 text-sm font-extrabold text-black">
          QUEUE #{String(order.order_number).padStart(2, '0')}
        </div>
        {order.status === 'cancelled' && (
          <p className="print-badge-invert mt-1.5 rounded border border-black bg-black px-2 py-0.5 text-xs font-extrabold text-white">
            *** CANCELLED / VOIDED ***
          </p>
        )}
      </div>

      <div className="space-y-0.5 border-b border-dashed border-black/45 py-2.5 text-[11px] text-black">
        <div className="flex justify-between gap-2">
          <span>OR No.:</span>
          <span className="font-bold">{order.or_number}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Date/Time:</span>
          <span className="text-right">{fmtDateTime(order.created_at)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Order Type:</span>
          <span className="font-bold">{snap.order_type || 'Dine-In'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Customer:</span>
          <span className="text-right">{order.customer_name || 'Walk-in Customer'}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Cashier:</span>
          <span className="text-right">{order.cashier_name}</span>
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-1.5 border-b border-dashed border-black/45 py-2.5 text-black">
        {items.map((ln) => (
          <div key={ln.key} className="flex items-start justify-between gap-2 font-bold">
            <span className="break-words">
              {ln.quantity}x {ln.product_name}
            </span>
            <span className="shrink-0">{peso(ln.unit_price * ln.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Totals & BIR VAT Breakdown */}
      <div className="space-y-0.5 border-b border-dashed border-black/45 py-2.5 text-[11px] text-black">
        <div className="flex justify-between gap-2">
          <span>Subtotal:</span>
          <span>{peso(subTotal)}</span>
        </div>
        {lessVat > 0 && (
          <div className="flex justify-between gap-2">
            <span>Less 12% VAT (SC/PWD):</span>
            <span>-{peso(lessVat)}</span>
          </div>
        )}
        {Number(order.discount_amount) > 0 && (
          <div className="flex justify-between gap-2">
            <span>
              Discount ({order.discount_type === 'senior_pwd' ? 'SC/PWD 20%' : 'PROMO'}):
            </span>
            <span>-{peso(Number(order.discount_amount))}</span>
          </div>
        )}
        <div className="flex justify-between gap-2 pt-1 text-sm font-extrabold">
          <span>TOTAL DUE:</span>
          <span>{peso(Number(order.total_amount))}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>
            Paid ({order.payment_method}
            {snap.payment_ref ? ` #${snap.payment_ref}` : ''}):
          </span>
          <span>{peso(Number(order.amount_paid))}</span>
        </div>
        <div className="flex justify-between gap-2 font-bold">
          <span>CHANGE (SUKLI):</span>
          <span>{peso(Number(order.change_due))}</span>
        </div>
      </div>

      <div className="space-y-0.5 border-b border-dashed border-black/45 py-2 text-[10px] text-black/85">
        <div className="flex justify-between gap-2">
          <span>VATable Sales:</span>
          <span>{peso(Number(order.vatable_sales))}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>VAT Amount (12%):</span>
          <span>{peso(Number(order.vat_amount))}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>VAT-Exempt Sales:</span>
          <span>{peso(vatExempt)}</span>
        </div>
      </div>

      <div className="flex flex-col items-center pt-3 text-center text-black">
        <div className="rounded bg-white p-1.5">
          <QRCode
            value={`${settings.store_name}|${order.or_number}|${Number(
              order.total_amount
            ).toFixed(2)}|${order.created_at}`}
            size={isPrintCopy ? 104 : 84}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
        <p className="mt-2 text-[11px] font-bold">Maraming salamat po! Balik po kayo.</p>
        <p className="mt-0.5 text-[9px] text-black/70">
          THIS SERVES AS YOUR OFFICIAL RECEIPT
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        title={`Official Receipt · ${order.or_number}`}
        subtitle={`Queue #${String(order.order_number).padStart(2, '0')} · ${fmtDateTime(
          order.created_at
        )}`}
        onClose={onClose}
      >
        <div className="flex flex-col items-center">
          {renderReceiptContent(false)}

          {/* Action Buttons */}
          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            <Btn size="lg" variant="primary" icon="print" onClick={() => window.print()}>
              Print 80mm Receipt
            </Btn>
            <Btn
              size="lg"
              variant="success"
              icon="check"
              onClick={() => {
                onNewOrder?.();
                onClose();
              }}
            >
              Done
            </Btn>
          </div>
        </div>
      </Modal>
      <PrintPortal>{renderReceiptContent(true)}</PrintPortal>
    </>
  );
}

export function ZReadingModal({
  dateKey,
  orders,
  settings,
  printedBy,
  onClose,
}: {
  dateKey: string;
  orders: OrderRow[];
  settings: StoreSettings;
  printedBy: string;
  onClose: () => void;
}) {
  const paid = orders.filter((o) => o.status !== 'cancelled');
  const cancelled = orders.filter((o) => o.status === 'cancelled');
  const totalSales = paid.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalVat = paid.reduce((s, o) => s + Number(o.vat_amount), 0);
  const vatable = paid.reduce((s, o) => s + Number(o.vatable_sales), 0);
  const discounts = paid.reduce((s, o) => s + Number(o.discount_amount), 0);

  const byPay: Record<string, number> = { Cash: 0, GCash: 0, Maya: 0, Card: 0 };
  paid.forEach((o) => {
    byPay[o.payment_method] = (byPay[o.payment_method] || 0) + Number(o.total_amount);
  });

  const renderZReadingContent = (isPrintCopy: boolean) => (
    <div
      id={isPrintCopy ? 'printable-zreading-copy' : 'printable-receipt'}
      className={
        isPrintCopy
          ? 'pos-print-sheet'
          : 'w-full max-w-[330px] rounded-2xl bg-white p-5 font-mono text-[12px] leading-snug text-black shadow-2xl'
      }
    >
      <div className="border-b border-dashed border-black/45 pb-2.5 text-center text-black">
        <img
          src={LOGO_SRC}
          alt={settings.store_name}
          className="mx-auto mb-1.5 h-11 w-11 rounded-lg object-cover"
        />
        <p className="text-base font-extrabold uppercase">{settings.store_name}</p>
        <p className="text-[11px]">{settings.address}</p>
        <p className="text-[10px]">VAT REG TIN: {settings.tin}</p>
        <p className="print-badge-invert mt-1.5 rounded border border-black bg-black px-2 py-0.5 text-xs font-extrabold text-white">
          DAILY Z-READING REPORT
        </p>
      </div>

      <div className="space-y-0.5 border-b border-dashed border-black/45 py-2 text-[11px] text-black">
        <div className="flex justify-between gap-2">
          <span>Report Date:</span>
          <span className="font-bold">{dateKey}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Printed By:</span>
          <span className="text-right">{printedBy}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Valid Orders:</span>
          <span className="font-bold">{paid.length}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Cancelled Orders:</span>
          <span>{cancelled.length}</span>
        </div>
      </div>

      <div className="space-y-0.5 border-b border-dashed border-black/45 py-2 text-[11px] text-black">
        <div className="flex justify-between gap-2">
          <span>Discounts / SC / PWD:</span>
          <span>-{peso(discounts)}</span>
        </div>
        <div className="flex justify-between gap-2 font-extrabold">
          <span>TOTAL COLLECTED:</span>
          <span>{peso(totalSales)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>VATable Sales:</span>
          <span>{peso(vatable)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>12% VAT:</span>
          <span>{peso(totalVat)}</span>
        </div>
        <div className="flex justify-between gap-2 border-t border-black/25 pt-1 font-extrabold">
          <span>NET SALES (EX-VAT):</span>
          <span>{peso(totalSales - totalVat)}</span>
        </div>
      </div>

      <div className="space-y-0.5 py-2 text-[11px] text-black">
        <p className="font-bold uppercase">Payment Breakdown</p>
        {PAYMENT_METHODS.map((pm: { id: PaymentMethod }) => (
          <div key={pm.id} className="flex justify-between gap-2">
            <span>{pm.id}:</span>
            <span>{peso(byPay[pm.id] || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Modal
        title={`Daily Z-Reading · ${dateKey}`}
        subtitle={fmtDayLong(dateKey)}
        onClose={onClose}
      >
        <div className="flex flex-col items-center">
          {renderZReadingContent(false)}

          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            <Btn size="lg" variant="primary" icon="print" onClick={() => window.print()}>
              Print 80mm Z-Reading
            </Btn>
            <Btn size="lg" variant="ghost" onClick={onClose}>
              Close
            </Btn>
          </div>
        </div>
      </Modal>
      <PrintPortal>{renderZReadingContent(true)}</PrintPortal>
    </>
  );
}

export interface PayslipPrintData {
  cashierName: string;
  username: string;
  cutoffStart: string;
  cutoffEnd: string;
  daysWorked: number;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  otMultiplier: number;
  regularPay: number;
  overtimePay: number;
  netPayout: number;
  preparedBy: string;
}

export function PayslipModal({
  payslip,
  settings,
  onClose,
}: {
  payslip: PayslipPrintData;
  settings: StoreSettings;
  onClose: () => void;
}) {
  const renderPayslipContent = (isPrintCopy: boolean) => (
    <div
      id={isPrintCopy ? 'printable-payslip-copy' : 'printable-receipt'}
      className={
        isPrintCopy
          ? 'pos-print-sheet'
          : 'w-full max-w-[330px] rounded-2xl bg-white p-5 font-mono text-[12px] leading-snug text-black shadow-2xl'
      }
    >
      {/* Centered Company Name Header */}
      <div className="border-b border-dashed border-black/45 pb-3 text-center text-black">
        <img
          src={LOGO_SRC}
          alt={settings.store_name}
          className="mx-auto mb-1.5 h-11 w-11 rounded-lg object-cover"
        />
        <p className="text-base font-extrabold uppercase tracking-tight">
          {settings.store_name}
        </p>
        <p className="text-[11px]">{settings.address}</p>
        <p className="print-badge-invert mt-2 rounded border border-black bg-black px-2 py-0.5 text-xs font-extrabold uppercase text-white">
          CASHIER PAYSLIP (BARMM-05)
        </p>
      </div>

      <div className="space-y-1 border-b border-dashed border-black/45 py-2.5 text-[11px] text-black">
        <div className="flex justify-between gap-2">
          <span>Employee:</span>
          <span className="font-bold text-right">{payslip.cashierName}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Username:</span>
          <span>@{payslip.username}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Cutoff From:</span>
          <span className="font-bold">{payslip.cutoffStart}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Cutoff To:</span>
          <span className="font-bold">{payslip.cutoffEnd}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Days Worked:</span>
          <span className="font-bold">{payslip.daysWorked} day(s)</span>
        </div>
      </div>

      <div className="space-y-1 border-b border-dashed border-black/45 py-2.5 text-[11px] text-black">
        <div className="flex justify-between gap-2">
          <span>Hourly Rate:</span>
          <span>{peso(payslip.hourlyRate)}/hr</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>Regular Hours:</span>
          <span>{payslip.regularHours.toFixed(2)} hrs</span>
        </div>
        <div className="flex justify-between gap-2 font-bold">
          <span>Regular Hours Pay:</span>
          <span>{peso(payslip.regularPay)}</span>
        </div>
        <div className="flex justify-between gap-2 pt-1">
          <span>Overtime Hours:</span>
          <span>{payslip.overtimeHours.toFixed(2)} hrs</span>
        </div>
        <div className="flex justify-between gap-2 font-bold">
          <span>Overtime Pay ({payslip.otMultiplier}x):</span>
          <span>{peso(payslip.overtimePay)}</span>
        </div>
      </div>

      <div className="border-b border-dashed border-black/45 py-3 text-black">
        <div className="flex items-baseline justify-between gap-2 text-sm font-extrabold">
          <span>TOTAL NET PAYOUT:</span>
          <span className="text-base">{peso(payslip.netPayout)}</span>
        </div>
      </div>

      <div className="pt-5 text-center text-[10px] text-black">
        <div className="mx-auto mt-4 w-48 border-t border-black pt-1 font-bold">
          {payslip.cashierName}
        </div>
        <p className="text-black/75">Employee Signature / Date Received</p>
        <p className="mt-2 text-black/65">Prepared by: {payslip.preparedBy}</p>
        <p className="text-black/55">{fmtDateTime(Date.now())}</p>
      </div>
    </div>
  );

  return (
    <>
      <Modal
        title={`80mm Thermal Payslip · ${payslip.cashierName}`}
        subtitle={`Cutoff ${payslip.cutoffStart} to ${payslip.cutoffEnd}`}
        onClose={onClose}
      >
        <div className="flex flex-col items-center">
          {renderPayslipContent(false)}

          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            <Btn size="lg" variant="primary" icon="print" onClick={() => window.print()}>
              Print 80mm / QMS Payslip
            </Btn>
            <Btn size="lg" variant="ghost" onClick={onClose}>
              Close
            </Btn>
          </div>
        </div>
      </Modal>
      <PrintPortal>{renderPayslipContent(true)}</PrintPortal>
    </>
  );
}
