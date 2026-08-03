import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2, XCircle, Printer, ChevronDown, ChevronUp,
  Loader2, Truck, ChefHat, Clock, Phone, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { invokeFunction } from "@/integrations/supabase/functions";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KOTPrint, parseItemsSummary, type KOTData } from "@/components/admin/KOTPrint";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "received" | "accepted" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";

type Platform = "zomato" | "swiggy" | "uber_eats" | "dunzo" | "direct" | "other";

interface PlatformOrder {
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
  prep_time_minutes: number | null;
  reject_reason: string | null;
  platform_accepted: boolean | null;
  kot_printed_at: string | null;
  created_at: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const PLATFORM_STYLE: Record<Platform, { label: string; color: string; bg: string; border: string }> = {
  zomato:    { label: "Zomato",    color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200" },
  swiggy:    { label: "Swiggy",    color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  uber_eats: { label: "Uber Eats", color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200" },
  dunzo:     { label: "Dunzo",     color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
  direct:    { label: "Direct",    color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200" },
  other:     { label: "Other",     color: "text-zinc-600",   bg: "bg-zinc-50",   border: "border-zinc-200" },
};

const STATUS_PIPELINE: { from: OrderStatus; to: OrderStatus; label: string; icon: React.ElementType }[] = [
  { from: "accepted",          to: "preparing",         label: "Start Preparing", icon: ChefHat },
  { from: "preparing",         to: "out_for_delivery",  label: "Out for Delivery", icon: Truck },
  { from: "out_for_delivery",  to: "delivered",         label: "Mark Delivered",  icon: CheckCircle2 },
];

const REJECT_REASONS = [
  { value: "item_unavailable", label: "Item not available" },
  { value: "too_busy",         label: "Too busy / high demand" },
  { value: "store_closed",     label: "Store closed" },
  { value: "other",            label: "Other" },
];

const PREP_TIMES = [10, 15, 20, 25, 30, 40, 45, 60];

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  order: PlatformOrder;
  restaurantName?: string;
  onRefresh: () => void;
}

export function PlatformOrderCard({ order, restaurantName, onRefresh }: Props) {
  const { toast } = useToast();
  const ps = PLATFORM_STYLE[order.platform] || PLATFORM_STYLE.other;

  const [expanded, setExpanded] = useState(order.status === "received");
  const [acting, setActing] = useState<string | null>(null);
  const [prepTime, setPrepTime] = useState("25");
  const [rejectReason, setRejectReason] = useState("item_unavailable");
  const [showReject, setShowReject] = useState(false);
  const [kotData, setKotData] = useState<KOTData | null>(null);

  const isPending = order.platform_accepted === null && order.status === "received";
  const isAccepted = order.platform_accepted === true;
  const isCancelled = order.status === "cancelled";
  const isDelivered = order.status === "delivered";

  // ── Platform action ──────────────────────────────────────────────────────
  const callAction = async (
    action: "accept" | "reject" | "status_update" | "cancel",
    extra: Record<string, any> = {}
  ) => {
    setActing(action);
    try {
      const { data, error } = await invokeFunction("platform-order-action", {
        body: {
          online_order_id: order.id,
          restaurant_id: order.restaurant_id,
          action,
          ...extra,
        },
      });
      if (error || data?.error) {
        const msg = data?.error || error?.message || "Unknown error";
        toast({ title: "Action failed", description: msg, variant: "destructive" });
      } else {
        toast({
          title: action === "accept" ? "Order Accepted ✅" : action === "reject" ? "Order Rejected" : "Status Updated",
          description: data?.error
            ? `Note: Local updated, but platform API returned: ${data.error}`
            : `${ps.label} order ${action === "accept" ? "accepted" : action === "reject" ? "rejected" : "updated"} successfully.`,
        });
        onRefresh();
        setShowReject(false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActing(null);
    }
  };

  // ── Print KOT ────────────────────────────────────────────────────────────
  const handlePrintKOT = async () => {
    setKotData({
      orderId: order.id,
      platform: order.platform,
      platformOrderId: order.platform_order_id || undefined,
      customerName: order.customer_name || undefined,
      customerPhone: order.customer_phone || undefined,
      deliveryAddress: order.delivery_address || undefined,
      items: parseItemsSummary(order.items_summary),
      notes: order.notes || undefined,
      prepTime: order.prep_time_minutes || undefined,
      createdAt: order.created_at,
      restaurantName,
    });
    // Mark KOT as printed
    await supabase
      .from("online_orders" as any)
      .update({ kot_printed_at: new Date().toISOString() })
      .eq("id", order.id);
  };

  // ── Next pipeline step ───────────────────────────────────────────────────
  const nextStep = STATUS_PIPELINE.find(s => s.from === order.status);

  return (
    <>
      <div className={`rounded-2xl border ${ps.border} bg-white dark:bg-zinc-900 shadow-sm overflow-hidden transition-all`}>
        {/* Card header */}
        <div
          className={`flex items-center gap-3 px-4 py-3 ${ps.bg} cursor-pointer`}
          onClick={() => setExpanded(e => !e)}
        >
          {/* Platform badge */}
          <span className={`text-xs font-black px-2.5 py-1 rounded-full bg-white/80 ${ps.color} border ${ps.border} shrink-0`}>
            {ps.label}
          </span>
          {/* Order ID */}
          <span className="font-mono text-xs text-zinc-500 shrink-0">
            {order.platform_order_id || `#${order.id.slice(-6).toUpperCase()}`}
          </span>
          {/* Customer */}
          <span className="font-semibold text-sm truncate flex-1">
            {order.customer_name || "Customer"}
          </span>
          {/* Amount */}
          <span className="font-bold text-sm shrink-0">₹{Number(order.net_amount || 0).toLocaleString()}</span>
          {/* Time */}
          <span className="text-xs text-zinc-400 shrink-0 hidden sm:block">
            {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
          </span>
          {/* Status badge */}
          <StatusBadge status={order.status} />
          {/* Expand */}
          <button className="text-zinc-400 shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded body */}
        {expanded && (
          <div className="px-4 py-4 space-y-4 border-t border-zinc-100 dark:border-zinc-800">
            {/* Customer info */}
            {(order.customer_phone || order.delivery_address) && (
              <div className="flex flex-wrap gap-3 text-sm">
                {order.customer_phone && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" /> {order.customer_phone}
                  </span>
                )}
                {order.delivery_address && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" /> {order.delivery_address}
                  </span>
                )}
              </div>
            )}

            {/* Items */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Order Items</p>
              {parseItemsSummary(order.items_summary).map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-black">
                    {item.quantity}
                  </span>
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
              ))}
              {order.notes && (
                <div className="text-xs italic text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2 mt-1">
                  📝 {order.notes}
                </div>
              )}
            </div>

            {/* Financials */}
            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">Subtotal</span>
                <p className="font-semibold">₹{Number(order.subtotal).toLocaleString()}</p>
              </div>
              {order.platform_commission > 0 && (
                <div>
                  <span className="text-muted-foreground text-xs">Commission</span>
                  <p className="font-semibold text-rose-500">-₹{Number(order.platform_commission).toLocaleString()}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground text-xs">You earn</span>
                <p className="font-black text-emerald-600">₹{Number(order.net_amount || 0).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Payment</span>
                <p className="font-semibold capitalize">{order.payment_method}</p>
              </div>
            </div>

            {/* KOT printed notice */}
            {order.kot_printed_at && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Printer className="w-3 h-3" /> KOT printed {formatDistanceToNow(new Date(order.kot_printed_at), { addSuffix: true })}
              </p>
            )}

            {/* ── Action buttons ─────────────────────────────────────── */}
            {!isCancelled && !isDelivered && (
              <div className="space-y-3">
                {/* Pending: Accept / Reject */}
                {isPending && !showReject && (
                  <div className="flex flex-wrap gap-2">
                    {/* Prep time selector */}
                    <Select value={prepTime} onValueChange={setPrepTime}>
                      <SelectTrigger className="w-28 h-9 text-xs rounded-xl">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PREP_TIMES.map(t => (
                          <SelectItem key={t} value={String(t)}>{t} min</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 h-9 flex-1 sm:flex-none"
                      disabled={acting === "accept"}
                      onClick={() => callAction("accept", { prep_time: parseInt(prepTime) })}
                    >
                      {acting === "accept"
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Accept ({prepTime}min)
                    </Button>

                    <Button
                      variant="outline"
                      className="rounded-xl gap-2 h-9 border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => setShowReject(true)}
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </Button>

                    <Button
                      variant="outline"
                      className="rounded-xl gap-2 h-9"
                      onClick={handlePrintKOT}
                    >
                      <Printer className="w-4 h-4" /> KOT
                    </Button>
                  </div>
                )}

                {/* Reject reason selector */}
                {showReject && (
                  <div className="flex flex-wrap gap-2 items-center p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800">
                    <p className="text-xs font-semibold text-destructive w-full">Select rejection reason:</p>
                    <Select value={rejectReason} onValueChange={setRejectReason}>
                      <SelectTrigger className="flex-1 h-9 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REJECT_REASONS.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-xl h-9"
                      disabled={acting === "reject"}
                      onClick={() => callAction("reject", { reject_reason: rejectReason })}
                    >
                      {acting === "reject" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm Reject"}
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-xl h-9" onClick={() => setShowReject(false)}>
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Accepted: status pipeline + KOT */}
                {isAccepted && (
                  <div className="flex flex-wrap gap-2">
                    {nextStep && (
                      <Button
                        className="rounded-xl gap-2 h-9 flex-1 sm:flex-none"
                        disabled={acting === "status_update"}
                        onClick={() => callAction("status_update", { new_status: nextStep.to })}
                      >
                        {acting === "status_update"
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <nextStep.icon className="w-4 h-4" />}
                        {nextStep.label}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="rounded-xl gap-2 h-9"
                      onClick={handlePrintKOT}
                    >
                      <Printer className="w-4 h-4" /> {order.kot_printed_at ? "Reprint KOT" : "Print KOT"}
                    </Button>
                    {order.status !== "out_for_delivery" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl h-9 text-destructive hover:bg-destructive/10"
                        disabled={acting === "cancel"}
                        onClick={() => callAction("cancel")}
                      >
                        {acting === "cancel" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Cancelled / Delivered state */}
            {(isCancelled || isDelivered) && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl gap-2"
                  onClick={handlePrintKOT}
                >
                  <Printer className="w-3.5 h-3.5" /> Print KOT
                </Button>
                {order.reject_reason && (
                  <span className="text-xs text-muted-foreground self-center">
                    Rejected: {REJECT_REASONS.find(r => r.value === order.reject_reason)?.label || order.reject_reason}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KOT print modal */}
      {kotData && <KOTPrint data={kotData} onClose={() => setKotData(null)} />}
    </>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; class: string }> = {
    received:          { label: "New",          class: "bg-amber-100 text-amber-700 border-amber-300" },
    accepted:          { label: "Accepted",      class: "bg-blue-100 text-blue-700 border-blue-300" },
    preparing:         { label: "Preparing",     class: "bg-indigo-100 text-indigo-700 border-indigo-300" },
    out_for_delivery:  { label: "On the way",    class: "bg-purple-100 text-purple-700 border-purple-300" },
    delivered:         { label: "Delivered",     class: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    cancelled:         { label: "Cancelled",     class: "bg-red-100 text-red-700 border-red-300" },
  };
  const s = map[status] || map.received;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${s.class}`}>
      {s.label}
    </span>
  );
}
