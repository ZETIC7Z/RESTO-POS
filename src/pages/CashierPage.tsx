import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrderEditorModal } from '../components/OrderEditorModal';
import { QrModal } from '../components/QrModal';
import { ReceiptModal } from '../components/ReceiptModal';
import {
  BrandLogo,
  Btn,
  cx,
  DeveloperFooter,
  Icon,
  Modal,
  useFullscreen,
  useNow,
} from '../components/ui';
import {
  CartLine,
  CATEGORIES,
  CategoryId,
  Customer,
  dayKey,
  DiscountType,
  fmtDateTime,
  fmtTime,
  OrderRow,
  PaymentMethod,
  PAYMENT_METHODS,
  peso,
  Product,
  ReceiptSnapshot,
  ReceiptSnapshotItem,
} from '../data/posData';
import { useAuth } from '../lib/AuthContext';
import { computeOrderTotals } from '../lib/pricing';
import { supabase } from '../lib/supabase';

function LiveHeaderClock() {
  const now = useNow(1000);
  return <span className="font-mono text-white/75">{fmtDateTime(now)}</span>;
}

export function CashierPage() {
  const { profile, storeSettings, activeShift, signOutAndEndShift } = useAuth();
  const navigate = useNavigate();
  const { isFs, toggle: toggleFs } = useFullscreen();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [todayOrders, setTodayOrders] = useState<OrderRow[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<'ALL' | CategoryId>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState<'Dine-In' | 'Take-Out'>('Dine-In');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [tenderedInput, setTenderedInput] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [checkoutErr, setCheckoutErr] = useState('');

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [showOrdersDrawer, setShowOrdersDrawer] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderRow | null>(null);
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);
  const [voidBusyId, setVoidBusyId] = useState<string | null>(null);

  const [receiptState, setReceiptState] = useState<{
    order: OrderRow;
    autoPrint: boolean;
  } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (!error && data) {
      setProducts(
        data.map((p) => ({
          ...p,
          price: Number(p.price),
          stock_qty: Number(p.stock_qty),
        }))
      );
    }
    setLoadingMenu(false);
  }, []);

  const fetchCustomers = useCallback(async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });
    if (data) {
      setCustomers(
        data.map((c) => ({
          ...c,
          total_spent: Number(c.total_spent) || 0,
          visit_count: Number(c.visit_count) || 0,
        }))
      );
    }
  }, []);

  const fetchTodayOrders = useCallback(async () => {
    const today = dayKey(Date.now());
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_date', today)
      .order('created_at', { ascending: false });

    if (data) {
      setTodayOrders(data as OrderRow[]);
    }
  }, []);

  useEffect(() => {
    void fetchProducts();
    void fetchCustomers();
    void fetchTodayOrders();

    const channel = supabase
      .channel('cashier-pos-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => void fetchProducts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => void fetchTodayOrders()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchProducts, fetchCustomers, fetchTodayOrders]);

  const visibleProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter((p) => (selectedCategory === 'ALL' ? true : p.category === selectedCategory))
      .filter((p) =>
        q ? p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) : true
      );
  }, [products, selectedCategory, searchQuery]);

  const totals = useMemo(
    () => computeOrderTotals(cart, discountType, 12),
    [cart, discountType]
  );

  const addToCart = (product: Product) => {
    if (!product.is_available || product.stock_qty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_qty) return prev;
        return prev.map((l) =>
          l.product_id === product.id
            ? { ...l, quantity: l.quantity + 1, max_stock: product.stock_qty }
            : l
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          unit_price: Number(product.price),
          quantity: 1,
          image_url: product.image_url,
          max_stock: product.stock_qty,
        },
      ];
    });
  };

  const adjustCartQty = (productId: string, delta: number) => {
    const liveProd = products.find((p) => p.id === productId);
    const stockCap = liveProd ? liveProd.stock_qty : 999;

    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product_id !== productId) return l;
          const next = Math.min(stockCap, l.quantity + delta);
          return { ...l, quantity: next, max_stock: stockCap };
        })
        .filter((l) => l.quantity > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscountType('none');
    setSelectedCustomer(null);
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod('Cash');
    setTenderedInput(String(Math.ceil(totals.totalAmount)));
    setPaymentRef('');
    setCheckoutErr('');
    setShowCheckoutModal(true);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || cart.length === 0) return;

    setSubmittingOrder(true);
    setCheckoutErr('');
    try {
      const tendered =
        paymentMethod === 'Cash'
          ? Math.max(totals.totalAmount, Number(tenderedInput) || totals.totalAmount)
          : totals.totalAmount;
      const changeDue = Math.max(0, Math.round((tendered - totals.totalAmount) * 100) / 100);

      const itemsPayload: ReceiptSnapshotItem[] = cart.map((l) => ({
        product_id: l.product_id,
        product_name: l.product_name,
        quantity: l.quantity,
        unit_price: l.unit_price,
        line_total: Math.round(l.unit_price * l.quantity * 100) / 100,
      }));

      const snapshot: ReceiptSnapshot = {
        store_name: storeSettings.store_name,
        address: storeSettings.address,
        tin: storeSettings.tin,
        order_type: orderType,
        payment_ref: paymentRef.trim() || undefined,
        discount_label:
          discountType === 'senior_pwd'
            ? 'Senior Citizen / PWD 20%'
            : discountType === 'promo'
            ? 'Promo 10%'
            : undefined,
        sub_total: totals.subTotal,
        less_vat: totals.lessVat,
        vat_exempt: totals.vatExempt,
        items: itemsPayload,
      };

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('process_checkout', {
        p_cashier_id: profile.id,
        p_cashier_name: profile.full_name,
        p_customer_id: selectedCustomer?.id ?? null,
        p_customer_name: selectedCustomer?.name ?? 'Walk-in Customer',
        p_payment_method: paymentMethod,
        p_discount_type: discountType,
        p_vatable_sales: totals.vatableSales,
        p_vat_amount: totals.vatAmount,
        p_discount_amount: totals.discountAmount,
        p_total_amount: totals.totalAmount,
        p_amount_paid: tendered,
        p_change_due: changeDue,
        p_receipt_snapshot: snapshot,
        p_items: itemsPayload,
      });

      if (rpcErr) throw rpcErr;

      const orderId = (rpcRes as { order_id?: string })?.order_id;
      let createdOrder: OrderRow | null = null;
      if (orderId) {
        const { data: fetched } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .single();
        if (fetched) createdOrder = fetched as OrderRow;
      }

      setShowCheckoutModal(false);
      setMobileCartOpen(false);
      clearCart();

      await Promise.all([fetchProducts(), fetchTodayOrders(), fetchCustomers()]);

      if (createdOrder) {
        setReceiptState({ order: createdOrder, autoPrint: true });
      }
    } catch (error) {
      setCheckoutErr(error instanceof Error ? error.message : 'Checkout failed.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    setSavingCustomer(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: newCustName.trim(),
          phone: newCustPhone.trim() || null,
        })
        .select('*')
        .single();

      if (error) throw error;
      if (data) {
        const cust = {
          ...data,
          total_spent: Number(data.total_spent) || 0,
          visit_count: Number(data.visit_count) || 0,
        };
        setCustomers((prev) => [...prev, cust]);
        setSelectedCustomer(cust);
        setNewCustName('');
        setNewCustPhone('');
        setShowCustomerModal(false);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not create customer.');
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleVoidOrder = async (orderId: string) => {
    setVoidBusyId(orderId);
    try {
      const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId });
      if (error) throw error;
      setConfirmVoidId(null);
      await Promise.all([fetchTodayOrders(), fetchProducts()]);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to void order.');
    } finally {
      setVoidBusyId(null);
    }
  };

  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden select-none">
      {/* Top Cashier Header */}
      <header className="glass z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-5">
        <div className="flex items-center gap-2.5">
          <BrandLogo size="md" alt={storeSettings.store_name} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight text-white sm:text-base">
                {storeSettings.store_name}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Cloud Sync
              </span>
            </div>
            <p className="text-[11px] text-white/55">
              {storeSettings.address} · <LiveHeaderClock />
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {profile?.role === 'admin' && (
            <Btn
              size="md"
              variant="ghost"
              icon="admin_panel_settings"
              onClick={() => navigate('/admin')}
            >
              Admin Dashboard
            </Btn>
          )}
          <Btn
            size="md"
            variant="soft"
            icon="receipt_long"
            onClick={() => setShowOrdersDrawer(true)}
          >
            Today&apos;s Orders ({todayOrders.length})
          </Btn>
          <Btn size="md" variant="ghost" icon="soup_kitchen" onClick={() => navigate('/crew')}>
            Kitchen
          </Btn>
          <Btn size="md" variant="ghost" icon="tv" onClick={() => navigate('/display')}>
            TV Display
          </Btn>
          <Btn size="md" variant="ghost" icon="qr_code_2" onClick={() => setShowQr(true)}>
            <span className="hidden sm:inline">QR</span>
          </Btn>
          <Btn
            size="md"
            variant="ghost"
            icon={isFs ? 'fullscreen_exit' : 'fullscreen'}
            onClick={toggleFs}
            title="Full Screen"
          />

          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-1.5 lg:flex">
            <Icon name="badge" className="text-[18px] text-orange-300" />
            <div className="leading-tight">
              <p className="text-xs font-extrabold text-white">{profile?.full_name}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                {activeShift
                  ? `Clocked In ${fmtTime(activeShift.login_time)}`
                  : profile?.role}
              </p>
            </div>
          </div>

          <Btn
            size="md"
            variant="danger"
            icon="logout"
            onClick={() => void signOutAndEndShift()}
          >
            Log Out / End Shift
          </Btn>
        </div>
      </header>

      {/* Main Split POS Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Categories + Live Menu Grid */}
        <div className="flex flex-1 flex-col overflow-hidden p-3 sm:p-5">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Icon
                  name="search"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-white/40"
                />
                <input
                  type="search"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input h-12 !pl-11 text-sm font-semibold"
                />
              </div>

              <Btn
                size="md"
                variant="primary"
                icon="shopping_cart"
                onClick={() => setMobileCartOpen(true)}
                className="lg:hidden"
              >
                Order ({cartItemCount}) · {peso(totals.totalAmount)}
              </Btn>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={cx(
                  'inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-extrabold transition active:scale-[0.97]',
                  selectedCategory === 'ALL'
                    ? 'chip-active'
                    : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]'
                )}
              >
                <Icon name="apps" className="text-[20px]" />
                All ({products.length})
              </button>
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cx(
                      'inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-extrabold transition active:scale-[0.97]',
                      active
                        ? 'chip-active'
                        : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]'
                    )}
                  >
                    <Icon name={cat.icon} className="text-[20px]" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Menu Grid */}
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            {loadingMenu ? (
              <div className="flex h-64 items-center justify-center text-sm font-bold text-white/50">
                Loading live menu from Supabase...
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="glass-card flex h-72 flex-col items-center justify-center rounded-3xl p-6 text-center">
                <Icon name="restaurant_menu" className="text-5xl text-white/25" />
                <p className="mt-3 text-base font-extrabold text-white">
                  No menu items found
                </p>
                <p className="mt-1 max-w-sm text-xs text-white/55">
                  Ask the Administrator to add products with photos inside Menu &amp; Stock Manager.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((product) => {
                  const soldOut = !product.is_available || product.stock_qty <= 0;
                  const inCart =
                    cart.find((l) => l.product_id === product.id)?.quantity ?? 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      disabled={soldOut}
                      onClick={() => addToCart(product)}
                      className={cx(
                        'glass-card group relative flex flex-col justify-between overflow-hidden rounded-[24px] p-3 text-left transition active:scale-[0.98]',
                        soldOut
                          ? 'cursor-not-allowed opacity-45'
                          : 'cursor-pointer hover:border-orange-400/50 hover:bg-white/[0.07]'
                      )}
                    >
                      <div>
                        <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-black/40 sm:h-36">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-500/20 to-white/5">
                              <Icon
                                name="fastfood"
                                className="text-4xl text-orange-300/60"
                              />
                            </div>
                          )}
                          {inCart > 0 && (
                            <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-extrabold text-black shadow-lg">
                              {inCart}x
                            </span>
                          )}
                          <span
                            className={cx(
                              'absolute bottom-2 right-2 rounded-lg px-2 py-0.5 text-[10px] font-extrabold backdrop-blur-sm',
                              soldOut
                                ? 'bg-red-600/90 text-white'
                                : 'bg-black/75 text-white/85'
                            )}
                          >
                            {soldOut ? 'OUT OF STOCK' : `${product.stock_qty} left`}
                          </span>
                        </div>

                        <p className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-orange-300/80">
                          {product.category}
                        </p>
                        <h3 className="line-clamp-1 text-sm font-extrabold text-white sm:text-base">
                          {product.name}
                        </h3>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-1">
                        <span className="text-base font-extrabold text-emerald-300 tabular-nums sm:text-lg">
                          {peso(product.price)}
                        </span>
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff9a4d] to-[#ff5a1f] text-white shadow">
                          <Icon name="add" className="text-[24px]" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DeveloperFooter className="mt-2 border-t border-white/10 pt-2" />
        </div>

        {/* Right: Order Ticket & Checkout Drawer */}
        <aside
          className={cx(
            'glass z-30 flex w-full flex-col border-l border-white/10 bg-[#10131c]/95 lg:static lg:w-[410px] xl:w-[440px]',
            mobileCartOpen ? 'fixed inset-0' : 'hidden lg:flex'
          )}
        >
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-white">Current Order</h2>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <Btn
                    size="md"
                    variant="danger"
                    icon="delete_sweep"
                    onClick={clearCart}
                    className="!h-10 !px-3 text-xs"
                  >
                    Clear
                  </Btn>
                )}
                <Btn
                  size="md"
                  variant="ghost"
                  icon="close"
                  onClick={() => setMobileCartOpen(false)}
                  className="lg:hidden !h-10 !px-0"
                />
              </div>
            </div>

            {/* Order Type */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['Dine-In', 'Take-Out'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className={cx(
                    'h-12 rounded-xl border text-xs font-extrabold transition active:scale-[0.97]',
                    orderType === t
                      ? 'chip-active'
                      : 'border-white/10 bg-white/[0.04] text-white/65'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Customer CRM Quick Selector */}
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                  Customer CRM
                </p>
                <p className="truncate text-xs font-extrabold text-white">
                  {selectedCustomer
                    ? `${selectedCustomer.name}${
                        selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''
                      }`
                    : 'Walk-in Customer'}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(null)}
                    className="rounded-lg px-2 py-1 text-[11px] font-bold text-red-300 hover:bg-red-500/20"
                  >
                    Reset
                  </button>
                )}
                <Btn
                  size="md"
                  variant="soft"
                  icon="person_search"
                  onClick={() => setShowCustomerModal(true)}
                  className="!h-10 !px-3 text-xs"
                >
                  Select / Add
                </Btn>
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-white/35">
                <Icon name="touch_app" className="text-5xl text-white/20" />
                <p className="mt-2 text-sm font-bold text-white/60">Tap any menu card</p>
                <p className="mt-0.5 max-w-[240px] text-xs">
                  Large tablet buttons deduct stock live in Supabase upon checkout.
                </p>
              </div>
            ) : (
              cart.map((ln) => (
                <div
                  key={ln.product_id}
                  className="glass-card flex items-center justify-between gap-2.5 rounded-2xl p-2.5"
                >
                  {ln.image_url ? (
                    <img
                      src={ln.image_url}
                      alt={ln.product_name}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                      <Icon name="fastfood" className="text-[20px] text-orange-300" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-white">
                      {ln.product_name}
                    </p>
                    <p className="text-xs font-bold text-emerald-300 tabular-nums">
                      {peso(ln.unit_price * ln.quantity)}{' '}
                      <span className="font-normal text-white/40">
                        ({peso(ln.unit_price)} ea)
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustCartQty(ln.product_id, -1)}
                      aria-label={`Decrease ${ln.product_name}`}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-xl font-extrabold text-white active:scale-95"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-extrabold tabular-nums">
                      {ln.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={ln.quantity >= ln.max_stock}
                      onClick={() => adjustCartQty(ln.product_id, 1)}
                      aria-label={`Increase ${ln.product_name}`}
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-xl font-extrabold text-white disabled:opacity-40 active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Discount Toggle + Totals + Pay Button */}
          <div className="border-t border-white/10 bg-[#0d1018] p-4">
            <div className="mb-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('none')}
                className={cx(
                  'h-12 rounded-xl border text-xs font-extrabold transition',
                  discountType === 'none'
                    ? 'chip-active'
                    : 'border-white/10 bg-white/[0.04] text-white/65'
                )}
              >
                Regular (None)
              </button>
              <button
                type="button"
                onClick={() =>
                  setDiscountType((d) => (d === 'senior_pwd' ? 'none' : 'senior_pwd'))
                }
                className={cx(
                  'h-12 rounded-xl border text-xs font-extrabold transition',
                  discountType === 'senior_pwd'
                    ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                    : 'border-white/10 bg-white/[0.04] text-white/65'
                )}
              >
                Senior &amp; PWD (RA 9994)
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Subtotal ({cartItemCount} items)</span>
                <span className="tabular-nums">{peso(totals.subTotal)}</span>
              </div>
              {totals.lessVat > 0 && (
                <div className="flex justify-between text-emerald-300">
                  <span>Less 12% VAT (VAT-Exempt)</span>
                  <span className="tabular-nums">-{peso(totals.lessVat)}</span>
                </div>
              )}
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-amber-300">
                  <span>Senior / PWD 20% Discount</span>
                  <span className="tabular-nums">-{peso(totals.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[11px] text-white/45">
                <span>VATable / Included 12% VAT</span>
                <span className="tabular-nums">
                  {peso(totals.vatableSales)} · {peso(totals.vatAmount)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
                <span className="text-sm font-extrabold uppercase tracking-wider text-white">
                  Total Due
                </span>
                <span className="text-2xl font-extrabold text-emerald-300 tabular-nums">
                  {peso(totals.totalAmount)}
                </span>
              </div>
            </div>

            <Btn
              size="xl"
              variant="success"
              icon="payments"
              disabled={cart.length === 0}
              onClick={openCheckout}
              className="mt-3.5 w-full"
            >
              Checkout &amp; Print ({peso(totals.totalAmount)})
            </Btn>
          </div>
        </aside>
      </div>

      {/* Payment Modal */}
      {showCheckoutModal && (
        <Modal
          title="Complete Checkout & Print 80mm Receipt"
          subtitle={`${orderType} · ${
            selectedCustomer?.name || 'Walk-in Customer'
          } · ${cartItemCount} items`}
          onClose={() => setShowCheckoutModal(false)}
        >
          <form onSubmit={handleCheckoutSubmit} className="space-y-4">
            <div className="glass-card flex items-center justify-between rounded-2xl p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Total Amount Due
                </p>
                <p className="text-3xl font-extrabold text-emerald-300 tabular-nums">
                  {peso(totals.totalAmount)}
                </p>
              </div>
              <div className="text-right text-xs text-white/60">
                <p>VATable: {peso(totals.vatableSales)}</p>
                <p>12% VAT: {peso(totals.vatAmount)}</p>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-white/60">
                Payment Method
              </span>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setPaymentMethod(pm.id)}
                    className={cx(
                      'flex h-16 flex-col items-center justify-center gap-1 rounded-2xl border font-extrabold transition active:scale-[0.98]',
                      paymentMethod === pm.id
                        ? 'chip-active'
                        : 'border-white/10 bg-white/[0.04] text-white/70'
                    )}
                  >
                    <Icon name={pm.icon} className="text-[22px]" />
                    <span className="text-xs">{pm.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'Cash' ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-white/60">
                    Cash Tendered (₱ PHP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={totals.totalAmount}
                    value={tenderedInput}
                    onChange={(e) => setTenderedInput(e.target.value)}
                    className="input h-14 text-xl font-extrabold tabular-nums"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    { label: 'Exact', val: Math.ceil(totals.totalAmount) },
                    { label: '₱100', val: 100 },
                    { label: '₱200', val: 200 },
                    { label: '₱500', val: 500 },
                    { label: '₱1,000', val: 1000 },
                    {
                      label: '+₱100',
                      val: (Number(tenderedInput) || Math.ceil(totals.totalAmount)) + 100,
                    },
                  ].map((b) => (
                    <button
                      key={b.label}
                      type="button"
                      onClick={() => setTenderedInput(String(b.val))}
                      className="h-12 rounded-xl border border-white/15 bg-white/[0.06] text-xs font-extrabold text-orange-200 hover:bg-orange-500/20 active:scale-95"
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <div className="glass-card flex items-center justify-between rounded-2xl px-4 py-3">
                  <span className="text-sm font-bold text-white/70">Change (Sukli):</span>
                  <span className="text-2xl font-extrabold text-amber-300 tabular-nums">
                    {peso(Math.max(0, (Number(tenderedInput) || 0) - totals.totalAmount))}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-white/60">
                  {paymentMethod} Reference No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder={`Enter ${paymentMethod} reference code`}
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="input h-14"
                />
              </div>
            )}

            {checkoutErr && (
              <div className="rounded-2xl border border-red-400/35 bg-red-500/15 px-4 py-3 text-xs font-semibold text-red-200">
                {checkoutErr}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Btn size="xl" variant="ghost" onClick={() => setShowCheckoutModal(false)}>
                Cancel
              </Btn>
              <Btn
                type="submit"
                size="xl"
                variant="success"
                icon="print"
                disabled={submittingOrder}
              >
                {submittingOrder ? 'Processing...' : 'Complete & Print'}
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Customer CRM Modal */}
      {showCustomerModal && (
        <Modal
          title="Customer CRM Lookup & Quick Add"
          subtitle="Track repeat loyal guests at EL Farm Cafe"
          onClose={() => setShowCustomerModal(false)}
          wide
        >
          <div className="space-y-5">
            <form
              onSubmit={handleAddCustomer}
              className="glass-card grid gap-2.5 rounded-2xl p-4 sm:grid-cols-12"
            >
              <input
                type="text"
                placeholder="New customer full name"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className="input sm:col-span-5"
                required
              />
              <input
                type="text"
                placeholder="Mobile / Phone (optional)"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                className="input sm:col-span-4"
              />
              <Btn
                type="submit"
                size="lg"
                variant="success"
                icon="person_add"
                disabled={savingCustomer}
                className="sm:col-span-3"
              >
                {savingCustomer ? 'Saving...' : 'Add Customer'}
              </Btn>
            </form>

            <div>
              <input
                type="search"
                placeholder="Search customer name or phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="input mb-3"
              />
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredCustomers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-white/45">
                    No customers found in Supabase yet. Add one above!
                  </p>
                ) : (
                  filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setShowCustomerModal(false);
                      }}
                      className="glass-card flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition hover:border-orange-400/50"
                    >
                      <div>
                        <p className="text-sm font-extrabold text-white">{c.name}</p>
                        <p className="text-xs text-white/50">
                          {c.phone || 'No phone'} · {c.visit_count} visits · Spent{' '}
                          {peso(c.total_spent)}
                        </p>
                      </div>
                      <span className="rounded-xl bg-orange-500/20 px-3 py-1.5 text-xs font-extrabold text-orange-300">
                        Select
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Today's Submitted Orders Drawer/Modal (Edit / Void / Reprint) */}
      {showOrdersDrawer && (
        <Modal
          title={`Today's Submitted Orders (${todayOrders.length})`}
          subtitle="Reprint 80mm receipt, edit submitted items, or void/cancel to restore stock"
          onClose={() => {
            setShowOrdersDrawer(false);
            setConfirmVoidId(null);
          }}
          wide
        >
          {todayOrders.length === 0 ? (
            <div className="py-12 text-center text-white/45">
              <Icon name="receipt_long" className="text-4xl text-white/25" />
              <p className="mt-2 text-sm font-bold">No orders submitted today yet.</p>
            </div>
          ) : (
            <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {todayOrders.map((o) => {
                const isCancelled = o.status === 'cancelled';
                const itemsList =
                  o.order_items && o.order_items.length > 0
                    ? o.order_items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')
                    : (o.receipt_snapshot?.items || [])
                        .map((i) => `${i.quantity}x ${i.product_name}`)
                        .join(', ');

                return (
                  <div
                    key={o.id}
                    className={cx(
                      'glass-card flex flex-col justify-between gap-3 rounded-2xl p-4 sm:flex-row sm:items-center',
                      isCancelled && 'opacity-55'
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-orange-500 px-2 py-0.5 font-mono text-xs font-extrabold text-white">
                          #{String(o.order_number).padStart(2, '0')}
                        </span>
                        <span className="font-mono text-xs font-bold text-orange-300">
                          {o.or_number}
                        </span>
                        <span className="text-xs text-white/55">{fmtTime(o.created_at)}</span>
                        <span
                          className={cx(
                            'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase',
                            o.status === 'preparing'
                              ? 'bg-amber-500/20 text-amber-300'
                              : o.status === 'ready'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : o.status === 'completed'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-red-500/25 text-red-300'
                          )}
                        >
                          {o.status}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white">
                        {o.customer_name} · {o.payment_method} ·{' '}
                        <span className="text-emerald-300">{peso(o.total_amount)}</span>
                      </p>
                      <p className="text-xs text-white/60">{itemsList}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Btn
                        size="md"
                        variant="ghost"
                        icon="print"
                        onClick={() => setReceiptState({ order: o, autoPrint: false })}
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
                          >
                            Edit
                          </Btn>
                          {confirmVoidId === o.id ? (
                            <Btn
                              size="md"
                              variant="danger"
                              icon="warning"
                              disabled={voidBusyId === o.id}
                              onClick={() => void handleVoidOrder(o.id)}
                            >
                              {voidBusyId === o.id ? 'Voiding...' : 'Confirm Void'}
                            </Btn>
                          ) : (
                            <Btn
                              size="md"
                              variant="danger"
                              icon="cancel"
                              onClick={() => setConfirmVoidId(o.id)}
                            >
                              Void
                            </Btn>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {editingOrder && (
        <OrderEditorModal
          order={editingOrder}
          products={products}
          onClose={() => setEditingOrder(null)}
          onSaved={async () => {
            await Promise.all([fetchTodayOrders(), fetchProducts()]);
          }}
        />
      )}

      {receiptState && (
        <ReceiptModal
          order={receiptState.order}
          settings={storeSettings}
          autoPrint={receiptState.autoPrint}
          onClose={() => setReceiptState(null)}
        />
      )}

      {showQr && (
        <QrModal
          storeName={storeSettings.store_name}
          defaultPath="/cashier"
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
}
