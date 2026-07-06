import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Bell, Search, Volume2, VolumeX, CheckCircle2, AlertCircle,
  RefreshCw, Loader2, Play, Eye, LogOut, LogIn, UtensilsCrossed,
  ClipboardList, Table2, PhoneCall, ChefHat, Check, X, Clock,
  ShoppingBag, ArrowRight
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTables } from '@/hooks/useTables';
import { useOrders, useUpdateOrderStatus } from '@/hooks/useOrders';
import { usePendingWaiterCalls, useAcknowledgeWaiterCall, useResolveWaiterCall } from '@/hooks/useWaiterCalls';
import { useAuth } from '@/hooks/useAuth';
import { useRestaurantDetails } from '@/hooks/useRestaurant';
import { TenantThemeProvider } from '@/components/admin/TenantThemeProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useVoiceAnnouncement } from '@/hooks/useVoiceAnnouncement';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// ─── Voice player for call notes ─────────────────────────────────────────────
const VoicePlayer = ({ url }: { url: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    audioRef.current = new Audio(url);
    const ended = () => setIsPlaying(false);
    audioRef.current.addEventListener('ended', ended);
    return () => { audioRef.current?.removeEventListener('ended', ended); audioRef.current?.pause(); };
  }, [url]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(() => {});
    setIsPlaying(v => !v);
  };
  return (
    <Button size="sm" variant="outline" onClick={toggle}
      className="flex items-center gap-1.5 rounded-xl mt-1 h-8 text-xs font-semibold">
      {isPlaying ? <VolumeX className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
      {isPlaying ? 'Pause' : 'Play Voice'}
    </Button>
  );
};

const CallReasonRenderer = ({ reason }: { reason: string | null }) => {
  if (!reason) return <p className="text-sm mb-2">Assistance requested</p>;
  try {
    const p = JSON.parse(reason);
    if (p.type === 'voice' && p.url) return <div className="mb-2"><p className="text-xs font-bold text-muted-foreground uppercase mb-1">🎤 Voice Note</p><VoicePlayer url={p.url} /></div>;
    if (p.type === 'image' && p.url) return (
      <div className="mb-2">
        <p className="text-xs font-bold text-muted-foreground uppercase mb-1">📷 Photo</p>
        <img src={p.url} alt="Attachment" className="w-16 h-16 rounded-lg object-cover border" />
      </div>
    );
    return <p className="text-sm mb-2">{p.label || reason}</p>;
  } catch { return <p className="text-sm mb-2">{reason}</p>; }
};

// ─── Tabs ──────────────────────────────────────────────────────────────────────
type Tab = 'tables' | 'orders' | 'calls';

const WaiterDashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, restaurantId: authRestaurantId, signOut } = useAuth();

  const urlRestaurantId = searchParams.get('r');
  const restaurantId = authRestaurantId || urlRestaurantId || undefined;
  const { data: restaurant } = useRestaurantDetails(restaurantId);

  // ── Employee / shift state ──────────────────────────────────────────────────
  const [employee, setEmployee] = useState<any>(null);
  const [empLoading, setEmpLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [orderItemsLoading, setOrderItemsLoading] = useState(false);

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { data: allTables = [] } = useTables(restaurantId);
  const { data: orders = [] } = useOrders(restaurantId);
  const { data: rawPendingCalls = [] } = usePendingWaiterCalls(restaurantId);
  const pendingCalls = useMemo(() => rawPendingCalls.filter(c => c.reason !== 'Bill requested'), [rawPendingCalls]);

  const acknowledgeMutation = useAcknowledgeWaiterCall();
  const resolveMutation = useResolveWaiterCall();
  const updateOrderStatus = useUpdateOrderStatus();
  const { isMuted, toggleMute, announce, clearAnnouncement } = useVoiceAnnouncement();
  const prevCallsRef = useRef<any[]>([]);

  // ── Assigned tables for this waiter ────────────────────────────────────────
  const [assignedTableIds, setAssignedTableIds] = useState<string[]>([]);

  // ── Load employee record ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || !restaurantId) return;
    (async () => {
      setEmpLoading(true);
      const { data } = await supabase
        .from('employees')
        .select('*')
        .eq('user_id', user.id)
        .eq('restaurant_id', restaurantId)
        .maybeSingle();
      setEmployee(data || null);
      setEmpLoading(false);
    })();
  }, [user?.id, restaurantId]);

  // ── Load assigned tables ────────────────────────────────────────────────────
  useEffect(() => {
    if (!employee?.id) return;
    (async () => {
      const { data } = await supabase
        .from('employee_assignments')
        .select('table_id')
        .eq('employee_id', employee.id)
        .is('unassigned_at', null);
      setAssignedTableIds((data || []).map((a: any) => a.table_id));
    })();
  }, [employee?.id]);

  // ── Realtime: new orders on assigned tables ─────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`waiter-orders-${restaurantId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        (payload: any) => {
          const order = payload.new;
          if (assignedTableIds.includes(order.table_id)) {
            toast({ title: '🛎 New order!', description: `Table ${order.table_number || '?'} placed an order — review & confirm` });
            setActiveTab('orders');
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, assignedTableIds]);

  // ── Voice announce new calls ────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevCallsRef.current;
    pendingCalls.forEach(call => {
      if (!prev.find(c => c.id === call.id)) {
        const table = `Table ${call.table?.table_number || '?'}`;
        announce(`call-${call.id}`, `Waiter calling from ${table}`, `${table} லிருந்து அழைக்கப்படுகிறார்`, false, 'call');
      }
    });
    prev.forEach(c => { if (!pendingCalls.find(p => p.id === c.id)) clearAnnouncement(`call-${c.id}`); });
    prevCallsRef.current = pendingCalls;
  }, [pendingCalls, announce, clearAnnouncement]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const myTables = useMemo(() =>
    assignedTableIds.length > 0
      ? allTables.filter(t => assignedTableIds.includes(t.id))
      : allTables,                // fallback: show all if none assigned yet
    [allTables, assignedTableIds]
  );

  const filteredTables = useMemo(() =>
    myTables.filter(t => t.table_number.toLowerCase().includes(searchQuery.toLowerCase())),
    [myTables, searchQuery]
  );

  // Orders on my tables that need confirmation (status = pending)
  const pendingOrders = useMemo(() =>
    orders.filter(o =>
      o.status === 'pending' &&
      (assignedTableIds.length === 0 || assignedTableIds.includes(o.table_id || ''))
    ),
    [orders, assignedTableIds]
  );

  // ── Check in / out ──────────────────────────────────────────────────────────
  const handleCheckIn = async () => {
    if (!employee) return;
    setCheckingIn(true);
    const newStatus = employee.status === 'ON_DUTY' ? 'OFF_DUTY' : 'ON_DUTY';
    const { error } = await supabase.from('employees').update({ status: newStatus }).eq('id', employee.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setEmployee((e: any) => ({ ...e, status: newStatus }));
      toast({ title: newStatus === 'ON_DUTY' ? '✅ Checked In' : '👋 Checked Out', description: newStatus === 'ON_DUTY' ? 'Your shift has started.' : 'Your shift has ended.' });
    }
    setCheckingIn(false);
  };

  // ── Order confirmation ──────────────────────────────────────────────────────
  const openOrderDetail = async (order: any) => {
    setSelectedOrder(order);
    setOrderItemsLoading(true);
    const { data } = await supabase
      .from('order_items')
      .select('*, menu_items(name, price, image_url)')
      .eq('order_id', order.id);
    setOrderItems(data || []);
    setOrderItemsLoading(false);
  };

  const confirmOrder = async (orderId: string) => {
    updateOrderStatus.mutate({ id: orderId, status: 'confirmed' }, {
      onSuccess: () => {
        toast({ title: '✅ Order sent to kitchen', description: 'Kitchen will start preparing now.' });
        setSelectedOrder(null);
      },
      onError: () => toast({ title: 'Error', description: 'Failed to confirm order', variant: 'destructive' }),
    });
  };

  const rejectOrder = async (orderId: string) => {
    updateOrderStatus.mutate({ id: orderId, status: 'cancelled' as any }, {
      onSuccess: () => {
        toast({ title: 'Order rejected', description: 'Customer will be notified.' });
        setSelectedOrder(null);
      },
      onError: () => toast({ title: 'Error', description: 'Failed to reject order', variant: 'destructive' }),
    });
  };

  const handleLogout = async () => { await signOut(); navigate('/waiter/login'); };

  const getTableStatus = (tableId: string) => {
    const o = orders.find(o => o.table_id === tableId && o.status !== 'completed' && o.status !== 'cancelled');
    return o?.status || 'available';
  };

  const statusColor: Record<string, string> = {
    available: 'border-zinc-200 bg-zinc-50',
    pending: 'border-amber-400 bg-amber-50',
    confirmed: 'border-blue-400 bg-blue-50',
    preparing: 'border-indigo-400 bg-indigo-50',
    ready: 'border-emerald-400 bg-emerald-50',
    served: 'border-zinc-300 bg-zinc-100',
  };

  const statusLabel: Record<string, string> = {
    available: 'Available', pending: '⏳ Awaiting Review', confirmed: '👨‍🍳 In Kitchen',
    preparing: '🍳 Preparing', ready: '🔔 Ready to Serve', served: '✅ Served',
  };

  // ─────────────────────────────────────────────────────────────────────────────
  if (empLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Check-in gate: if OFF_DUTY show check-in screen ───────────────────────
  if (employee && employee.status !== 'ON_DUTY') {
    return (
      <TenantThemeProvider primaryColor={restaurant?.primary_color}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-6 max-w-sm w-full">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/30">
              <UtensilsCrossed className="w-10 h-10 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Welcome, {employee.full_name}!</h1>
              <p className="text-slate-400 mt-1">{restaurant?.name}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
              <p className="text-slate-300 text-sm">You are currently <span className="font-bold text-red-400">OFF DUTY</span></p>
              <p className="text-slate-400 text-xs">Check in to start your shift and see your assigned tables.</p>
              {assignedTableIds.length > 0 && (
                <p className="text-emerald-400 text-xs font-semibold">{assignedTableIds.length} table(s) assigned to you</p>
              )}
            </div>
            <Button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base gap-2"
            >
              {checkingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
              Check In — Start Shift
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-slate-500 text-sm gap-1">
              <LogOut className="w-4 h-4" /> Sign Out
            </Button>
          </motion.div>
        </div>
      </TenantThemeProvider>
    );
  }

  // ── Main dashboard ─────────────────────────────────────────────────────────
  return (
    <TenantThemeProvider primaryColor={restaurant?.primary_color} secondaryColor={restaurant?.secondary_color}>
      <div className="min-h-screen bg-background flex flex-col">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <UtensilsCrossed className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight">{employee?.full_name || 'Waiter'}</h1>
                <p className="text-[11px] text-muted-foreground">{restaurant?.name} · <span className="text-emerald-600 font-semibold">ON DUTY</span></p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={toggleMute}>
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCheckIn} disabled={checkingIn}
                className="h-8 gap-1.5 text-xs font-semibold text-amber-600 border-amber-300 hover:bg-amber-50">
                {checkingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Check Out
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
          </div>

          {/* ── Tab bar ──────────────────────────────────────────────────────── */}
          <div className="flex border-t">
            {([
              { id: 'orders', label: 'Order Review', icon: ClipboardList, badge: pendingOrders.length },
              { id: 'tables', label: 'My Tables', icon: Table2, badge: 0 },
              { id: 'calls',  label: 'Calls', icon: Bell, badge: pendingCalls.length },
            ] as { id: Tab; label: string; icon: any; badge: number }[]).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors relative',
                  activeTab === tab.id
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.badge > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-22px)] flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-black text-white">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        {/* ── Content ──────────────────────────────────────────────────────────── */}
        <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
          <AnimatePresence mode="wait">

            {/* ══ ORDER REVIEW TAB ══════════════════════════════════════════════ */}
            {activeTab === 'orders' && (
              <motion.div key="orders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Pending Orders — Awaiting Your Confirmation</h2>
                  <Badge variant="outline" className="text-xs">{pendingOrders.length} pending</Badge>
                </div>

                {pendingOrders.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-14 flex flex-col items-center gap-3 text-muted-foreground">
                      <CheckCircle2 className="w-10 h-10 opacity-30" />
                      <p className="text-sm font-semibold">All caught up!</p>
                      <p className="text-xs">New orders from your tables will appear here.</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingOrders.map(order => (
                    <motion.div key={order.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                      <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-900/10 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                                  Table {order.table_number || '?'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {order.created_at ? `${Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)}m ago` : ''}
                                </span>
                              </div>
                              <p className="text-sm font-bold mt-1">{order.customer_name || 'Guest'}</p>
                              <p className="text-xs text-muted-foreground">
                                {order.total_items || '?'} items · ₹{Number(order.total_amount || 0).toFixed(0)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black text-amber-600">₹{Number(order.total_amount || 0).toFixed(0)}</p>
                            </div>
                          </div>

                          {order.special_instructions && (
                            <div className="mb-3 text-xs bg-orange-100 dark:bg-orange-900/20 border border-orange-200 rounded-lg px-3 py-2 text-orange-700 dark:text-orange-400">
                              ⚠️ <span className="font-semibold">Note:</span> {order.special_instructions}
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline"
                              className="flex-1 h-9 rounded-xl gap-1.5 text-xs font-semibold border-zinc-300"
                              onClick={() => openOrderDetail(order)}>
                              <Eye className="w-3.5 h-3.5" /> View Details
                            </Button>
                            <Button size="sm"
                              className="flex-1 h-9 rounded-xl gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => confirmOrder(order.id)}
                              disabled={updateOrderStatus.isPending}>
                              <ChefHat className="w-3.5 h-3.5" /> Send to Kitchen
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))
                )}

                {/* Also show confirmed/in-progress orders on my tables */}
                {(() => {
                  const inProgress = orders.filter(o =>
                    ['confirmed', 'preparing', 'ready'].includes(o.status || '') &&
                    (assignedTableIds.length === 0 || assignedTableIds.includes(o.table_id || ''))
                  );
                  if (inProgress.length === 0) return null;
                  return (
                    <div className="mt-4 space-y-2">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">In Progress</h3>
                      {inProgress.map(order => (
                        <Card key={order.id} className="border-zinc-200">
                          <CardContent className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">Table {order.table_number || '?'}</Badge>
                              <span className="text-xs text-muted-foreground">{order.customer_name || 'Guest'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                                order.status === 'ready' ? 'bg-emerald-100 text-emerald-700' :
                                order.status === 'preparing' ? 'bg-indigo-100 text-indigo-700' :
                                'bg-blue-100 text-blue-700')}>
                                {order.status === 'ready' ? '🔔 Ready!' : order.status === 'preparing' ? '🍳 Preparing' : '👨‍🍳 In Kitchen'}
                              </span>
                              {order.status === 'ready' && (
                                <Button size="sm" className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1 font-bold"
                                  onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'served' })}>
                                  <Check className="w-3 h-3" /> Served
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                })()}
              </motion.div>
            )}

            {/* ══ MY TABLES TAB ════════════════════════════════════════════════ */}
            {activeTab === 'tables' && (
              <motion.div key="tables" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search tables…" value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)} className="pl-9 h-9 rounded-xl" />
                  </div>
                  <Badge variant="outline" className="text-xs whitespace-nowrap">{myTables.length} tables</Badge>
                </div>

                {assignedTableIds.length === 0 && (
                  <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    ⚠️ No tables assigned yet — showing all tables. Ask your manager to assign tables.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {filteredTables.map(table => {
                    const status = getTableStatus(table.id);
                    const tableOrders = orders.filter(o => o.table_id === table.id && o.status !== 'completed' && o.status !== 'cancelled');
                    const hasPending = tableOrders.some(o => o.status === 'pending');
                    return (
                      <motion.div key={table.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                        <Card className={cn('border-2 cursor-pointer transition-all', statusColor[status] || 'border-zinc-200 bg-white',
                          hasPending && 'ring-2 ring-amber-400 ring-offset-1')}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-black text-xl">{table.table_number}</h3>
                              {hasPending && (
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[9px] font-black text-white animate-bounce">!</span>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[10px] mb-2">{table.capacity || 4} seats</Badge>
                            <p className="text-xs font-semibold text-muted-foreground">{statusLabel[status] || status}</p>
                            {tableOrders.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                ₹{tableOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0).toFixed(0)} · {tableOrders.length} order(s)
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {Object.entries(statusLabel).map(([s, l]) => (
                    <span key={s} className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', statusColor[s])}>
                      {l}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ══ CALLS TAB ════════════════════════════════════════════════════ */}
            {activeTab === 'calls' && (
              <motion.div key="calls" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Waiter Calls</h2>
                  <Badge variant="destructive" className="text-[10px]">{pendingCalls.length} pending</Badge>
                </div>

                {pendingCalls.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-14 flex flex-col items-center gap-3 text-muted-foreground">
                      <PhoneCall className="w-10 h-10 opacity-30" />
                      <p className="text-sm font-semibold">No active calls</p>
                    </CardContent>
                  </Card>
                ) : (
                  <AnimatePresence>
                    {pendingCalls.map(call => (
                      <motion.div key={call.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                        <Card className="border-rose-300 bg-rose-50/50 dark:bg-rose-900/10">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-center mb-2">
                              <Badge className="bg-rose-500 text-white text-[10px] font-bold">
                                Table {(call as any).table?.table_number || '?'}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {call.created_at ? `${Math.floor((Date.now() - new Date(call.created_at).getTime()) / 60000)}m ago` : ''}
                              </span>
                            </div>
                            <CallReasonRenderer reason={call.reason} />
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 h-8 rounded-xl text-xs gap-1"
                                onClick={() => acknowledgeMutation.mutate({ id: call.id, userId: user?.id || '' })}
                                disabled={acknowledgeMutation.isPending}>
                                <AlertCircle className="w-3.5 h-3.5" /> Acknowledge
                              </Button>
                              <Button size="sm" className="flex-1 h-8 rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => resolveMutation.mutate({ id: call.id })}
                                disabled={resolveMutation.isPending}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ── Order Detail Dialog ─────────────────────────────────────────────── */}
        <Dialog open={!!selectedOrder} onOpenChange={open => !open && setSelectedOrder(null)}>
          <DialogContent className="max-w-sm rounded-2xl">
            <DialogHeader>
              <DialogTitle>Order Details — Table {selectedOrder?.table_number}</DialogTitle>
              <DialogDescription>Review the order before sending to kitchen.</DialogDescription>
            </DialogHeader>

            {orderItemsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-semibold">{selectedOrder?.customer_name || 'Guest'}</span>
                </div>

                <div className="border rounded-xl overflow-hidden">
                  {orderItems.map((item, i) => (
                    <div key={item.id} className={cn('flex items-center justify-between px-3 py-2.5 text-sm', i !== 0 && 'border-t')}>
                      <div className="flex items-center gap-2">
                        {item.menu_items?.image_url && (
                          <img src={item.menu_items.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                        )}
                        <div>
                          <p className="font-semibold">{item.menu_items?.name || 'Item'}</p>
                          {item.special_instructions && (
                            <p className="text-[10px] text-orange-600">⚠️ {item.special_instructions}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">x{item.quantity}</p>
                        <p className="text-[11px] text-muted-foreground">₹{Number((item.menu_items?.price || 0) * item.quantity).toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {selectedOrder?.special_instructions && (
                  <div className="text-xs bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-orange-700">
                    ⚠️ <strong>Note:</strong> {selectedOrder.special_instructions}
                  </div>
                )}

                <div className="flex items-center justify-between font-bold border-t pt-3">
                  <span>Total</span>
                  <span className="text-lg">₹{Number(selectedOrder?.total_amount || 0).toFixed(2)}</span>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1 rounded-xl gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => rejectOrder(selectedOrder?.id)} disabled={updateOrderStatus.isPending}>
                    <X className="w-4 h-4" /> Reject
                  </Button>
                  <Button className="flex-1 rounded-xl gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                    onClick={() => confirmOrder(selectedOrder?.id)} disabled={updateOrderStatus.isPending}>
                    <ChefHat className="w-4 h-4" /> Confirm & Send
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TenantThemeProvider>
  );
};

export default WaiterDashboard;
