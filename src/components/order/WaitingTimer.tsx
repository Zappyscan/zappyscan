import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChefHat, CheckCircle2, Timer, Eye, XCircle, AlertTriangle, PlusCircle, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { OrderWithItems } from "@/hooks/useOrders";

interface WaitingTimerProps {
  order: OrderWithItems;
  estimatedMinutes?: number;
  currencySymbol?: string;
  onViewDetails?: () => void;
  onAddMoreItems?: () => void;
}

export function WaitingTimer({
  order,
  estimatedMinutes = 15,
  currencySymbol = "₹",
  onViewDetails,
  onAddMoreItems,
}: WaitingTimerProps) {
  // Memoize createdAt timestamp to prevent timer resets on re-renders
  const createdAtMs = useMemo(() => {
    if (!order.created_at) return null;
    return new Date(order.created_at).getTime();
  }, [order.created_at]);

  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (!createdAtMs) return 0;
    return Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
  });

  useEffect(() => {
    if (!createdAtMs) return;
    const activeStatuses = new Set(['pending', 'confirmed', 'preparing']);
    const calculateElapsed = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000)));
    };
    calculateElapsed();
    if (activeStatuses.has(order.status || '')) {
      const interval = setInterval(calculateElapsed, 1000);
      return () => clearInterval(interval);
    }
    return;
  }, [createdAtMs, order.status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = useMemo(() => {
    const estimatedSeconds = estimatedMinutes * 60;
    return Math.min(100, (elapsedSeconds / estimatedSeconds) * 100);
  }, [elapsedSeconds, estimatedMinutes]);

  const getStatusInfo = () => {
    switch (order.status) {
      case "pending":
        return { icon: Clock, text: "Order Received", color: "text-warning", bgColor: "bg-warning/20", description: "Waiting for waiter to confirm" };
      case "confirmed":
        return { icon: CheckCircle2, text: "Order Confirmed", color: "text-info", bgColor: "bg-info/20", description: "Kitchen is about to start cooking" };
      case "preparing":
        return { icon: ChefHat, text: "Being Prepared", color: "text-primary", bgColor: "bg-primary/20", description: "Chef is cooking your food" };
      case "ready":
        return { icon: CheckCircle2, text: "Ready! 🎉", color: "text-success", bgColor: "bg-success/20", description: "Your food is ready — waiter is on the way!" };
      case "served":
        return { icon: UtensilsCrossed, text: "Served", color: "text-success", bgColor: "bg-success/20", description: "Enjoy your meal! 😊" };
      default:
        return { icon: Clock, text: "Processing", color: "text-muted-foreground", bgColor: "bg-muted", description: "Order is being processed" };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;
  const isPreparing = order.status === "preparing" || order.status === "confirmed";

  // ── Cancel logic ─────────────────────────────────────────────────────────────
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Allow cancel for pending, confirmed, preparing — not for ready/served/completed
  const canCancel = ["pending", "confirmed", "preparing"].includes(order.status || "");
  const isKitchenStarted = order.status === "preparing";

  const handleCancel = async () => {
    setCancelling(true);
    const { error } = await supabase
      .from("orders")
      .update({
        status: "cancelled" as const,
        cancel_reason: "Customer request",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", order.id);
    if (error) {
      toast({ title: "Error", description: "Could not cancel. Please ask a waiter.", variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast({ title: "Order Cancelled", description: "Your order has been cancelled." });
      setShowCancelConfirm(false);
    }
    setCancelling(false);
  };

  // ── Show "add more" for any non-terminal state ───────────────────────────────
  const showAddMore = onAddMoreItems && !["completed", "cancelled", "served"].includes(order.status || "");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-0 shadow-lg overflow-hidden">
        <CardContent className="p-0">
          {/* Status Header */}
          <div className={`${statusInfo.bgColor} px-4 py-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon className={`w-5 h-5 ${statusInfo.color}`} />
                <span className={`font-semibold ${statusInfo.color}`}>{statusInfo.text}</span>
              </div>
              <Badge variant="outline" className="border-current">
                {order.token_no ? `TOKEN ${order.token_no}` : `#${order.order_number}`}
              </Badge>
            </div>
          </div>

          {/* Timer */}
          <div className="p-6">
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 mb-4">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <motion.circle
                    cx="50" cy="50" r="45" fill="none"
                    stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${progress * 2.83} 283`}
                    initial={{ strokeDasharray: "0 283" }}
                    animate={{ strokeDasharray: `${progress * 2.83} 283` }}
                    transition={{ duration: 0.5 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  {isPreparing && (
                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                      <Timer className="w-5 h-5 text-primary mb-1" />
                    </motion.div>
                  )}
                  <span className="text-2xl font-bold font-mono">{formatTime(elapsedSeconds)}</span>
                  <span className="text-xs text-muted-foreground">elapsed</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-1">{statusInfo.description}</p>
              <p className="text-sm font-medium">
                Estimated wait:{" "}
                <span className="text-primary">
                  {(() => {
                    const remaining = estimatedMinutes - Math.floor(elapsedSeconds / 60);
                    if (remaining <= 0 || order.status === "ready") return "Almost ready!";
                    return `~${remaining} min${remaining > 1 ? 's' : ''}`;
                  })()}
                </span>
              </p>
            </div>

            {/* Actions */}
            <div className="mt-4 pt-4 border-t space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{order.order_items?.length || 0} items</span>
                <span className="font-semibold">{currencySymbol}{Number(order.total_amount || 0).toFixed(2)}</span>
              </div>

              {/* Primary action buttons row */}
              <div className="flex gap-2">
                {onViewDetails && (
                  <Button variant="outline" size="sm" className="flex-1" onClick={onViewDetails}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Details
                  </Button>
                )}
                {showAddMore && (
                  <Button size="sm" className="flex-1 bg-primary text-primary-foreground font-semibold" onClick={onAddMoreItems}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add More Items
                  </Button>
                )}
              </div>

              {/* Cancel — available any time while order is active */}
              {canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border border-destructive/20"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Order
                </Button>
              )}

              {/* Ready — can't cancel, food is made */}
              {order.status === "ready" && (
                <p className="text-xs text-center text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  🍽 Your food is ready — cancellation not available at this stage.
                </p>
              )}

              {/* Cancel confirm prompt */}
              <AnimatePresence>
                {showCancelConfirm && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                        <AlertTriangle className="w-4 h-4" />
                        {isKitchenStarted ? "Kitchen has started cooking!" : "Cancel this order?"}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isKitchenStarted
                          ? "The kitchen is already preparing your food. Cancelling now may result in charges. Are you sure?"
                          : "This cannot be undone. The kitchen will be notified."}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs"
                          onClick={() => setShowCancelConfirm(false)} disabled={cancelling}>
                          Keep Order
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs"
                          onClick={handleCancel} disabled={cancelling}>
                          {cancelling ? "Cancelling…" : "Yes, Cancel"}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
