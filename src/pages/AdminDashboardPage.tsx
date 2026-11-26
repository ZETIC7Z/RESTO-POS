import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmployeesAttendanceView } from '../components/EmployeesAttendanceView';
import { MenuManagerView } from '../components/MenuManagerView';
import { PayrollView } from '../components/PayrollView';
import { QrModal } from '../components/QrModal';
import { SalesCalendarView } from '../components/SalesCalendarView';
import { StoreSettingsView } from '../components/StoreSettingsView';
import {
  BrandLogo,
  Btn,
  cx,
  Icon,
  Stat,
  useFullscreen,
  useNow,
} from '../components/ui';
import {
  AttendanceLog,
  dayKey,
  fmtDateTime,
  fmtTime,
  OrderRow,
  peso,
  Product,
  Profile,
} from '../data/posData';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

type AdminTab = 'sales' | 'menu' | 'employees' | 'payroll' | 'settings';

function AdminClock() {
  const now = useNow(1000);
  return <span className="font-mono text-white/75">{fmtDateTime(now)}</span>;
}

export function AdminDashboardPage() {
  const { profile, storeSettings, refreshSettings, signOutAndEndShift } = useAuth();
  const { isFs, toggle: toggleFs } = useFullscreen();

  const [activeTab, setActiveTab] = useState<AdminTab>('sales');
  const [showQr, setShowQr] = useState(false);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const fetchAllAdminData = useCallback(async () => {
    const [ordRes, prodRes, profRes, attRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false }),
      supabase
        .from('products')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase
        .from('attendance_logs')
        .select('*')
        .order('login_time', { ascending: false }),
    ]);

    if (ordRes.data) setOrders(ordRes.data as OrderRow[]);
    if (prodRes.data) {
      setProducts(
        prodRes.data.map((p) => ({
          ...p,
          price: Number(p.price),
          stock_qty: Number(p.stock_qty),
        }))
      );
    }
    if (profRes.data) {
      setProfiles(
        profRes.data.map((pr) => ({
          ...pr,
          hourly_rate: Number(pr.hourly_rate) || 54.5,
        }))
      );
    }
    if (attRes.data) {
      setAttendanceLogs(
        attRes.data.map((a) => ({
          ...a,
          overtime_hours: Number(a.overtime_hours) || 0,
        }))
      );
    }
    setLoadingData(false);
  }, []);

  useEffect(() => {
    void fetchAllAdminData();

    const channel = supabase
      .channel('admin-cloud-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () =>
        void fetchAllAdminData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () =>
        void fetchAllAdminData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () =>
        void fetchAllAdminData()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () =>
        void fetchAllAdminData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchAllAdminData]);

  // Live Today Overview Banner Metrics (Asia/Manila)
  const todayKey = dayKey(Date.now());

  const todayOverview = useMemo(() => {
    const todayOrders = orders.filter(
      (o) => (o.order_date || dayKey(o.created_at)) === todayKey && o.status !== 'cancelled'
    );
    const totalSalesToday = todayOrders.reduce(
      (s, o) => s + (Number(o.total_amount) || 0),
      0
    );
    const totalItemsToday = todayOrders.reduce((sum, o) => {
      const qty =
        o.order_items && o.order_items.length > 0
          ? o.order_items.reduce((s, i) => s + Number(i.quantity), 0)
          : (o.receipt_snapshot?.items || []).reduce((s, i) => s + Number(i.quantity), 0);
      return sum + qty;
    }, 0);

    // Determine Cashier currently on duty today
    const todayLogs = attendanceLogs.filter((l) => l.shift_date === todayKey);
    const activeShiftLogs = todayLogs.filter((l) => !l.logout_time);
    const activeEntries = activeShiftLogs.map((log) => {
      const staff = profiles.find((p) => p.id === log.cashier_id);
      return {
        name: staff?.full_name || 'Cashier',
        loginTime: fmtTime(log.login_time),
      };
    });

    const latestShift = todayLogs[0];
    const latestStaff = latestShift
      ? profiles.find((p) => p.id === latestShift.cashier_id)
      : null;

    return {
      activeEntries,
      latestShiftName: latestStaff?.full_name || null,
      latestShiftLogin: latestShift ? fmtTime(latestShift.login_time) : null,
      totalSalesToday,
      totalOrdersToday: todayOrders.length,
      totalItemsToday,
    };
  }, [orders, attendanceLogs, profiles, todayKey]);

  const navTabs: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'sales', label: 'Sales Calendar', icon: 'calendar_month' },
    { id: 'menu', label: 'Menu & Stock', icon: 'restaurant_menu' },
    { id: 'employees', label: 'Employees', icon: 'badge' },
    { id: 'payroll', label: 'Payroll', icon: 'payments' },
    { id: 'settings', label: 'Settings', icon: 'tune' },
  ];

  if (!profile) return null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden select-none">
      {/* Top Admin Header (No POS Register, No Tables, No Kitchen tabs) */}
      <header className="glass z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-5 xl:flex-nowrap">
        <div className="flex shrink-0 items-center gap-2.5">
          <BrandLogo size="md" alt={storeSettings.store_name} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight text-white sm:text-base">
                {storeSettings.store_name}
              </h1>
              <span className="hidden items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Supabase Cloud
              </span>
            </div>
            <p className="text-[11px] text-white/55">
              {storeSettings.address} · <AdminClock />
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5 overflow-x-auto py-0.5" aria-label="Admin Navigation">
          {navTabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cx(
                  'inline-flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 text-xs font-extrabold transition active:scale-[0.98] sm:text-sm',
                  active
                    ? 'chip-active'
                    : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.09] hover:text-white'
                )}
              >
                <Icon name={t.icon} className="text-[19px]" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5">
          <Btn
            size="md"
            variant="soft"
            icon="qr_code_2"
            onClick={() => setShowQr(true)}
            className="!px-3"
          >
            <span className="hidden sm:inline">Device QR</span>
          </Btn>
          <Btn
            size="md"
            variant="ghost"
            icon={isFs ? 'fullscreen_exit' : 'fullscreen'}
            onClick={toggleFs}
            className="!px-3"
          />
          <div className="hidden items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.05] px-2.5 py-1.5 sm:flex">
            <Icon name="verified_user" className="text-[18px] text-emerald-300" />
            <div className="leading-tight">
              <p className="text-xs font-extrabold text-white">{profile.full_name}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                Admin
              </p>
            </div>
          </div>
          <Btn
            size="md"
            variant="danger"
            icon="logout"
            onClick={() => void signOutAndEndShift()}
            className="!px-3"
          >
            <span className="hidden sm:inline">Sign Out</span>
          </Btn>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Live Today Overview Banner */}
          <section className="glass rounded-[28px] p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-300">
                  Live Today Overview ({todayKey})
                </p>
              </div>
              <Btn
                size="md"
                variant="ghost"
                icon="refresh"
                onClick={() => void fetchAllAdminData()}
                className="!h-9 !px-3 text-xs"
              >
                Refresh Cloud
              </Btn>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Cashier On Duty Today"
                value={
                  todayOverview.activeEntries.length > 0
                    ? todayOverview.activeEntries.map((e) => e.name).join(', ')
                    : 'No Active Shift'
                }
                sub={
                  todayOverview.activeEntries.length > 0
                    ? `Clocked in: ${todayOverview.activeEntries
                        .map((e) => e.loginTime)
                        .join(', ')}`
                    : todayOverview.latestShiftName
                    ? `Last shift: ${todayOverview.latestShiftName} (${todayOverview.latestShiftLogin})`
                    : 'Waiting for cashier login'
                }
                tone={
                  todayOverview.activeEntries.length > 0
                    ? 'text-emerald-300'
                    : 'text-white/75'
                }
                icon="badge"
              />
              <Stat
                label="Today's Cashier Sales"
                value={peso(todayOverview.totalSalesToday)}
                sub="Valid cloud transactions today"
                tone="text-emerald-300"
                icon="payments"
              />
              <Stat
                label="Clients / Orders Served"
                value={`${todayOverview.totalOrdersToday}`}
                sub="Orders processed today"
                tone="text-orange-300"
                icon="receipt_long"
              />
              <Stat
                label="Food Items Served Today"
                value={`${todayOverview.totalItemsToday}`}
                sub="Total dish quantities sold"
                tone="text-sky-300"
                icon="fastfood"
              />
            </div>
          </section>

          {loadingData ? (
            <div className="glass flex h-64 items-center justify-center rounded-[28px] text-sm font-bold text-white/60">
              Syncing live database from Supabase...
            </div>
          ) : (
            <>
              {activeTab === 'sales' && (
                <SalesCalendarView
                  orders={orders}
                  products={products}
                  settings={storeSettings}
                  adminProfile={profile}
                  onRefresh={fetchAllAdminData}
                />
              )}

              {activeTab === 'menu' && (
                <MenuManagerView
                  products={products}
                  onRefresh={fetchAllAdminData}
                />
              )}

              {activeTab === 'employees' && (
                <EmployeesAttendanceView
                  profiles={profiles}
                  attendanceLogs={attendanceLogs}
                  settings={storeSettings}
                  onRefresh={fetchAllAdminData}
                />
              )}

              {activeTab === 'payroll' && (
                <PayrollView
                  profiles={profiles}
                  attendanceLogs={attendanceLogs}
                  settings={storeSettings}
                  adminProfile={profile}
                  onRefresh={fetchAllAdminData}
                />
              )}

              {activeTab === 'settings' && (
                <StoreSettingsView
                  settings={storeSettings}
                  onSaved={async () => {
                    await Promise.all([refreshSettings(), fetchAllAdminData()]);
                  }}
                />
              )}
            </>
          )}
        </div>
      </main>

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
