import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Volume2, VolumeX, LogOut, LogIn, UtensilsCrossed,
  ClipboardList, Table2, ChefHat, Check, X, Clock,
  ShoppingBag, Receipt, Loader2, Eye, AlertTriangle,
  PhoneCall, Users, Banknote, CheckCircle2, AlertCircle,
  Play, TrendingUp, Utensils, Star, Plus, Minus, ShoppingCart,
  Search, Trash2, Send,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useTables } from '@/hooks/useTables';
import { useOrders, useUpdateOrderStatus, useCreateOrder } from '@/hooks/useOrders';
import { useMenuItems, useCategories } from '@/hooks/useMenuItems';
import { usePendingWaiterCalls, useAcknowledgeWaiterCall, useResolveWaiterCall } from '@/hooks/useWaiterCalls';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantDetails } from '@/hooks/useRestaurant';
import { TenantThemeProvider } from '@/components/admin/TenantThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useVoiceAnnouncement } from '@/hooks/useVoiceAnnouncement';
import { useActiveTableSessions } from '@/hooks/useTableSessions';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string | null) => {
  if (!d) return '--';
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};
const elapsed = (d: string | null) => {
  if (!d) return 0;
  return Math.floor((Date.now() - new Date(d).getTime()) / 60000);
};
const fmtMoney = (n: number) => `₹${n.toFixed(0)}`;
const tableTimeColor = (mins: number) =>
  mins < 30 ? 'text-emerald-600' : mins < 60 ? 'text-amber-600' : 'text-red-600';
const tableTimeBg = (mins: number) =>
  mins < 30 ? 'border-emerald-300 bg-emerald-50' : mins < 60 ? 'border-amber-300 bg-amber-50' : 'border-red-300 bg-red-50';

type Tab = 'tables' | 'orders' | 'bills' | 'calls' | 'order';

// ─── Cart item type ────────────────────────────────────────────────────────────
interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

