import React, { useEffect, useMemo, useState } from 'react';
import {
  KitchenView,
  MenuManagerView,
  SettingsView,
  TablesView,
} from './components/AdminPanels';
import { LoginScreen } from './components/LoginScreen';
import { QrModal } from './components/QrModal';
import { ReceiptModal } from './components/ReceiptModal';
import { SalesCalendarView } from './components/SalesCalendarView';
import {
  Btn,
  cx,
  Icon,
  Modal,
  requestFullscreen,
  useFullscreen,
  useNow,
} from './components/ui';
import {
  Addon,
  ADDONS,
  CATEGORIES,
  CategoryId,
  DISCOUNTS,
  fmtDateTime,
  MenuItem,
  Order,
  OrderLine,
  OrderType,
  PaymentMethod,
  PAYMENT_METHODS,
  peso,
  Session,
  TableTab,
  uid,
} from './data/posData';
import { calcTotals, lineKey, lineUnit } from './lib/pricing';
import { usePosStore } from './lib/usePosStore';

type NavTab = 'pos' | 'tables' | 'kitchen' | 'income' | 'menu' | 'settings';

const SESSION_KEY = 'ligaya.pos.session.v2';

function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function HeaderClock() {
  const now = useNow(1000);
  return <span className="font-mono text-white/75">{fmtDateTime(now)}</span>;
}

