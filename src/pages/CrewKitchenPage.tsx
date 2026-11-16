import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo, Btn, cx, DeveloperFooter, Icon, useFullscreen, useNow } from '../components/ui';
import { dayKey, fmtDateTime, fmtTime, OrderRow } from '../data/posData';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

function KitchenClock() {
  const now = useNow(1000);
  return <span className="font-mono text-white/75">{fmtDateTime(now)}</span>;
}

export function CrewKitchenPage() {
  const { profile, storeSettings, signOutAndEndShift } = useAuth();
  const navigate = useNavigate();
  const { isFs, toggle: toggleFs } = useFullscreen();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<'ACTIVE' | 'COMPLETED'>('ACTIVE');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    const today = dayKey(Date.now());
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('order_date', today)
      .neq('status', 'cancelled')
      .order('order_number', { ascending: true });

    if (data) setOrders(data as OrderRow[]);
  }, []);

  useEffect(() => {
    void fetchQueue();

    const channel = supabase
      .channel('crew-kds-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => void fetchQueue()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  const advanceStatus = async (orderId: string, nextStatus: 'ready' | 'completed') => {
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId);
      if (error) throw error;
      await fetchQueue();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update kitchen status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const activeOrders = orders.filter(
    (o) => o.status === 'preparing' || o.status === 'ready'
  );
  const completedOrders = orders.filter((o) => o.status === 'completed');
  const shown = filter === 'ACTIVE' ? activeOrders : completedOrders;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden select-none">
      {/* Kitchen Header */}
      <header className="glass z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" alt={storeSettings.store_name} />
          <div>
            <h1 className="text-base font-extrabold text-white">
              {storeSettings.store_name} · Kitchen Display (KDS)
            </h1>
            <p className="text-[11px] text-white/55">
              Live Queue Sync · <KitchenClock />
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Btn
            size="md"
            variant={filter === 'ACTIVE' ? 'primary' : 'ghost'}
            icon="local_fire_department"
            onClick={() => setFilter('ACTIVE')}
          >
            Active Tickets ({activeOrders.length})
          </Btn>
          <Btn
            size="md"
            variant={filter === 'COMPLETED' ? 'primary' : 'ghost'}
            icon="task_alt"
            onClick={() => setFilter('COMPLETED')}
          >
            Completed Today ({completedOrders.length})
          </Btn>
          <Btn
            size="md"
            variant="soft"
            icon="tv"
            onClick={() => navigate('/display')}
          >
            Smart TV Display
          </Btn>
          <Btn
            size="md"
            variant="ghost"
            icon={profile?.role === 'admin' ? 'admin_panel_settings' : 'point_of_sale'}
            onClick={() => navigate(profile?.role === 'admin' ? '/admin' : '/cashier')}
          >
            {profile?.role === 'admin' ? 'Admin' : 'POS Register'}
          </Btn>
          <Btn
            size="md"
            variant="ghost"
            icon={isFs ? 'fullscreen_exit' : 'fullscreen'}
            onClick={toggleFs}
          />
          <Btn
            size="md"
            variant="danger"
            icon="logout"
            onClick={() => void signOutAndEndShift()}
          >
            Sign Out
          </Btn>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">
          {shown.length === 0 ? (
            <div className="glass flex h-80 flex-col items-center justify-center rounded-[28px] p-8 text-center">
              <Icon name="check_circle" className="text-6xl text-emerald-400/50" />
              <p className="mt-3 text-xl font-extrabold text-white">
                {filter === 'ACTIVE'
                  ? 'All kitchen tickets are cleared!'
                  : 'No completed tickets yet today.'}
              </p>
              <p className="mt-1 text-sm text-white/50">
                New orders from Cashier terminals appear here automatically in real time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((o) => {
                const isReady = o.status === 'ready';
                const items =
                  o.order_items && o.order_items.length > 0
                    ? o.order_items
                    : (o.receipt_snapshot?.items || []).map((i, idx) => ({
                        id: `${idx}`,
                        product_name: i.product_name,
                        quantity: i.quantity,
                      }));

                return (
                  <div
                    key={o.id}
                    className={cx(
                      'glass flex flex-col justify-between rounded-[28px] border p-5',
                      o.status === 'preparing'
                        ? 'border-orange-400/60'
                        : isReady
                        ? 'border-emerald-400/70'
                        : 'border-white/10 opacity-75'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cx(
                              'rounded-2xl px-3.5 py-1.5 font-mono text-2xl font-extrabold text-white',
                              isReady ? 'bg-emerald-500 text-black' : 'bg-orange-500'
                            )}
                          >
                            #{String(o.order_number).padStart(2, '0')}
                          </span>
                          <div>
                            <p className="text-xs font-extrabold text-white">
                              {o.receipt_snapshot?.order_type || 'Order'} · {o.or_number}
                            </p>
                            <p className="text-[11px] text-white/55">
                              {fmtTime(o.created_at)} · {o.customer_name}
                            </p>
                          </div>
                        </div>

                        <span
                          className={cx(
                            'rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider',
                            o.status === 'preparing'
                              ? 'bg-orange-500/20 text-orange-300'
                              : isReady
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-sky-500/20 text-sky-300'
                          )}
                        >
                          {o.status}
                        </span>
                      </div>

                      <ul className="mt-4 space-y-2 border-t border-white/10 pt-3">
                        {items.map((ln) => (
                          <li
                            key={ln.id}
                            className="flex items-center gap-2 text-base font-extrabold text-white"
                          >
                            <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/10 px-2 font-mono text-orange-300">
                              {ln.quantity}x
                            </span>
                            <span>{ln.product_name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-5 pt-2">
                      {o.status === 'preparing' && (
                        <Btn
                          size="xl"
                          variant="success"
                          icon="notifications_active"
                          disabled={updatingId === o.id}
                          onClick={() => void advanceStatus(o.id, 'ready')}
                          className="w-full"
                        >
                          {updatingId === o.id ? 'Updating...' : 'Mark Ready (Call Queue)'}
                        </Btn>
                      )}
                      {o.status === 'ready' && (
                        <Btn
                          size="xl"
                          variant="primary"
                          icon="check_circle"
                          disabled={updatingId === o.id}
                          onClick={() => void advanceStatus(o.id, 'completed')}
                          className="w-full"
                        >
                          {updatingId === o.id ? 'Completing...' : 'Complete (Claimed)'}
                        </Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <DeveloperFooter className="border-t border-white/10" />
    </div>
  );
}