// ─── Voice Player ─────────────────────────────────────────────────────────────
const VoicePlayer = ({ url }: { url: string }) => {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    ref.current = new Audio(url);
    ref.current.addEventListener('ended', () => setPlaying(false));
    return () => { ref.current?.pause(); };
  }, [url]);
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-lg"
      onClick={e => { e.stopPropagation(); playing ? ref.current?.pause() : ref.current?.play().catch(() => {}); setPlaying(p => !p); }}>
      {playing ? <VolumeX className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
      {playing ? 'Pause' : 'Voice Note'}
    </Button>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const WaiterDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, restaurantId: authRestaurantId, signOut } = useAuth();
  const restaurantId = authRestaurantId || searchParams.get('r') || undefined;
  const { data: restaurant } = useRestaurantDetails(restaurantId);

  // ── Employee ────────────────────────────────────────────────────────────────
  const [employee, setEmployee] = useState<any>(null);
  const [empLoading, setEmpLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
  const [shiftStart, setShiftStart] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: allTables = [] } = useTables(restaurantId);
  const { data: sessions = [] } = useActiveTableSessions(restaurantId);
  const { data: allOrders = [] } = useOrders(restaurantId);
  const { data: allCalls = [] } = usePendingWaiterCalls(restaurantId);
  const [assignedTableIds, setAssignedTableIds] = useState<string[]>([]);

  // ── UI ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [shiftSummary, setShiftSummary] = useState(false);
  const [shiftStats, setShiftStats] = useState({ served: 0, orders: 0, tables: 0 });

  // ── Take-order tab state ────────────────────────────────────────────────────
  const [orderCart, setOrderCart] = useState<CartItem[]>([]);
  const [orderTableId, setOrderTableId] = useState<string>('');
  const [orderCategoryId, setOrderCategoryId] = useState<string>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  const { data: menuItems = [] } = useMenuItems(restaurantId);
  const { data: categories = [] } = useCategories(restaurantId);
  const createOrderMutation = useCreateOrder();

  const cartTotal = orderCart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = orderCart.reduce((s, i) => s + i.quantity, 0);

  const addToCart = (item: { id: string; name: string; price: number }) => {
    setOrderCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setOrderCart(prev => {
      const existing = prev.find(c => c.menuItemId === id);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(c => c.menuItemId !== id);
      return prev.map(c => c.menuItemId === id ? { ...c, quantity: c.quantity - 1 } : c);
    });
  };

  const placeWaiterOrder = async () => {
    if (!restaurantId || !orderTableId || orderCart.length === 0) {
      toast({ title: 'Select a table and add items first', variant: 'destructive' }); return;
    }
    setPlacingOrder(true);
    try {
      await createOrderMutation.mutateAsync({
        order: {
          restaurant_id: restaurantId,
          table_id: orderTableId,
          status: 'confirmed' as any,  // waiter places → skip pending, go straight to kitchen
          total_amount: cartTotal,
          customer_name: orderCustomerName || 'Walk-in',
          payment_status: 'pending',
        },
        items: orderCart.map(c => ({
          menu_item_id: c.menuItemId,
          name: c.name,
          price: c.price,
          quantity: c.quantity,
          restaurant_id: restaurantId,
        })),
      });
      toast({ title: '✅ Order sent to kitchen!' });
      setOrderCart([]);
      setOrderCustomerName('');
      setActiveTab('orders');
    } catch (e: any) {
      toast({ title: 'Failed to place order', description: e.message, variant: 'destructive' });
    }
    setPlacingOrder(false);
  };

  const acknowledgeMutation = useAcknowledgeWaiterCall();
  const resolveMutation = useResolveWaiterCall();
  const updateOrderStatus = useUpdateOrderStatus();
  const { isMuted, toggleMute, announce, clearAnnouncement } = useVoiceAnnouncement();
  const prevCallsRef = useRef<any[]>([]);
  const prevOrdersRef = useRef<any[]>([]);

  // ── Clock tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // ── Load employee ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !restaurantId) return;
    (async () => {
      setEmpLoading(true);
      const { data } = await supabase.from('employees').select('*')
        .eq('user_id', user.id).eq('restaurant_id', restaurantId).maybeSingle();
      setEmployee(data || null);
      setEmpLoading(false);
    })();
  }, [user?.id, restaurantId]);

  // ── Load assigned tables ────────────────────────────────────────────────────
  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      const { data } = await supabase.from('employee_assignments')
        .select('table_id').eq('employee_id', employee.id).is('unassigned_at', null);
      setAssignedTableIds((data || []).map((a: any) => a.table_id));
    })();
  }, [employee?.id]);

  // ── Realtime: new orders → sound + tab badge ────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel(`waiter-rt-${restaurantId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        (p: any) => {
          const o = p.new;
          // Realtime payloads are raw rows — no JOIN data. Use table_id for filtering only.
          if (!assignedTableIds.length || assignedTableIds.includes(o.table_id)) {
            toast({ title: '🛎 New order!', description: 'A new order needs your confirmation.' });
            setActiveTab('orders');
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        (p: any) => {
          if (p.new.status === 'ready') {
            // table_number is not available in raw realtime payload (it's a JOIN column)
            toast({ title: '🍽 Food Ready!', description: 'An order is ready — serve it now!', duration: 8000 });
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [restaurantId, assignedTableIds]);

  // ── Voice announce calls ────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevCallsRef.current;
    allCalls.forEach(c => {
      if (!prev.find(p => p.id === c.id)) {
        const tbl = `Table ${(c as any).table?.table_number || '?'}`;
        const isBill = (c.reason || '').toLowerCase().includes('bill');
        announce(`call-${c.id}`, isBill ? `Bill requested from ${tbl}` : `Waiter called from ${tbl}`,
          '', false, 'call');
      }
    });
    prev.forEach(c => { if (!allCalls.find(p => p.id === c.id)) clearAnnouncement(`call-${c.id}`); });
    prevCallsRef.current = allCalls;
  }, [allCalls, announce, clearAnnouncement]);

  // ── Derived: my tables & sessions ──────────────────────────────────────────
  const myTables = useMemo(() =>
    assignedTableIds.length > 0 ? allTables.filter(t => assignedTableIds.includes(t.id)) : allTables,
    [allTables, assignedTableIds]);

  const sessionByTable = useMemo(() =>
    new Map(sessions.map(s => [s.table_id, s])),
    [sessions]);

  const ordersByTable = useMemo(() => {
    const m = new Map<string, any[]>();
    allOrders.forEach(o => {
      if (!o.table_id) return;
      if (!m.has(o.table_id)) m.set(o.table_id, []);
      m.get(o.table_id)!.push(o);
    });
    return m;
  }, [allOrders]);

  // ── Pending (needs waiter confirmation) ────────────────────────────────────
  const pendingOrders = useMemo(() =>
    allOrders.filter(o => o.status === 'pending' &&
      (!assignedTableIds.length || assignedTableIds.includes(o.table_id || ''))),
    [allOrders, assignedTableIds]);

  // ── Ready to serve ──────────────────────────────────────────────────────────
  const readyOrders = useMemo(() =>
    allOrders.filter(o => o.status === 'ready' &&
      (!assignedTableIds.length || assignedTableIds.includes(o.table_id || ''))),
    [allOrders, assignedTableIds]);

  // ── Bill requests ───────────────────────────────────────────────────────────
  const billCalls = useMemo(() =>
    allCalls.filter(c => (c.reason || '').toLowerCase().includes('bill')),
    [allCalls]);

  const assistCalls = useMemo(() =>
    allCalls.filter(c => !(c.reason || '').toLowerCase().includes('bill')),
    [allCalls]);

  const urgentCount = pendingOrders.length + readyOrders.length;
  const tabBadge: Record<Tab, number> = {
    orders: urgentCount,
    tables: 0,
    order: cartCount,
    bills: billCalls.length,
    calls: assistCalls.length,
  };

  // ── Check in / out ──────────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!employee) return;
    const isOn = employee.status === 'ACTIVE';
    if (!isOn) {
      setCheckingIn(true);
      const { error } = await supabase.from('employees').update({ status: 'ACTIVE' }).eq('id', employee.id);
      if (!error) { setEmployee((e: any) => ({ ...e, status: 'ACTIVE' })); setShiftStart(new Date()); toast({ title: '✅ Shift started!' }); }
      setCheckingIn(false);
    } else {
      // Show shift summary before checking out
      const ordersToday = allOrders.filter(o => {
        if (!o.created_at) return false;
        return new Date(o.created_at).toDateString() === new Date().toDateString() &&
          (o.status === 'served' || o.status === 'completed');
      });
      setShiftStats({ served: ordersToday.length, orders: ordersToday.length, tables: new Set(ordersToday.map(o => o.table_id)).size });
      setShiftSummary(true);
    }
  };

  const confirmCheckOut = async () => {
    setCheckingIn(true);
    const { error } = await supabase.from('employees').update({ status: 'OFF_DUTY' }).eq('id', employee.id);
    if (!error) { setEmployee((e: any) => ({ ...e, status: 'OFF_DUTY' })); setShiftSummary(false); toast({ title: '👋 Shift ended. Great work!' }); }
    setCheckingIn(false);
  };

  // ── Order actions ───────────────────────────────────────────────────────────
  // order_items are already included in allOrders via useOrders (select: order_items(*))
  // and item name/price are stored directly on order_items — no extra fetch needed
  const openOrderDetail = (order: any) => setSelectedOrder(order);

  const confirmOrder = (id: string) =>
    updateOrderStatus.mutate({ id, status: 'confirmed' }, {
      onSuccess: () => { toast({ title: '✅ Sent to kitchen' }); setSelectedOrder(null); },
      onError: () => toast({ title: 'Error', variant: 'destructive' }),
    });

  const markServed = (id: string) =>
    updateOrderStatus.mutate({ id, status: 'served' }, {
      onSuccess: () => toast({ title: '🍽 Marked as served' }),
      onError: () => toast({ title: 'Error', variant: 'destructive' }),
    });

  const rejectOrder = (id: string) =>
    updateOrderStatus.mutate({ id, status: 'cancelled' as any }, {
      onSuccess: () => { toast({ title: 'Order rejected' }); setSelectedOrder(null); },
    });

  const markTableClean = async (tableId: string) => {
    await supabase.from('tables').update({ status: 'available' }).eq('id', tableId);
    toast({ title: '🧹 Table marked clean' });
  };

  const presentBill = async (callId: string, tableSessionId: string) => {
    await supabase.from('table_sessions').update({ billing_at: new Date().toISOString(), status: 'billing' }).eq('id', tableSessionId);
    resolveMutation.mutate({ id: callId });
    toast({ title: '🧾 Bill presented to customer' });
  };

  const handleLogout = async () => { await signOut(); navigate('/waiter/login'); };

  // ─────────────────────────────────────────────────────────────────────────────
  if (empLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  // ── NO EMPLOYEE RECORD ────────────────────────────────────────────────────
  if (!employee) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4 text-center gap-5">
      <AlertTriangle className="w-14 h-14 text-amber-400" />
      <div>
        <h2 className="text-xl font-black text-white">Account not set up</h2>
        <p className="text-slate-400 text-sm mt-1 max-w-xs">
          Your account doesn't have a staff profile for this restaurant.<br/>
          Please contact your manager.
        </p>
      </div>
      <Button variant="ghost" onClick={handleLogout} className="text-slate-400 gap-1">
        <LogOut className="w-4 h-4" /> Sign Out
      </Button>
    </div>
  );

  // ── CHECK-IN GATE ─────────────────────────────────────────────────────────
  if (employee && employee.status !== 'ACTIVE') return (
    <TenantThemeProvider primaryColor={restaurant?.primary_color}>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-5 max-w-xs w-full">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
            <UtensilsCrossed className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Hey, {employee.full_name?.split(' ')[0]}!</h1>
            <p className="text-slate-400 text-sm mt-1">{restaurant?.name}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-2">
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Your shift</p>
            <p className="text-white font-bold">Status: <span className="text-red-400">OFF DUTY</span></p>
            {assignedTableIds.length > 0 && (
              <p className="text-emerald-400 text-sm font-semibold">{assignedTableIds.length} table(s) assigned to you</p>
            )}
          </div>
          <Button onClick={handleCheckIn} disabled={checkingIn}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base gap-2">
            {checkingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            Start Shift
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="text-slate-500 text-sm gap-1 w-full">
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </motion.div>
      </div>
    </TenantThemeProvider>
  );

  // ── MAIN DASHBOARD ────────────────────────────────────────────────────────
  const shiftMins = shiftStart ? Math.floor((Date.now() - shiftStart.getTime()) / 60000) : 0;

  return (
    <TenantThemeProvider primaryColor={restaurant?.primary_color} secondaryColor={restaurant?.secondary_color}>
      <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">

        {/* ── TOP HEADER ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-card border-b shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Utensils className="w-4 h-4 text-indigo-500" />
              </div>
              <div>
                <p className="font-bold text-sm leading-none">{employee?.full_name || 'Waiter'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  ACTIVE
                  {shiftStart && <span className="ml-1 opacity-60">· {shiftMins < 60 ? `${shiftMins}m` : `${Math.floor(shiftMins/60)}h ${shiftMins%60}m`}</span>}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Urgency indicator */}
              {urgentCount > 0 && (
                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}
                  className="flex items-center gap-1 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-full">
                  <Bell className="w-3 h-3" /> {urgentCount}
                </motion.div>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleMute}>
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCheckIn}
                className="h-8 gap-1 text-xs font-semibold text-amber-600 border-amber-300 hover:bg-amber-50">
                <LogOut className="w-3.5 h-3.5" /> End Shift
              </Button>
            </div>
          </div>

          {/* ── QUICK STATS BAR ──────────────────────────────────────────── */}
          <div className="flex border-t border-b divide-x bg-muted/30">
            {[
              { icon: Table2, label: 'My Tables', value: myTables.length, color: 'text-indigo-600' },
              { icon: ClipboardList, label: 'Pending', value: pendingOrders.length, color: 'text-amber-600' },
              { icon: ChefHat, label: 'Ready', value: readyOrders.length, color: readyOrders.length > 0 ? 'text-emerald-600 font-black' : 'text-muted-foreground' },
              { icon: Banknote, label: 'Bills', value: billCalls.length, color: billCalls.length > 0 ? 'text-purple-600' : 'text-muted-foreground' },
            ].map(s => (
              <div key={s.label} className="flex-1 flex flex-col items-center py-2 gap-0.5">
                <s.icon className={cn('w-3.5 h-3.5', s.color)} />
                <span className={cn('text-base font-black leading-none', s.color)}>{s.value}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        </header>

        {/* ── CONTENT ─────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-3 pb-24 space-y-3">
          <AnimatePresence mode="wait">

            {/* ══ ORDERS TAB ══════════════════════════════════════════════ */}
            {activeTab === 'orders' && (
              <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

                {/* READY TO SERVE — most urgent */}
                {readyOrders.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                        className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-black text-emerald-700 uppercase tracking-wide">🍽 Ready to Serve — Act Now!</span>
                    </div>
                    {readyOrders.map(o => (
                      <Card key={o.id} className="border-2 border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <Badge className="bg-emerald-500 text-white text-[10px] font-bold">Table {(o.table as any)?.table_number || '?'}</Badge>
                                <span className="text-[10px] text-muted-foreground">{fmt(o.created_at)}</span>
                              </div>
                              <p className="text-sm font-bold">{o.customer_name || 'Guest'}</p>
                              <p className="text-xs text-muted-foreground">{fmtMoney(Number(o.total_amount || 0))}</p>
                            </div>
                            <Button size="sm" className="h-9 rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              onClick={() => markServed(o.id)} disabled={updateOrderStatus.isPending}>
                              <Check className="w-4 h-4" /> Served!
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* AWAITING CONFIRMATION */}
                {pendingOrders.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-xs font-black text-amber-700 uppercase tracking-wide">⏳ Awaiting Your Confirmation</span>
                    </div>
                    {pendingOrders.map(o => (
                      <Card key={o.id} className="border border-amber-300 bg-amber-50/60">
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <Badge className="bg-amber-500 text-white text-[10px] font-bold">Table {(o.table as any)?.table_number || '?'}</Badge>
                                <span className="text-[10px] text-muted-foreground">{fmt(o.created_at)}</span>
                              </div>
                              <p className="text-sm font-bold">{o.customer_name || 'Guest'}</p>
                              <p className="text-xs text-muted-foreground">{o.order_items?.length || '?'} items · {fmtMoney(Number(o.total_amount || 0))}</p>
                            </div>
                            <p className="text-lg font-black text-amber-700">{fmtMoney(Number(o.total_amount || 0))}</p>
                          </div>
                          {o.special_instructions && (
                            <div className="text-[11px] bg-orange-100 border border-orange-200 rounded-lg px-2.5 py-1.5 text-orange-700">
                              ⚠️ {o.special_instructions}
                            </div>
                          )}
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 h-8 rounded-xl text-xs gap-1"
                              onClick={() => openOrderDetail(o)}>
                              <Eye className="w-3.5 h-3.5" /> View Items
                            </Button>
                            <Button size="sm" className="flex-1 h-8 rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                              onClick={() => confirmOrder(o.id)} disabled={updateOrderStatus.isPending}>
                              <ChefHat className="w-3.5 h-3.5" /> → Kitchen
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* IN PROGRESS */}
                {(() => {
                  const inProg = allOrders.filter(o =>
                    ['confirmed', 'preparing'].includes(o.status || '') &&
                    (!assignedTableIds.length || assignedTableIds.includes(o.table_id || ''))
                  );
                  if (!inProg.length && !pendingOrders.length && !readyOrders.length) return (
                    <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                      <CheckCircle2 className="w-12 h-12 opacity-20" />
                      <p className="font-semibold text-sm">All caught up!</p>
                      <p className="text-xs opacity-60">New orders will appear here.</p>
                    </div>
                  );
                  if (!inProg.length) return null;
                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">👨‍🍳 In Kitchen</p>
                      {inProg.map(o => (
                        <div key={o.id} className="flex items-center justify-between bg-muted/40 border rounded-xl px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">Table {(o.table as any)?.table_number || '?'}</Badge>
                            <span className="text-xs text-muted-foreground">{o.customer_name || 'Guest'}</span>
                          </div>
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                            o.status === 'preparing' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700')}>
                            {o.status === 'preparing' ? '🍳 Cooking' : '📋 Confirmed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {/* ══ TABLES TAB ══════════════════════════════════════════════ */}
            {activeTab === 'tables' && (
              <motion.div key="tables" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {assignedTableIds.length === 0 && (
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    ⚠️ No tables assigned yet — showing all. Ask manager to assign tables to you.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {myTables.map(table => {
                    const session = sessionByTable.get(table.id);
                    const tableOrders = ordersByTable.get(table.id) || [];
                    const activeOrders = tableOrders.filter(o => !['completed', 'cancelled'].includes(o.status || ''));
                    const total = activeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
                    const hasPending = activeOrders.some(o => o.status === 'pending');
                    const hasReady = activeOrders.some(o => o.status === 'ready');
                    const hasCall = allCalls.some(c => (c as any).table_id === table.id);
                    const seatedMins = session ? elapsed(session.seated_at) : 0;
                    const isOccupied = !!session;
                    const needsCleaning = table.status === 'needs_cleaning';

                    return (
                      <motion.div key={table.id} whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedTableId(table.id)}>
                        <Card className={cn('border-2 cursor-pointer relative overflow-hidden transition-all',
                          needsCleaning ? 'border-orange-400 bg-orange-50' :
                          hasReady ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 ring-offset-1' :
                          hasPending ? 'border-amber-400 bg-amber-50' :
                          isOccupied ? 'border-indigo-300 bg-indigo-50/50' :
                          'border-zinc-200 bg-white')}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-black text-xl text-zinc-900">{table.table_number}</h3>
                              <div className="flex flex-col items-end gap-1">
                                {hasPending && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                                {hasReady && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />}
                                {hasCall && <PhoneCall className="w-3 h-3 text-rose-500" />}
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-1">
                              <Users className="w-3 h-3 inline mr-0.5" />{table.capacity || 4} seats
                            </p>
                            {needsCleaning ? (
                              <Badge className="text-[10px] bg-orange-500 text-white w-full justify-center">Needs Cleaning</Badge>
                            ) : isOccupied ? (
                              <div className="space-y-1">
                                <div className={cn('text-xs font-bold flex items-center gap-1', tableTimeColor(seatedMins))}>
                                  <Clock className="w-3 h-3" />
                                  {seatedMins < 60 ? `${seatedMins}m` : `${Math.floor(seatedMins/60)}h${seatedMins%60}m`}
                                </div>
                                {total > 0 && <p className="text-xs font-black text-zinc-800">{fmtMoney(total)}</p>}
                                <p className="text-[10px] capitalize font-semibold text-muted-foreground">
                                  {hasReady ? '🔔 Ready!' : hasPending ? '⏳ Review' : session?.status || 'occupied'}
                                </p>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-[10px] w-full justify-center text-emerald-700 border-emerald-300">Available</Badge>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 pt-1 border-t text-[10px]">
                  {[['border-emerald-400 bg-emerald-50', '🔔 Ready to serve'],
                    ['border-amber-400 bg-amber-50', '⏳ Pending review'],
                    ['border-indigo-300 bg-indigo-50', '🍳 Occupied'],
                    ['border-orange-400 bg-orange-50', '🧹 Needs cleaning'],
                    ['border-zinc-200 bg-white', '✅ Available']].map(([cls, label]) => (
                    <span key={label} className={cn('border rounded-lg px-2 py-0.5 font-semibold', cls)}>{label}</span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ══ BILLS TAB ════════════════════════════════════════════════ */}
            {activeTab === 'bills' && (
              <motion.div key="bills" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                <p className="text-xs text-muted-foreground">Tables that have requested their bill.</p>
                {billCalls.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                    <Banknote className="w-12 h-12 opacity-20" />
                    <p className="font-semibold text-sm">No bill requests</p>
                  </div>
                ) : (
                  billCalls.map(call => {
                    const tableOrders = ordersByTable.get((call as any).table_id || '') || [];
                    const billTotal = tableOrders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount || 0), 0);
                    const session = sessions.find(s => s.table_id === (call as any).table_id);
                    return (
                      <Card key={call.id} className="border-2 border-purple-300 bg-purple-50/50">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-purple-600 text-white font-bold text-[10px]">
                                  Table {(call as any).table?.table_number || '?'}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{fmt(call.created_at)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">{tableOrders.filter(o => o.status !== 'cancelled').length} orders</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-black text-purple-700">{fmtMoney(billTotal)}</p>
                              <p className="text-[10px] text-muted-foreground">Total bill</p>
                            </div>
                          </div>

                          {/* Order breakdown */}
                          <div className="space-y-1 border rounded-xl overflow-hidden">
                            {tableOrders.filter(o => o.status !== 'cancelled').map((o, i) => (
                              <div key={o.id} className={cn('flex justify-between text-xs px-3 py-2', i !== 0 && 'border-t')}>
                                <span className="text-muted-foreground">Order #{o.order_number}</span>
                                <span className="font-bold">{fmtMoney(Number(o.total_amount || 0))}</span>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 h-9 rounded-xl text-xs gap-1"
                              onClick={() => resolveMutation.mutate({ id: call.id })}>
                              <X className="w-3.5 h-3.5" /> Dismiss
                            </Button>
                            <Button size="sm" className="flex-1 h-9 rounded-xl text-xs gap-1 bg-purple-600 hover:bg-purple-700 text-white font-bold"
                              onClick={() => session && presentBill(call.id, session.id)}>
                              <Receipt className="w-3.5 h-3.5" /> Present Bill
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </motion.div>
            )}

            {/* ══ CALLS TAB ════════════════════════════════════════════════ */}
            {activeTab === 'calls' && (
              <motion.div key="calls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {assistCalls.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                    <PhoneCall className="w-12 h-12 opacity-20" />
                    <p className="font-semibold text-sm">No active calls</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {assistCalls.map(call => {
                      let reasonNode: React.ReactNode = call.reason || 'Assistance needed';
                      try {
                        const p = JSON.parse(call.reason || '');
                        if (p.type === 'voice' && p.url) reasonNode = <VoicePlayer url={p.url} />;
                        else if (p.label) reasonNode = p.label;
                      } catch {}
                      return (
                        <motion.div key={call.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
                          <Card className="border-rose-300 bg-rose-50/50">
                            <CardContent className="p-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <Badge className="bg-rose-500 text-white text-[10px] font-bold">
                                  Table {(call as any).table?.table_number || '?'}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{fmt(call.created_at)}</span>
                              </div>
                              <div className="text-sm">{reasonNode}</div>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-xl gap-1"
                                  onClick={() => acknowledgeMutation.mutate({ id: call.id, userId: user?.id || '' })}>
                                  <AlertCircle className="w-3.5 h-3.5" /> Acknowledge
                                </Button>
                                <Button size="sm" className="flex-1 h-8 text-xs rounded-xl gap-1 bg-emerald-600 text-white"
                                  onClick={() => resolveMutation.mutate({ id: call.id })}>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </motion.div>
            )}

            {/* ══ TAKE ORDER TAB ══════════════════════════════════════════════ */}
            {activeTab === 'order' && (
              <motion.div key="order" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 pb-4">

                {/* Table selector + customer name */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide mb-1">Table *</p>
                    <select
                      value={orderTableId}
                      onChange={e => setOrderTableId(e.target.value)}
                      className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">Select table</option>
                      {myTables.map(t => (
                        <option key={t.id} value={t.id}>{t.table_number}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wide mb-1">Customer</p>
                    <Input
                      className="h-9 rounded-xl text-sm"
                      placeholder="Name (optional)"
                      value={orderCustomerName}
                      onChange={e => setOrderCustomerName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-9 rounded-xl text-sm"
                    placeholder="Search menu…"
                    value={orderSearch}
                    onChange={e => setOrderSearch(e.target.value)}
                  />
                </div>

                {/* Category filter */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[{ id: 'all', name: 'All' }, ...categories].map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={() => setOrderCategoryId(cat.id)}
                      className={cn(
                        'shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors',
                        orderCategoryId === cat.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                      )}>
                      {cat.name}
                    </button>
                  ))}
                </div>

                {/* Menu items */}
                <div className="space-y-2">
                  {menuItems
                    .filter(item => {
                      if (!item.is_available) return false;
                      if (orderCategoryId !== 'all' && item.category_id !== orderCategoryId) return false;
                      if (orderSearch && !item.name.toLowerCase().includes(orderSearch.toLowerCase())) return false;
                      return true;
                    })
                    .map(item => {
                      const cartItem = orderCart.find(c => c.menuItemId === item.id);
                      return (
                        <div key={item.id} className="flex items-center gap-3 bg-card border rounded-xl px-3 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{item.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs font-black text-primary">₹{Number(item.price).toFixed(0)}</span>
                              {item.is_vegetarian && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1">VEG</span>
                              )}
                              {item.is_popular && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">★ POPULAR</span>
                              )}
                            </div>
                          </div>
                          {cartItem ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => removeFromCart(item.id)}
                                className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/70">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-6 text-center text-sm font-black">{cartItem.quantity}</span>
                              <button onClick={() => addToCart({ id: item.id, name: item.name, price: Number(item.price) })}
                                className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart({ id: item.id, name: item.name, price: Number(item.price) })}
                              className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors">
                              <Plus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  {menuItems.filter(i => i.is_available &&
                    (orderCategoryId === 'all' || i.category_id === orderCategoryId) &&
                    (!orderSearch || i.name.toLowerCase().includes(orderSearch.toLowerCase()))
                  ).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">No items found</div>
                  )}
                </div>

                {/* Cart summary */}
                {orderCart.length > 0 && (
                  <div className="sticky bottom-20 z-10 rounded-2xl border-2 border-primary bg-card shadow-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-primary" />
                        <span className="font-black text-sm">{cartCount} item{cartCount > 1 ? 's' : ''}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-primary text-base">₹{cartTotal.toFixed(0)}</span>
                        <button onClick={() => setOrderCart([])}
                          className="text-destructive hover:bg-destructive/10 rounded-lg p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Cart items preview */}
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {orderCart.map(c => (
                        <div key={c.menuItemId} className="flex justify-between text-xs text-muted-foreground">
                          <span className="truncate">{c.name} ×{c.quantity}</span>
                          <span className="font-semibold shrink-0 ml-2">₹{(c.price * c.quantity).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="w-full rounded-xl h-10 gap-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={placeWaiterOrder}
                      disabled={!orderTableId || placingOrder}>
                      {placingOrder
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />}
                      {!orderTableId ? 'Select a table first' : 'Send to Kitchen'}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ── BOTTOM NAV ───────────────────────────────────────────────────── */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-card/95 backdrop-blur border-t z-50">
          <div className="flex">
            {([
              { id: 'orders', icon: ClipboardList, label: 'Orders' },
              { id: 'tables', icon: Table2,       label: 'Tables' },
              { id: 'order',  icon: ShoppingCart, label: 'Take Order' },
              { id: 'bills',  icon: Receipt,      label: 'Bills' },
              { id: 'calls',  icon: Bell,         label: 'Calls' },
            ] as { id: Tab; icon: any; label: string }[]).map(tab => {
              const badge = tabBadge[tab.id];
              const isActive = activeTab === tab.id;
              const isUrgent = (tab.id === 'orders' && readyOrders.length > 0) || (tab.id === 'bills' && billCalls.length > 0);
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn('flex-1 flex flex-col items-center gap-1 py-3 relative transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  <div className="relative">
                    <tab.icon className={cn('w-5 h-5', isUrgent && !isActive && 'text-red-500')} />
                    {badge > 0 && (
                      <span className={cn('absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white',
                        isUrgent ? 'bg-red-500 animate-bounce' : 'bg-primary')}>
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold">{tab.label}</span>
                  {isActive && <motion.div layoutId="nav-indicator" className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── TABLE DETAIL SHEET ──────────────────────────────────────────── */}
        <Sheet open={!!selectedTableId} onOpenChange={o => !o && setSelectedTableId(null)}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            {(() => {
              const table = allTables.find(t => t.id === selectedTableId);
              const session = selectedTableId ? sessionByTable.get(selectedTableId) : null;
              const tableOrders = (selectedTableId ? ordersByTable.get(selectedTableId) : []) || [];
              const activeOrders = tableOrders.filter(o => !['completed', 'cancelled'].includes(o.status || ''));
              const total = activeOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
              const seatedMins = session ? elapsed(session.seated_at) : 0;
              if (!table) return null;
              return (
                <>
                  <SheetHeader className="mb-4">
                    <SheetTitle className="flex items-center justify-between">
                      <span>Table {table.table_number}</span>
                      <Badge className={session ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'}>
                        {session ? 'Occupied' : 'Available'}
                      </Badge>
                    </SheetTitle>
                  </SheetHeader>

                  {session && (
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { label: 'Seated', value: `${seatedMins}m ago` },
                        { label: 'Orders', value: activeOrders.length },
                        { label: 'Total', value: fmtMoney(total) },
                      ].map(s => (
                        <div key={s.label} className="bg-muted/40 rounded-xl p-3 text-center">
                          <p className="text-lg font-black">{s.value}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Orders for this table */}
                  {activeOrders.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-black text-muted-foreground uppercase tracking-wide">Orders</p>
                      {activeOrders.map(o => (
                        <div key={o.id} className="flex items-center justify-between bg-muted/30 border rounded-xl px-3 py-2.5">
                          <div>
                            <p className="text-sm font-bold">#{o.order_number} — {o.customer_name || 'Guest'}</p>
                            <p className="text-xs text-muted-foreground">{fmtMoney(Number(o.total_amount || 0))}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                              o.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              o.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                              o.status === 'preparing' ? 'bg-indigo-100 text-indigo-700' :
                              o.status === 'ready' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-muted text-muted-foreground')}>
                              {o.status}
                            </span>
                            {o.status === 'ready' && (
                              <Button size="sm" className="h-7 text-[10px] bg-emerald-600 text-white rounded-lg gap-1"
                                onClick={() => markServed(o.id)}>
                                <Check className="w-3 h-3" /> Serve
                              </Button>
                            )}
                            {o.status === 'pending' && (
                              <Button size="sm" className="h-7 text-[10px] bg-amber-500 text-white rounded-lg"
                                onClick={() => { setSelectedTableId(null); openOrderDetail(o); }}>
                                Review
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Table actions */}
                  <div className="grid grid-cols-2 gap-2">
                    {table.status === 'needs_cleaning' && (
                      <Button variant="outline" className="col-span-2 gap-2 rounded-xl border-orange-300 text-orange-600 hover:bg-orange-50"
                        onClick={() => { markTableClean(table.id!); setSelectedTableId(null); }}>
                        🧹 Mark Table as Clean
                      </Button>
                    )}
                    {!session && table.status !== 'needs_cleaning' && (
                      <div className="col-span-2 text-center text-sm text-muted-foreground py-4">Table is available and clean.</div>
                    )}
                  </div>
                </>
              );
            })()}
          </SheetContent>
        </Sheet>

        {/* ── ORDER DETAIL DIALOG ─────────────────────────────────────────── */}
        <Dialog open={!!selectedOrder} onOpenChange={o => !o && setSelectedOrder(null)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>
                Order #{selectedOrder?.order_number}
                {selectedOrder?.table && (
                  <span className="font-normal text-muted-foreground ml-2">
                    — Table {(selectedOrder.table as any)?.table_number}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription>Review all items carefully before sending to kitchen.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
                {/* Customer info */}
                {(selectedOrder?.customer_name || selectedOrder?.customer_phone) && (
                  <div className="text-xs bg-muted/50 rounded-xl px-3 py-2 flex gap-4">
                    {selectedOrder.customer_name && <span><strong>Customer:</strong> {selectedOrder.customer_name}</span>}
                    {selectedOrder.customer_phone && <span><strong>Phone:</strong> {selectedOrder.customer_phone}</span>}
                  </div>
                )}
                <div className="border rounded-xl overflow-hidden">
                  {/* Header row */}
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                    <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Item</span>
                    <span className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">Qty × Price</span>
                  </div>
                  {(selectedOrder?.order_items || []).length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">No items found</div>
                  ) : (
                    (selectedOrder?.order_items || []).map((item: any, i: number) => (
                      <div key={item.id || i} className={cn('flex items-start gap-3 px-3 py-3', i !== 0 && 'border-t')}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-tight">{item.name || 'Item'}</p>
                          {item.special_instructions && (
                            <p className="text-[10px] text-orange-600 mt-0.5 font-semibold">⚠️ {item.special_instructions}</p>
                          )}
                          {item.selected_variants && typeof item.selected_variants === 'object' &&
                            Object.keys(item.selected_variants).length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(', ')}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black">×{item.quantity}</p>
                          <p className="text-[11px] text-muted-foreground">{fmtMoney(Number(item.price || 0) * Number(item.quantity || 1))}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {selectedOrder?.special_instructions && (
                  <div className="text-xs bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-orange-700">
                    ⚠️ <strong>Table note:</strong> {selectedOrder.special_instructions}
                  </div>
                )}
                <div className="flex justify-between font-black border-t pt-3 text-base">
                  <span>Total</span><span>{fmtMoney(Number(selectedOrder?.total_amount || 0))}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl gap-1 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => rejectOrder(selectedOrder?.id)}>
                    <X className="w-4 h-4" /> Reject
                  </Button>
                  <Button className="flex-1 rounded-xl gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    onClick={() => confirmOrder(selectedOrder?.id)}>
                    <ChefHat className="w-4 h-4" /> Confirm & Send
                  </Button>
                </div>
              </div>
          </DialogContent>
        </Dialog>

        {/* ── SHIFT SUMMARY / CHECK-OUT DIALOG ────────────────────────────── */}
        <Dialog open={shiftSummary} onOpenChange={setShiftSummary}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" /> End of Shift Summary
              </DialogTitle>
              <DialogDescription>Great work today, {employee?.full_name?.split(' ')[0]}!</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Table2, label: 'Tables', value: shiftStats.tables, color: 'text-indigo-600' },
                  { icon: ShoppingBag, label: 'Orders', value: shiftStats.orders, color: 'text-emerald-600' },
                  { icon: TrendingUp, label: 'Served', value: shiftStats.served, color: 'text-amber-600' },
                ].map(s => (
                  <div key={s.label} className="bg-muted/40 rounded-xl p-3 text-center">
                    <s.icon className={cn('w-5 h-5 mx-auto mb-1', s.color)} />
                    <p className="text-2xl font-black">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              {shiftStart && (
                <p className="text-center text-sm text-muted-foreground">
                  Shift duration: <strong>{Math.floor(shiftMins / 60)}h {shiftMins % 60}m</strong>
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShiftSummary(false)}>
                  Continue Shift
                </Button>
                <Button className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold gap-1"
                  onClick={confirmCheckOut} disabled={checkingIn}>
                  {checkingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                  Check Out
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TenantThemeProvider>
  );
};

export default WaiterDashboard;