export function App() {
  const { db, lanIp, synced, commit, resetAll } = usePosStore();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [activeTab, setActiveTab] = useState<NavTab>('pos');
  const [showQrModal, setShowQrModal] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const { isFs, toggle: toggleFs } = useFullscreen();

  // POS Register State
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | CategoryId>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('Dine-In');
  const [selectedTable, setSelectedTable] = useState<string>('Table 1');
  const [customerName, setCustomerName] = useState<string>('');
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [discountId, setDiscountId] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Add-on Customizer Modal State
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);

  // Payment Checkout Modal State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [tenderedInput, setTenderedInput] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

  // Compute LAN URL for QR Code
  const lanUrl = useMemo(() => {
    const port = window.location.port ? `:${window.location.port}` : '';
    const host =
      lanIp && lanIp !== '127.0.0.1' && lanIp !== 'localhost'
        ? lanIp
        : window.location.hostname;
    return `${window.location.protocol}//${host}${port}/`;
  }, [lanIp]);

  // Persist session in sessionStorage & enforce role tab access
  useEffect(() => {
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    if (session?.role === 'cashier' && ['income', 'menu', 'settings'].includes(activeTab)) {
      setActiveTab('pos');
    }
  }, [session, activeTab]);

  const activeDiscount = useMemo(
    () => DISCOUNTS.find((d) => d.id === discountId) ?? null,
    [discountId]
  );

  const totals = useMemo(
    () => calcTotals(cart, activeDiscount, db.settings.vatRate),
    [cart, activeDiscount, db.settings.vatRate]
  );

  const visibleMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return db.menuItems
      .filter((m) => !m.deleted)
      .filter((m) => (selectedCategory === 'ALL' ? true : m.category === selectedCategory))
      .filter((m) =>
        q
          ? m.title.toLowerCase().includes(q) || m.description.toLowerCase().includes(q)
          : true
      );
  }, [db.menuItems, selectedCategory, searchQuery]);

  const addToCart = (item: MenuItem, addons: Addon[] = []) => {
    if (!item.available || item.stock <= 0) return;
    const key = lineKey(item.id, addons);
    setCart((prev) => {
      const idx = prev.findIndex((ln) => lineKey(ln.menuId, ln.addons) === key);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          id: uid('ln'),
          menuId: item.id,
          title: item.title,
          image: item.image,
          price: item.price,
          qty: 1,
          addons,
        },
      ];
    });
  };

  const changeLineQty = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ln) => (ln.id === lineId ? { ...ln, qty: ln.qty + delta } : ln))
        .filter((ln) => ln.qty > 0)
    );
  };

  const clearCart = () => {
    setCart([]);
    setDiscountId(null);
    setCustomerName('');
    setActiveTabId(null);
  };

  const handleHoldTableTab = () => {
    if (cart.length === 0 || !session) return;
    const nowTs = Date.now();
    const tabLabel = orderType === 'Dine-In' ? selectedTable : orderType;
    const existing = db.tabs.find(
      (t) => !t.deleted && (t.id === activeTabId || (orderType === 'Dine-In' && t.table === tabLabel))
    );
    const nextTab: TableTab = {
      id: existing?.id ?? uid('tab'),
      table: tabLabel,
      orderType,
      customerName: customerName.trim() || `${tabLabel} Guest`,
      items: cart,
      discountId,
      kitchenStatus: existing?.kitchenStatus ?? 'New',
      openedAt: existing?.openedAt ?? nowTs,
      updatedAt: nowTs,
      cashier: session.name,
    };
    commit({ tabs: [nextTab] });
    clearCart();
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    setPaymentMethod('Cash');
    setTenderedInput(String(Math.ceil(totals.total)));
    setPaymentRef('');
    setShowCheckoutModal(true);
  };

  const completeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !session) return;

    const tenderedNum =
      paymentMethod === 'Cash'
        ? Math.max(totals.total, Number(tenderedInput) || totals.total)
        : totals.total;
    const changeNum = Math.max(0, +(tenderedNum - totals.total).toFixed(2));
    const nowTs = Date.now();

    const newOrder: Order = {
      id: uid('ord'),
      receiptNo: '',
      queueNo: 0,
      createdAt: nowTs,
      updatedAt: nowTs,
      orderType,
      table: orderType === 'Dine-In' ? selectedTable : orderType,
      customerName: customerName.trim() || 'Walk-in Guest',
      cashier: session.name,
      items: cart,
      discountCode: activeDiscount?.code,
      ...totals,
      tendered: tenderedNum,
      change: changeNum,
      payment: paymentMethod,
      paymentRef: paymentRef.trim() || undefined,
      kitchenStatus: 'New',
      status: 'paid',
    };

    // Decrement stock for sold items
    const qtyByMenu = new Map<string, number>();
    cart.forEach((ln) => qtyByMenu.set(ln.menuId, (qtyByMenu.get(ln.menuId) ?? 0) + ln.qty));
    const updatedMenu: MenuItem[] = [];
    db.menuItems.forEach((m) => {
      const sold = qtyByMenu.get(m.id);
      if (sold) {
        updatedMenu.push({
          ...m,
          stock: Math.max(0, m.stock - sold),
          updatedAt: nowTs,
        });
      }
    });

    // If this order came from an open table tab, mark the tab deleted
    const closedTabs: TableTab[] = [];
    if (activeTabId) {
      const found = db.tabs.find((t) => t.id === activeTabId);
      if (found) closedTabs.push({ ...found, deleted: true, updatedAt: nowTs });
    }

    commit({
      orders: [newOrder],
      menuItems: updatedMenu.length ? updatedMenu : undefined,
      tabs: closedTabs.length ? closedTabs : undefined,
    });

    setShowCheckoutModal(false);
    setMobileCartOpen(false);
    clearCart();
    // Show Official Receipt modal (with fallback OR# if offline before server roundtrip)
    setReceiptOrder({
      ...newOrder,
      receiptNo: `OR-${String(db.counters.receipt + 1).padStart(6, '0')}`,
      queueNo: (db.counters.queue % 99) + 1,
    });
  };

  // If not logged in, show the Fast-Food / Restaurant POS Login Screen
  if (!session) {
    return (
      <>
        <LoginScreen
          settings={db.settings}
          lanUrl={lanUrl}
          onLogin={(sess) => {
            setSession(sess);
            setActiveTab('pos');
          }}
          onOpenQr={() => setShowQrModal(true)}
        />
        {showQrModal && (
          <QrModal
            url={lanUrl}
            storeName={db.settings.storeName}
            onClose={() => setShowQrModal(false)}
          />
        )}
      </>
    );
  }

  const isAdmin = session.role === 'admin';
  const activeKitchenCount =
    db.orders.filter((o) => !o.deleted && o.status === 'paid' && o.kitchenStatus !== 'Served')
      .length + db.tabs.filter((t) => !t.deleted && t.kitchenStatus !== 'Served').length;
  const openTabsCount = db.tabs.filter((t) => !t.deleted).length;
  const cartItemCount = cart.reduce((s, i) => s + i.qty, 0);

  const navItems: { id: NavTab; label: string; icon: string; badge?: number; adminOnly?: boolean }[] =
    [
      { id: 'pos', label: 'POS Register', icon: 'point_of_sale' },
      { id: 'tables', label: 'Tables', icon: 'table_restaurant', badge: openTabsCount },
      { id: 'kitchen', label: 'Kitchen', icon: 'soup_kitchen', badge: activeKitchenCount },
      { id: 'income', label: 'Sales & Calendar', icon: 'calendar_month', adminOnly: true },
      { id: 'menu', label: 'Menu & Stock', icon: 'restaurant_menu', adminOnly: true },
      { id: 'settings', label: 'Settings', icon: 'tune', adminOnly: true },
    ];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden select-none">
      {/* Top Glass Navigation Header */}
      <header className="glass z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-5 xl:flex-nowrap">
        {/* Left: Brand Identity */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff9a4d] to-[#ff5a1f] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_24px_-6px_rgba(255,96,32,0.85)]">
            <Icon name="restaurant" className="text-[22px] text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight text-white sm:text-base">
                {db.settings.storeName}
              </h1>
              <span
                className={cx(
                  'hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider sm:inline-flex',
                  synced === 'online'
                    ? 'border border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
                    : 'border border-amber-400/30 bg-amber-500/15 text-amber-300'
                )}
              >
                <span
                  className={cx(
                    'h-1.5 w-1.5 rounded-full',
                    synced === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
                  )}
                />
                {synced === 'online' ? 'LAN Synced' : 'Local Mode'}
              </span>
            </div>
            <p className="text-[11px] text-white/55">
              {db.settings.address} · <HeaderClock />
            </p>
          </div>
        </div>

        {/* Center: Touch-Friendly Navigation Tabs */}
        <nav className="flex items-center gap-1.5 overflow-x-auto py-0.5" aria-label="Main POS Views">
          {navItems
            .filter((item) => (item.adminOnly ? isAdmin : true))
            .map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={cx(
                    'relative inline-flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-extrabold transition active:scale-[0.98] sm:text-sm',
                    active
                      ? 'chip-active'
                      : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.09] hover:text-white'
                  )}
                >
                  <Icon name={item.icon} className="text-[19px]" />
                  <span>{item.label}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span
                      className={cx(
                        'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold tabular-nums',
                        active ? 'bg-black/35 text-white' : 'bg-orange-500 text-white'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>

        {/* Right: QR Code Button + FullScreen Button + Role Badge + Sign Out */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Btn
            size="md"
            variant="soft"
            icon="qr_code_2"
            onClick={() => setShowQrModal(true)}
            title="Show scannable QR code to open POS on tablet or mobile"
            className="!px-3"
          >
            <span className="hidden sm:inline">View QR</span>
          </Btn>

          <Btn
            size="md"
            variant="ghost"
            icon={isFs ? 'fullscreen_exit' : 'fullscreen'}
            onClick={toggleFs}
            title="Toggle full-screen tablet mode (hides browser URL bar)"
            className="!px-3"
          >
            <span className="hidden 2xl:inline">{isFs ? 'Exit Full' : 'Full Screen'}</span>
          </Btn>

          <div className="hidden items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 xl:flex">
            <Icon
              name={isAdmin ? 'admin_panel_settings' : 'badge'}
              className={cx('text-[18px]', isAdmin ? 'text-emerald-300' : 'text-orange-300')}
            />
            <div className="leading-tight">
              <p className="text-xs font-extrabold text-white">{session.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                {session.role}
              </p>
            </div>
          </div>

          <Btn
            size="md"
            variant="danger"
            icon="logout"
            onClick={() => setSession(null)}
            title="Sign out / Switch user"
            className="!px-3"
          >
            <span className="hidden sm:inline">Sign Out</span>
          </Btn>
        </div>
      </header>

      {/* Main Workspace Area */}
      {activeTab === 'pos' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Category Bar + Food Grid */}
          <div className="flex flex-1 flex-col overflow-hidden p-3 sm:p-5">
            {/* Search & Large Category Pills */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Icon
                    name="search"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-white/40"
                  />
                  <input
                    type="search"
                    placeholder="Search Silog, Inasal, Burger, Halo-Halo, Drinks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="input h-12 !pl-11 text-sm font-semibold"
                  />
                </div>

                {/* Mobile Cart Button */}
                <Btn
                  size="md"
                  variant="primary"
                  icon="shopping_cart"
                  onClick={() => setMobileCartOpen(true)}
                  className="lg:hidden"
                >
                  Order ({cartItemCount}) · {peso(totals.total)}
                </Btn>
              </div>

              {/* Large Touch Category Buttons */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={cx(
                    'inline-flex h-13 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-extrabold transition active:scale-[0.97]',
                    selectedCategory === 'ALL'
                      ? 'chip-active'
                      : 'border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.09]'
                  )}
                >
                  <Icon name="apps" className="text-[20px]" />
                  All Menu ({db.menuItems.filter((m) => !m.deleted).length})
                </button>
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cx(
                        'inline-flex h-13 shrink-0 items-center gap-2 rounded-2xl border px-4 text-sm font-extrabold transition active:scale-[0.97]',
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

            {/* Scrollable Food Menu Grid */}
            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
                {visibleMenu.map((item) => {
                  const soldOut = !item.available || item.stock <= 0;
                  const inCartQty = cart
                    .filter((ln) => ln.menuId === item.id)
                    .reduce((s, ln) => s + ln.qty, 0);

                  return (
                    <div
                      key={item.id}
                      onClick={() => !soldOut && addToCart(item)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!soldOut) addToCart(item);
                        }
                      }}
                      className={cx(
                        'glass-card group relative flex flex-col justify-between overflow-hidden rounded-[24px] p-3 text-left transition active:scale-[0.98]',
                        soldOut
                          ? 'cursor-not-allowed opacity-45'
                          : 'cursor-pointer hover:border-orange-400/50 hover:bg-white/[0.07]'
                      )}
                    >
                      <div>
                        <div className="relative h-32 w-full overflow-hidden rounded-2xl bg-black/30 sm:h-36">
                          <img
                            src={item.image}
                            alt={item.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                          {item.popular && (
                            <span className="absolute left-2 top-2 rounded-lg bg-orange-500/90 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow">
                              ★ Bestseller
                            </span>
                          )}
                          {inCartQty > 0 && (
                            <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-extrabold text-black shadow-lg">
                              {inCartQty}x
                            </span>
                          )}
                          <span className="absolute bottom-2 right-2 rounded-lg bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white/80 backdrop-blur-sm">
                            {soldOut ? 'SOLD OUT' : `${item.stock} left`}
                          </span>
                        </div>

                        <h3 className="mt-2.5 line-clamp-1 text-sm font-extrabold text-white sm:text-base">
                          {item.title}
                        </h3>
                        <p className="mt-0.5 line-clamp-1 text-xs text-white/50">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 pt-1">
                        <span className="text-base font-extrabold text-orange-300 tabular-nums sm:text-lg">
                          {peso(item.price)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomizingItem(item);
                              setSelectedAddons([]);
                            }}
                            disabled={soldOut}
                            title="Add extras (Egg, Rice, Gravy)"
                            className="flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-2.5 text-xs font-bold text-white/80 hover:bg-white/[0.14]"
                          >
                            +Extras
                          </button>
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-b from-[#ff9a4d] to-[#ff5a1f] text-white shadow">
                            <Icon name="add" className="text-[22px]" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Subtle Developer Footer Bar Inside Register */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 text-[11px] text-white/45">
              <div className="flex items-center gap-2">
                <img src="/zeticuz-logo.svg" alt="ZETICUZ" className="h-3.5 w-3.5 opacity-80" />
                <span className="font-semibold text-white/65">
                  SITE DEVELOPED BY: Sam Pangilinan · © 2026
                </span>
                <a
                  href="https://www.zeticuz.xyz/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 font-bold text-orange-300 hover:border-orange-400/40"
                >
                  Developer Portfolio ↗
                </a>
              </div>
              <button
                type="button"
                onClick={() => {
                  requestFullscreen();
                  setShowQrModal(true);
                }}
                className="font-mono text-white/60 hover:text-orange-300"
              >
                Tablet LAN: {lanUrl}
              </button>
            </div>
          </div>

          {/* Right: Order Ticket & Checkout Drawer */}
          <aside
            className={cx(
              'glass z-30 flex w-full flex-col border-l border-white/10 bg-[#10131c]/95 lg:static lg:w-[410px] xl:w-[440px]',
              mobileCartOpen
                ? 'fixed inset-0'
                : 'hidden lg:flex'
            )}
          >
            {/* Order Header */}
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white">Current Order Ticket</h2>
                  {activeTabId && (
                    <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[10px] font-extrabold text-orange-300">
                      Tab Loaded
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
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

              {/* Order Type Selector (Large Touch Buttons) */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(['Dine-In', 'Take-Out', 'Delivery'] as OrderType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={cx(
                      'h-11 rounded-xl border text-xs font-extrabold transition active:scale-[0.97]',
                      orderType === t
                        ? 'chip-active'
                        : 'border-white/10 bg-white/[0.04] text-white/65'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Table + Customer Name */}
              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {orderType === 'Dine-In' ? (
                  <select
                    aria-label="Select Dining Table"
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="input !h-11 text-xs font-bold"
                  >
                    {Array.from({ length: db.settings.tableCount }, (_, i) => `Table ${i + 1}`).map(
                      (tbl) => (
                        <option key={tbl} value={tbl} className="bg-[#11141d] text-white">
                          {tbl}
                        </option>
                      )
                    )}
                  </select>
                ) : (
                  <div className="flex h-11 items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-bold text-white/60">
                    Counter · {orderType}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Guest name (optional)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="input !h-11 text-xs"
                />
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {cart.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-white/35">
                  <Icon name="touch_app" className="text-5xl text-white/20" />
                  <p className="mt-2 text-sm font-bold text-white/60">Tap any dish to add</p>
                  <p className="mt-0.5 max-w-[230px] text-xs">
                    All buttons are sized for fast one-hand touch operation on tablets.
                  </p>
                </div>
              ) : (
                cart.map((ln) => {
                  const unit = lineUnit(ln);
                  return (
                    <div
                      key={ln.id}
                      className="glass-card flex items-center justify-between gap-2.5 rounded-2xl p-2.5"
                    >
                      <img
                        src={ln.image}
                        alt={ln.title}
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-white">{ln.title}</p>
                        {ln.addons.length > 0 && (
                          <p className="truncate text-[11px] text-orange-300">
                            + {ln.addons.map((a) => a.name).join(', ')}
                          </p>
                        )}
                        <p className="text-xs font-bold text-emerald-300 tabular-nums">
                          {peso(unit * ln.qty)}{' '}
                          <span className="font-normal text-white/40">({peso(unit)} ea)</span>
                        </p>
                      </div>

                      {/* Large Touch +/- Stepper */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => changeLineQty(ln.id, -1)}
                          aria-label={`Decrease ${ln.title}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-lg font-extrabold text-white active:scale-95"
                        >
                          −
                        </button>
                        <span className="w-6 text-center text-sm font-extrabold tabular-nums">
                          {ln.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => changeLineQty(ln.id, 1)}
                          aria-label={`Increase ${ln.title}`}
                          className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-lg font-extrabold text-white active:scale-95"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Discount Chips + Totals + Pay Button */}
            <div className="border-t border-white/10 bg-[#0d1018] p-4">
              {/* Promo & Senior/PWD Discount Chips */}
              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                {DISCOUNTS.map((d) => {
                  const active = discountId === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDiscountId(active ? null : d.id)}
                      className={cx(
                        'h-9 shrink-0 rounded-xl border px-3 text-[11px] font-extrabold transition',
                        active
                          ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                          : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white'
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              {/* Transparent VAT & Total Summary */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal ({cartItemCount} items)</span>
                  <span className="tabular-nums">{peso(totals.subTotal)}</span>
                </div>
                {totals.lessVat > 0 && (
                  <div className="flex justify-between text-emerald-300">
                    <span>Less 12% VAT (SC/PWD Exempt)</span>
                    <span className="tabular-nums">-{peso(totals.lessVat)}</span>
                  </div>
                )}
                {totals.discount > 0 && (
                  <div className="flex justify-between text-amber-300">
                    <span>Discount ({activeDiscount?.code})</span>
                    <span className="tabular-nums">-{peso(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-white/45">
                  <span>Included {db.settings.vatRate}% VAT</span>
                  <span className="tabular-nums">{peso(totals.vat)}</span>
                </div>
                <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
                  <span className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Total Due
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-300 tabular-nums">
                    {peso(totals.total)}
                  </span>
                </div>
              </div>

              {/* Large Touch Action Buttons */}
              <div className="mt-3.5 grid grid-cols-12 gap-2.5">
                <Btn
                  size="xl"
                  variant="ghost"
                  icon="pause_circle"
                  disabled={cart.length === 0}
                  onClick={handleHoldTableTab}
                  className="col-span-4 !px-2 text-xs"
                  title="Send order to kitchen & hold on table tab"
                >
                  Hold Tab
                </Btn>
                <Btn
                  size="xl"
                  variant="success"
                  icon="payments"
                  disabled={cart.length === 0}
                  onClick={openCheckout}
                  className="col-span-8"
                >
                  Pay &amp; Print ({peso(totals.total)})
                </Btn>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">
            {activeTab === 'tables' && (
              <TablesView
                tableCount={db.settings.tableCount}
                tabs={db.tabs}
                vatRate={db.settings.vatRate}
                onOpenTableForOrder={(tableLabel) => {
                  setOrderType('Dine-In');
                  setSelectedTable(tableLabel);
                  setActiveTab('pos');
                }}
                onResumeTab={(tab) => {
                  setOrderType(tab.orderType);
                  setSelectedTable(tab.table);
                  setCustomerName(tab.customerName);
                  setCart(tab.items);
                  setDiscountId(tab.discountId ?? null);
                  setActiveTabId(tab.id);
                  setActiveTab('pos');
                }}
                onCloseTab={(tab) =>
                  commit({ tabs: [{ ...tab, deleted: true, updatedAt: Date.now() }] })
                }
              />
            )}

            {activeTab === 'kitchen' && (
              <KitchenView
                orders={db.orders}
                tabs={db.tabs}
                onAdvanceOrderKitchen={(ord, next) =>
                  commit({
                    orders: [{ ...ord, kitchenStatus: next, updatedAt: Date.now() }],
                  })
                }
                onAdvanceTabKitchen={(tab, next) =>
                  commit({
                    tabs: [{ ...tab, kitchenStatus: next, updatedAt: Date.now() }],
                  })
                }
                onSelectReceipt={(ord) => setReceiptOrder(ord)}
              />
            )}

            {activeTab === 'income' && isAdmin && (
              <SalesCalendarView
                orders={db.orders}
                expenses={db.expenses}
                settings={db.settings}
                session={session}
                onSelectReceipt={(ord) => setReceiptOrder(ord)}
                onUpdateOrder={(updated) => commit({ orders: [updated] })}
                onAddExpense={(exp) => commit({ expenses: [exp] })}
                onDeleteExpense={(exp) =>
                  commit({ expenses: [{ ...exp, deleted: true, updatedAt: Date.now() }] })
                }
              />
            )}

            {activeTab === 'menu' && isAdmin && (
              <MenuManagerView
                menuItems={db.menuItems}
                onSaveItem={(item) => commit({ menuItems: [item] })}
                onDeleteItem={(item) =>
                  commit({
                    menuItems: [{ ...item, deleted: true, updatedAt: Date.now() }],
                  })
                }
              />
            )}

            {activeTab === 'settings' && isAdmin && (
              <SettingsView
                settings={db.settings}
                onSaveSettings={(s) => commit({ settings: s })}
                onResetDemoData={() => void resetAll()}
              />
            )}
          </div>
        </main>
      )}

      {/* Add-on Customizer Modal */}
      {customizingItem && (
        <Modal
          title={`Customize · ${customizingItem.title}`}
          subtitle={`Base price ${peso(customizingItem.price)} — tap extras to include`}
          onClose={() => setCustomizingItem(null)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {ADDONS.map((addon) => {
                const checked = selectedAddons.some((a) => a.id === addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() =>
                      setSelectedAddons((prev) =>
                        checked ? prev.filter((a) => a.id !== addon.id) : [...prev, addon]
                      )
                    }
                    className={cx(
                      'flex h-14 items-center justify-between rounded-2xl border px-4 text-left font-bold transition active:scale-[0.98]',
                      checked
                        ? 'border-orange-400 bg-orange-500/20 text-white'
                        : 'border-white/10 bg-white/[0.04] text-white/75'
                    )}
                  >
                    <span>{addon.name}</span>
                    <span className="text-orange-300">+{peso(addon.price)}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Btn size="lg" variant="ghost" onClick={() => setCustomizingItem(null)}>
                Cancel
              </Btn>
              <Btn
                size="lg"
                variant="success"
                icon="add_shopping_cart"
                onClick={() => {
                  addToCart(customizingItem, selectedAddons);
                  setCustomizingItem(null);
                }}
              >
                Add to Order (
                {peso(
                  customizingItem.price +
                    selectedAddons.reduce((s, a) => s + a.price, 0)
                )}
                )
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Payment & Checkout Modal */}
      {showCheckoutModal && (
        <Modal
          title="Settle Payment & Print Official Receipt"
          subtitle={`${orderType} · ${
            orderType === 'Dine-In' ? selectedTable : 'Counter'
          } · ${cartItemCount} items`}
          onClose={() => setShowCheckoutModal(false)}
        >
          <form onSubmit={completeOrder} className="space-y-4">
            <div className="glass-card flex items-center justify-between rounded-2xl p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Total Amount Due
                </p>
                <p className="text-3xl font-extrabold text-emerald-300 tabular-nums">
                  {peso(totals.total)}
                </p>
              </div>
              <div className="text-right text-xs text-white/60">
                <p>VATable: {peso(totals.vatableSales)}</p>
                <p>12% VAT: {peso(totals.vat)}</p>
              </div>
            </div>

            {/* Large Touch Payment Method Buttons */}
            <div>
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-white/60">
                Select Payment Method
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
                    min={totals.total}
                    value={tenderedInput}
                    onChange={(e) => setTenderedInput(e.target.value)}
                    className="input h-14 text-xl font-extrabold tabular-nums"
                    required
                  />
                </div>

                {/* Quick Peso Bill Denominations */}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[
                    { label: 'Exact', val: Math.ceil(totals.total) },
                    { label: '₱100', val: 100 },
                    { label: '₱200', val: 200 },
                    { label: '₱500', val: 500 },
                    { label: '₱1,000', val: 1000 },
                    {
                      label: '+₱100',
                      val: (Number(tenderedInput) || Math.ceil(totals.total)) + 100,
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
                    {peso(Math.max(0, (Number(tenderedInput) || 0) - totals.total))}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-white/60">
                  {paymentMethod} Reference / Approval No. (Optional)
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

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Btn size="xl" variant="ghost" onClick={() => setShowCheckoutModal(false)}>
                Cancel
              </Btn>
              <Btn type="submit" size="xl" variant="success" icon="print">
                Complete &amp; Receipt
              </Btn>
            </div>
          </form>
        </Modal>
      )}

      {/* Scannable Tablet QR Code Modal */}
      {showQrModal && (
        <QrModal
          url={lanUrl}
          storeName={db.settings.storeName}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* Official Receipt Modal */}
      {receiptOrder && (
        <ReceiptModal
          order={receiptOrder}
          settings={db.settings}
          onClose={() => setReceiptOrder(null)}
          onNewOrder={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
}

export default App;
