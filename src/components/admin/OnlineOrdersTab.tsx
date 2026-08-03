import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  Plus, RefreshCw, Loader2, Bike, Package, CheckCircle2,
  XCircle, Clock, ChefHat, Truck, Filter, TrendingUp,
  IndianRupee, ShoppingBag, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { PlatformIntegrations } from "@/components/admin/PlatformIntegrations";

// ─── Types ──────────────────────────────────────────────────────────────────

type Platform = "zomato" | "swiggy" | "dunzo" | "uber_eats" | "direct" | "other";
type OrderStatus =
  | "received"
  | "accepted"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

interface OnlineOrder {
  id: string;
  restaurant_id: string;
  platform: Platform;
  platform_order_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  items_summary: string;
  subtotal: number;
  platform_commission: number;
  net_amount: number;
  status: OrderStatus;
  payment_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Config ─────────────────────────────────────────────────────────────────

const PLATFORMS: { value: Platform; label: string; color: string; bg: string }[] = [
  { value: "zomato",    label: "Zomato",    color: "text-red-600",    bg: "bg-red-50 border-red-200" },
  { value: "swiggy",   label: "Swiggy",    color: "text-orange-500", bg: "bg-orange-50 border-orange-200" },
  { value: "dunzo",    label: "Dunzo",     color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  { value: "uber_eats",label: "Uber Eats", color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-200" },
  { value: "direct",   label: "Direct",    color: "text-blue-600",   bg: "bg-blue-50 border-blue-200" },
  { value: "other",    label: "Other",     color: "text-zinc-600",   bg: "bg-zinc-50 border-zinc-200" },
];

const STATUSES: { value: OrderStatus; label: string; icon: React.ElementType; variant: string }[] = [
  { value: "received",         label: "Received",           icon: Clock,         variant: "secondary" },
  { value: "accepted",         label: "Accepted",           icon: CheckCircle2,  variant: "default" },
  { value: "preparing",        label: "Preparing",          icon: ChefHat,       variant: "default" },
  { value: "out_for_delivery", label: "Out for Delivery",   icon: Truck,         variant: "default" },
  { value: "delivered",        label: "Delivered",          icon: CheckCircle2,  variant: "outline" },
  { value: "cancelled",        label: "Cancelled",          icon: XCircle,       variant: "destructive" },
];

const platformInfo = (p: Platform) => PLATFORMS.find(x => x.value === p) ?? PLATFORMS[5];
const statusInfo   = (s: OrderStatus) => STATUSES.find(x => x.value === s) ?? STATUSES[0];

// ─── Empty form ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  platform: "zomato" as Platform,
  platform_order_id: "",
  customer_name: "",
  customer_phone: "",
  delivery_address: "",
  items_summary: "",
  subtotal: "",
  platform_commission: "",
  payment_method: "online",
  notes: "",
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function OnlineOrdersTab({ restaurantId }: { restaurantId: string }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filterPlatform, setFilterPlatform] = useState<Platform | "all">("all");
  const [filterStatus, setFilterStatus] = useState<OrderStatus | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("online_orders" as any)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error(error);
    } else {
      setOrders((data as OnlineOrder[]) || []);
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`online_orders_${restaurantId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "online_orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, load]);

  // ── Submit new order ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.items_summary.trim() || !form.subtotal) {
      toast({ title: "Validation", description: "Items and subtotal are required.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("online_orders" as any).insert({
      restaurant_id: restaurantId,
      platform: form.platform,
      platform_order_id: form.platform_order_id || null,
      customer_name: form.customer_name || null,
      customer_phone: form.customer_phone || null,
      delivery_address: form.delivery_address || null,
      items_summary: form.items_summary,
      subtotal: parseFloat(form.subtotal) || 0,
      platform_commission: parseFloat(form.platform_commission) || 0,
      payment_method: form.payment_method,
      notes: form.notes || null,
      status: "received",
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Order logged!", description: `New ${platformInfo(form.platform).label} order added.` });
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    }
  };

  // ── Update status ────────────────────────────────────────────────────────
  const updateStatus = async (id: string, status: OrderStatus) => {
    setUpdatingId(id);
    const { error } = await supabase
      .from("online_orders" as any)
      .update({ status })
      .eq("id", id);
    setUpdatingId(null);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const todayOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });
  const totalRevenue = todayOrders.reduce((s, o) => s + (o.net_amount || 0), 0);
  const active = orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length;

  const platformStats = PLATFORMS.map(p => ({
    ...p,
    count: orders.filter(o => o.platform === p.value).length,
    revenue: orders
      .filter(o => o.platform === p.value && o.status === "delivered")
      .reduce((s, o) => s + (o.net_amount || 0), 0),
  }));

  // ── Filtered orders ──────────────────────────────────────────────────────
  const filtered = orders.filter(o =>
    (filterPlatform === "all" || o.platform === filterPlatform) &&
    (filterStatus  === "all" || o.status  === filterStatus)
  );

  // ── Status pipeline helper ───────────────────────────────────────────────
  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    received:          "accepted",
    accepted:          "preparing",
    preparing:         "out_for_delivery",
    out_for_delivery:  "delivered",
    delivered:         null,
    cancelled:         null,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-card p-4 sm:p-6 border rounded-3xl shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bike className="w-6 h-6 text-primary" /> Online Orders
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage orders from Zomato, Swiggy, Dunzo, Uber Eats and direct delivery
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" className="rounded-xl gap-1.5" onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4" /> Log Order
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600"><ShoppingBag className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground">Today's Orders</p>
              <p className="text-xl font-black">{todayOrders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600"><IndianRupee className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground">Today's Net Revenue</p>
              <p className="text-xl font-black">₹{totalRevenue.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600"><Clock className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground">Active Orders</p>
              <p className="text-xl font-black">{active}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600"><BarChart3 className="w-5 h-5" /></div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground">Total Orders</p>
              <p className="text-xl font-black">{orders.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="orders" className="rounded-lg text-xs px-4">Live Orders</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg text-xs px-4">Platform Analytics</TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-lg text-xs px-4">API Integrations</TabsTrigger>
        </TabsList>

        {/* ── Orders tab ─────────────────────────────────────────────────── */}
        <TabsContent value="orders" className="space-y-4 outline-none">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={filterPlatform} onValueChange={v => setFilterPlatform(v as any)}>
              <SelectTrigger className="w-36 h-8 text-xs rounded-xl">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Platforms</SelectItem>
                {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
              <SelectTrigger className="w-40 h-8 text-xs rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bike className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">No online orders yet</p>
              <p className="text-sm">Click "Log Order" to add an incoming delivery order</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">Platform</TableHead>
                    <TableHead className="font-semibold">Order ID</TableHead>
                    <TableHead className="font-semibold">Customer</TableHead>
                    <TableHead className="font-semibold">Items</TableHead>
                    <TableHead className="font-semibold">Net Amount</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Time</TableHead>
                    <TableHead className="font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {filtered.map(order => {
                      const pi = platformInfo(order.platform);
                      const si = statusInfo(order.status);
                      const StatusIcon = si.icon;
                      const next = nextStatus[order.status];
                      return (
                        <TableRow key={order.id} className="hover:bg-muted/40">
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${pi.bg} ${pi.color}`}>
                              {pi.label}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {order.platform_order_id || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{order.customer_name || "—"}</div>
                            {order.customer_phone && <div className="text-xs text-muted-foreground">{order.customer_phone}</div>}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[180px] text-xs text-muted-foreground line-clamp-2">
                              {order.items_summary}
                            </div>
                          </TableCell>
                          <TableCell className="font-bold">
                            ₹{Number(order.net_amount ?? 0).toLocaleString()}
                            {order.platform_commission > 0 && (
                              <div className="text-[10px] text-rose-500 font-normal">
                                Commission: ₹{Number(order.platform_commission).toLocaleString()}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={si.variant as any}
                              className="gap-1 text-xs whitespace-nowrap"
                            >
                              <StatusIcon className="w-3 h-3" />
                              {si.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                          </TableCell>
                          <TableCell className="text-right">
                            {next && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs h-7"
                                disabled={updatingId === order.id}
                                onClick={() => updateStatus(order.id, next)}
                              >
                                {updatingId === order.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : `→ ${statusInfo(next).label}`}
                              </Button>
                            )}
                            {order.status !== "cancelled" && order.status !== "delivered" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-lg text-xs h-7 ml-1 text-destructive hover:bg-destructive/10"
                                disabled={updatingId === order.id}
                                onClick={() => updateStatus(order.id, "cancelled")}
                              >
                                Cancel
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Analytics tab ──────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformStats.filter(p => p.count > 0).map(p => (
              <Card key={p.value} className="border rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className={`text-base font-bold ${p.color}`}>{p.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total orders</span>
                    <span className="font-bold">{p.count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivered</span>
                    <span className="font-bold">
                      {orders.filter(o => o.platform === p.value && o.status === "delivered").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cancelled</span>
                    <span className="font-bold text-destructive">
                      {orders.filter(o => o.platform === p.value && o.status === "cancelled").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground">Net revenue</span>
                    <span className="font-black text-emerald-600">₹{p.revenue.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {platformStats.every(p => p.count === 0) && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No data yet</p>
                <p className="text-sm">Start logging orders to see platform analytics</p>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── API Integrations tab ───────────────────────────────────────── */}
        <TabsContent value="integrations" className="outline-none">
          <PlatformIntegrations restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>

      {/* ── Log Order Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl" aria-describedby="log-order-desc">
          <DialogHeader>
            <DialogTitle>Log Incoming Online Order</DialogTitle>
            <DialogDescription id="log-order-desc">
              Add a delivery order received from Zomato, Swiggy, or any other platform.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {/* Platform */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Platform *</Label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, platform: p.value }))}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      form.platform === p.value
                        ? `${p.bg} ${p.color} ring-2 ring-offset-1 ring-current`
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Platform Order ID */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Platform Order ID</Label>
              <Input
                placeholder="e.g. ZO12345678"
                value={form.platform_order_id}
                onChange={e => setForm(f => ({ ...f, platform_order_id: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            {/* Customer */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Customer Name</Label>
                <Input
                  placeholder="Customer name"
                  value={form.customer_name}
                  onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone</Label>
                <Input
                  placeholder="+91 XXXXX XXXXX"
                  value={form.customer_phone}
                  onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Items */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Items Summary *</Label>
              <Textarea
                placeholder="e.g. 2x Butter Chicken, 3x Naan, 1x Gulab Jamun"
                value={form.items_summary}
                onChange={e => setForm(f => ({ ...f, items_summary: e.target.value }))}
                className="rounded-xl min-h-[80px]"
                required
              />
            </div>

            {/* Financials */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Subtotal (₹) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.subtotal}
                  onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))}
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Platform Commission (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.platform_commission}
                  onChange={e => setForm(f => ({ ...f, platform_commission: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Net preview */}
            {form.subtotal && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-2.5 text-sm flex justify-between">
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">Your net amount</span>
                <span className="font-black text-emerald-700 dark:text-emerald-300">
                  ₹{Math.max(0, (parseFloat(form.subtotal)||0) - (parseFloat(form.platform_commission)||0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Payment + notes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Payment</Label>
                <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online / Prepaid</SelectItem>
                    <SelectItem value="cod">Cash on Delivery</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Notes</Label>
                <Input
                  placeholder="Any special note"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </div>

            <Button type="submit" className="w-full rounded-2xl h-11 font-bold" disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Log Order
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
