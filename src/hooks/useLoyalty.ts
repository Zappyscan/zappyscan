import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a map of { phone → points } for a restaurant.
 */
export function useLoyaltyPoints(restaurantId?: string) {
  return useQuery({
    queryKey: ["loyalty_points", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return {} as Record<string, number>;
      const { data, error } = await supabase
        .from("customer_loyalty_points")
        .select("phone, points")
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach(row => {
        map[row.phone] = row.points;
      });
      return map;
    },
    enabled: !!restaurantId,
  });
}

/**
 * Upserts the point balance for a (restaurant_id, phone) pair.
 */
export function useUpsertLoyaltyPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      phone,
      points,
    }: {
      restaurantId: string;
      phone: string;
      points: number;
    }) => {
      const { error } = await supabase
        .from("customer_loyalty_points")
        .upsert(
          { restaurant_id: restaurantId, phone, points },
          { onConflict: "restaurant_id,phone" }
        );
      if (error) throw error;
      return { restaurantId };
    },
    onSuccess: (d) =>
      qc.invalidateQueries({ queryKey: ["loyalty_points", d.restaurantId] }),
  });
}
