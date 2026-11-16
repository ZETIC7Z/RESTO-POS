import React, { useMemo, useState } from 'react';
import {
  fmtDateTime,
  OrderRow,
  peso,
  Product,
  ReceiptSnapshotItem,
} from '../data/posData';
import { computeOrderTotals } from '../lib/pricing';
import { supabase } from '../lib/supabase';
import { Btn, cx, Icon, Modal } from './ui';

interface EditableLine {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  orig_qty: number;
}

export function OrderEditorModal({
  order,
  products,
  onClose,
  onSaved,
}: {
  order: OrderRow;
  products: Product[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const initialLines = useMemo<EditableLine[]>(() => {
    const rawItems =
      order.order_items && order.order_items.length > 0
        ? order.order_items.map((i) => ({
            product_id: i.product_id || '',
            product_name: i.product_name,
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
          }))
        : (order.receipt_snapshot?.items || []).map((i) => ({
            product_id: i.product_id,
            product_name: i.product_name,
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
          }));

    return rawItems.map((l) => ({
      ...l,
      orig_qty: l.quantity,
    }));
  }, [order]);

  const [lines, setLines] = useState<EditableLine[]>(initialLines);
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const availableToAdd = useMemo(
    () =>
      products.filter(
        (p) =>
          p.is_available &&
          p.stock_qty > 0 &&
          !lines.some((l) => l.product_id === p.id)
      ),
    [products, lines]
  );

  const totals = useMemo(
    () => computeOrderTotals(lines, order.discount_type || 'none'),
    [lines, order.discount_type]
  );

  const changeDue = Math.max(0, Number(order.amount_paid) - totals.totalAmount);

  const adjustQty = (productId: string, delta: number) => {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.product_id !== productId) return l;
          const prod = products.find((p) => p.id === productId);
          const maxAllowed = prod ? prod.stock_qty + l.orig_qty : l.quantity + 99;
          const nextQty = Math.min(maxAllowed, l.quantity + delta);
          return { ...l, quantity: nextQty };
        })
        .filter((l) => l.quantity > 0)
    );
  };

  const handleAddProduct = () => {
    const prod = products.find((p) => p.id === selectedAddProductId);
    if (!prod) return;
    setLines((prev) => [
      ...prev,
      {
        product_id: prod.id,
        product_name: prod.name,
        quantity: 1,
        unit_price: Number(prod.price),
        orig_qty: 0,
      },
    ]);
    setSelectedAddProductId('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      setErr('Order must have at least one item. Use Cancel / Void to cancel an empty order.');
      return;
    }

    setSaving(true);
    setErr('');
    try {
      const rpcItems: ReceiptSnapshotItem[] = lines.map((l) => ({
        product_id: l.product_id,
        product_name: l.product_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: Math.round(l.unit_price * l.quantity * 100) / 100,
      }));

      const nextSnapshot = {
        ...(order.receipt_snapshot || {}),
        sub_total: totals.subTotal,
        less_vat: totals.lessVat,
        vat_exempt: totals.vatExempt,
        items: rpcItems,
      };

      const { error } = await supabase.rpc('update_submitted_order', {
        p_order_id: order.id,
        p_new_items: rpcItems,
        p_new_total: totals.totalAmount,
        p_new_vatable: totals.vatableSales,
        p_new_vat: totals.vatAmount,
        p_new_discount: totals.discountAmount,
        p_new_change: changeDue,
        p_new_snapshot: nextSnapshot,
      });

      if (error) throw error;
      await onSaved();
      onClose();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update submitted order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Edit Submitted Order · ${order.or_number}`}
      subtitle={`Queue #${String(order.order_number).padStart(2, '0')} · ${fmtDateTime(
        order.created_at
      )} · Stock auto-reconciles`}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {lines.map((ln) => {
            const prod = products.find((p) => p.id === ln.product_id);
            const maxAllowed = prod ? prod.stock_qty + ln.orig_qty : ln.quantity + 50;
            return (
              <div
                key={ln.product_id || ln.product_name}
                className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3"
              >
                <div>
                  <p className="text-sm font-extrabold text-white">{ln.product_name}</p>
                  <p className="text-xs text-white/50">
                    {peso(ln.unit_price)} each · Max qty {maxAllowed}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-extrabold text-emerald-300 tabular-nums">
                    {peso(ln.unit_price * ln.quantity)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustQty(ln.product_id, -1)}
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-lg font-extrabold text-white active:scale-95"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm font-extrabold tabular-nums">
                      {ln.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={ln.quantity >= maxAllowed}
                      onClick={() => adjustQty(ln.product_id, 1)}
                      className={cx(
                        'flex h-11 w-11 items-center justify-center rounded-xl text-lg font-extrabold text-white active:scale-95',
                        ln.quantity >= maxAllowed
                          ? 'bg-white/10 opacity-40'
                          : 'bg-orange-500'
                      )}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add additional item from live catalog */}
        {availableToAdd.length > 0 && (
          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <select
              value={selectedAddProductId}
              onChange={(e) => setSelectedAddProductId(e.target.value)}
              className="input !h-12 flex-1 min-w-[200px] text-sm"
            >
              <option value="" className="bg-[#11141d]">
                + Select dish to add to this order...
              </option>
              {availableToAdd.map((p) => (
                <option key={p.id} value={p.id} className="bg-[#11141d]">
                  {p.name} ({peso(p.price)} · {p.stock_qty} in stock)
                </option>
              ))}
            </select>
            <Btn
              size="md"
              variant="soft"
              icon="add"
              disabled={!selectedAddProductId}
              onClick={handleAddProduct}
            >
              Add Item
            </Btn>
          </div>
        )}

        {/* Recalculated Totals */}
        <div className="glass-card grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-4">
          <div>
            <p className="text-[11px] font-bold uppercase text-white/45">New Subtotal</p>
            <p className="text-base font-extrabold text-white tabular-nums">
              {peso(totals.subTotal)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-white/45">12% VAT</p>
            <p className="text-base font-extrabold text-white/80 tabular-nums">
              {peso(totals.vatAmount)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-white/45">New Total</p>
            <p className="text-lg font-extrabold text-emerald-300 tabular-nums">
              {peso(totals.totalAmount)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase text-white/45">Recalc Change</p>
            <p className="text-base font-extrabold text-amber-300 tabular-nums">
              {peso(changeDue)}
            </p>
          </div>
        </div>

        {err && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-400/35 bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-200">
            <Icon name="error_outline" className="text-[18px]" />
            <span>{err}</span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Btn size="lg" variant="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn type="submit" size="lg" variant="success" icon="save" disabled={saving}>
            {saving ? 'Updating Stock & Order...' : 'Save Order Update'}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
