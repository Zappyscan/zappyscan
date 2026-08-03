import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";
import { analyticsService } from "@/services/analyticsService";

export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type OrderStatus = Enums<"order_status">;
export type OrderInsert = TablesInsert<"orders">;
export type OrderItemInsert = TablesInsert<"order_items">;

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  table?: Pick<Tables<"tables">, "id" | "table_number"> | null;
}

export function useOrders(restaurantId?: string, status?: OrderStatus | OrderStatus[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["orders", restaurantId, status],
    queryFn: async () => {
      if (!restaurantId) return [];
      
      let query = supabase
        .from("orders")
        .select(`
          *,
          order_items(*),
          table:tables(id, table_number)
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (status) {
        if (Array.isArray(status)) {
          query = query.in("status", status);
        } else {
          query = query.eq("status", status);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as OrderWithItems[];
    },
    enabled: !!restaurantId,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Real-time subscription for order updates
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`orders-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["orders", restaurantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, queryClient]);

  return query;
}

export function useOrder(orderId?: string) {
  return useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(*),
          table:tables(id, table_number)
        `)
        .eq("id", orderId)
        .maybeSingle();

      if (error) throw error;
      return data as OrderWithItems;
    },
    enabled: !!orderId,
  });
}

export function useTodayOrders(restaurantId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return useQuery({
    queryKey: ["orders", "today", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(*)
        `)
        .eq("restaurant_id", restaurantId)
        .gte("created_at", today.toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as OrderWithItems[];
    },
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      order,
      items,
    }: {
      order: Omit<OrderInsert, "order_number">;
      items: Omit<OrderItemInsert, "order_id">[];
    }) => {
      // Insert order first
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert(order)
        .select()
        .maybeSingle();

      if (orderError) throw orderError;
      if (!orderData) throw new Error("Order creation failed — please try again");

      // Insert order items
      const orderItems = items.map((item) => ({
        ...item,
        order_id: orderData.id,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return orderData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders", data.restaurant_id] });

      // Track order completed event
      analyticsService.trackEvent({
        campaignId: (data as any).coupon_code || 'organic_order',
        eventType: 'order_completed',
        tenantId: data.restaurant_id,
        metadata: {
          orderId: data.id,
          orderTotal: data.total_amount,
          discountAmount: (data as any).discount_amount || 0
        },
        revenueAmount: Number(data.total_amount) || 0
      });

      // Track coupon redemption if code exists
      if ((data as any).coupon_code) {
        analyticsService.trackCouponRedemption({
          couponCode: (data as any).coupon_code,
          campaignId: null,
          orderId: data.id,
          discountAmount: Number((data as any).discount_amount) || 0,
          orderTotal: Number(data.total_amount) || 0,
          tenantId: data.restaurant_id
        });
      }
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrderStatus }) => {
      const { data, error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["orders", data.restaurant_id] });
        queryClient.invalidateQueries({ queryKey: ["order", data.id] });
      }
    },
  });
}

export function useUpdateOrderPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      paymentMethod,
      paymentStatus,
    }: {
      id: string;
      paymentMethod: string;
      paymentStatus: Enums<"payment_status">;
    }) => {
      const { data, error } = await supabase
        .from("orders")
        .update({
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          status: "completed",
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ["orders", data.restaurant_id] });
        queryClient.invalidateQueries({ queryKey: ["order", data.id] });
      }
    },
  });
}

// Hook for kitchen-specific order status updates
export function useKitchenOrderActions(restaurantId?: string) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  const startPreparing = useCallback(
    async (orderId: string) => {
      setIsPending(true);
      try {
        const now = new Date().toISOString();

        const { data: order } = await supabase
          .from("orders")
          .select("table_session_id")
          .eq("id", orderId)
          .maybeSingle();

        const { error } = await supabase
          .from("orders")
          .update({ status: "preparing" as const, started_preparing_at: now })
          .eq("id", orderId);
        if (error) throw error;

        // Stamp order_placed_at on session if not yet set
        if (order?.table_session_id) {
          await supabase
            .from("table_sessions")
            .update({ order_placed_at: now, status: "preparing" })
            .eq("id", order.table_session_id)
            .is("order_placed_at", null);
        }

        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["table_sessions"] });
      } finally {
        setIsPending(false);
      }
    },
    [queryClient]
  );

  const markReady = useCallback(
    async (orderId: string) => {
      setIsPending(true);
      try {
        const now = new Date().toISOString();

        // 1. Fetch table_session_id before updating
        const { data: order } = await supabase
          .from("orders")
          .select("table_session_id")
          .eq("id", orderId)
          .maybeSingle();

        // 2. Mark order ready
        const { error } = await supabase
          .from("orders")
          .update({ status: "ready" as const, ready_at: now })
          .eq("id", orderId);
        if (error) throw error;

        // 3. Stamp food_ready_at on the session (first ready order wins)
        if (order?.table_session_id) {
          await supabase
            .from("table_sessions")
            .update({ food_ready_at: now, status: "served" })
            .eq("id", order.table_session_id)
            .is("food_ready_at", null);
        }

        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["table_sessions"] });
      } finally {
        setIsPending(false);
      }
    },
    [queryClient]
  );

  const markServed = useCallback(
    async (orderId: string) => {
      setIsPending(true);
      try {
        const now = new Date().toISOString();

        // 1. Fetch table_session_id before updating
        const { data: order } = await supabase
          .from("orders")
          .select("table_session_id")
          .eq("id", orderId)
          .maybeSingle();

        // 2. Mark order served
        const { error } = await supabase
          .from("orders")
          .update({ status: "served" as const })
          .eq("id", orderId);
        if (error) throw error;

        // 3. Stamp served_at on the session (first served order wins)
        if (order?.table_session_id) {
          await supabase
            .from("table_sessions")
            .update({ served_at: now, status: "dining" })
            .eq("id", order.table_session_id)
            .is("served_at", null);
        }

        queryClient.invalidateQueries({ queryKey: ["orders"] });
        queryClient.invalidateQueries({ queryKey: ["table_sessions"] });
      } finally {
        setIsPending(false);
      }
    },
    [queryClient]
  );

  return {
    startPreparing,
    markReady,
    markServed,
    isLoading: isPending,
  };
}
