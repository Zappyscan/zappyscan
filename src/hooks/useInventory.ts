import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  current_stock: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeMapping {
  id: string;
  menu_item_id: string;
  inventory_item_id: string;
  quantity_used: number;
}

export function useInventoryItems(restaurantId?: string) {
  return useQuery({
    queryKey: ["inventory_items", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!restaurantId,
  });
}

export function useCreateInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { restaurant_id: string; name: string; unit?: string; current_stock?: number; low_stock_threshold?: number }) => {
      const { data, error } = await supabase.from("inventory_items").insert(item).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_items", d.restaurant_id] }),
  });
}

export function useUpdateInventoryStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, current_stock, restaurantId }: { id: string; current_stock: number; restaurantId: string }) => {
      const { error } = await supabase.from("inventory_items").update({ current_stock }).eq("id", id);
      if (error) throw error;
      return { restaurantId };
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_items", d.restaurantId] }),
  });
}

export function useDeleteInventoryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
      return { restaurantId };
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_items", d.restaurantId] }),
  });
}

export function useRecipeMappings(menuItemId?: string) {
  return useQuery({
    queryKey: ["recipe_mappings", menuItemId],
    queryFn: async () => {
      if (!menuItemId) return [];
      const { data, error } = await supabase
        .from("recipe_mappings")
        .select("*, inventory_items(name, unit)")
        .eq("menu_item_id", menuItemId);
      if (error) throw error;
      return data as (RecipeMapping & { inventory_items: { name: string; unit: string } })[];
    },
    enabled: !!menuItemId,
  });
}

export function useCreateRecipeMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: { menu_item_id: string; inventory_item_id: string; quantity_used: number }) => {
      const { data, error } = await supabase.from("recipe_mappings").insert(mapping).select().maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["recipe_mappings", d.menu_item_id] }),
  });
}

export function useDeleteRecipeMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, menuItemId }: { id: string; menuItemId: string }) => {
      const { error } = await supabase.from("recipe_mappings").delete().eq("id", id);
      if (error) throw error;
      return { menuItemId };
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["recipe_mappings", d.menuItemId] }),
  });
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  restaurant_id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
}

export function useSuppliers(restaurantId?: string) {
  return useQuery({
    queryKey: ["inventory_suppliers", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("inventory_suppliers")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");
      if (error) throw error;
      return (data || []) as Supplier[];
    },
    enabled: !!restaurantId,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (supplier: Omit<Supplier, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("inventory_suppliers")
        .insert(supplier)
        .select()
        .single();
      if (error) throw error;
      return data as Supplier;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_suppliers", d.restaurant_id] }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      const { error } = await supabase.from("inventory_suppliers").delete().eq("id", id);
      if (error) throw error;
      return { id, restaurantId };
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_suppliers", d.restaurantId] }),
  });
}

// ─── Waste Logs ───────────────────────────────────────────────────────────────

export interface WasteLog {
  id: string;
  restaurant_id: string;
  inventory_item_id: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  reason: "SPOILAGE" | "EXPIRED" | "DAMAGED" | "OTHER";
  logged_at: string;
  created_at: string;
}

export function useWasteLogs(restaurantId?: string) {
  return useQuery({
    queryKey: ["inventory_waste_logs", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("inventory_waste_logs")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("logged_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as WasteLog[];
    },
    enabled: !!restaurantId,
  });
}

export function useCreateWasteLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (log: Omit<WasteLog, "id" | "created_at" | "logged_at">) => {
      const { data, error } = await supabase
        .from("inventory_waste_logs")
        .insert(log)
        .select()
        .single();
      if (error) throw error;
      return data as WasteLog;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_waste_logs", d.restaurant_id] }),
  });
}

export function useDeleteWasteLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      const { error } = await supabase.from("inventory_waste_logs").delete().eq("id", id);
      if (error) throw error;
      return { id, restaurantId };
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_waste_logs", d.restaurantId] }),
  });
}

// ─── Purchase Orders ──────────────────────────────────────────────────────────

export interface POItem {
  itemName: string;
  quantity: number;
  costPrice: number;
}

export interface PurchaseOrder {
  id: string;
  restaurant_id: string;
  po_number: string;
  supplier_id: string | null;
  supplier_name: string;
  status: "PENDING" | "RECEIVED" | "CANCELLED";
  total_amount: number;
  items: POItem[];
  ordered_at: string;
  created_at: string;
}

export function usePurchaseOrders(restaurantId?: string) {
  return useQuery({
    queryKey: ["inventory_purchase_orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("inventory_purchase_orders")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(row => ({
        ...row,
        items: (row.items as unknown as POItem[]) || [],
        total_amount: Number(row.total_amount),
      })) as PurchaseOrder[];
    },
    enabled: !!restaurantId,
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (po: Omit<PurchaseOrder, "id" | "created_at" | "ordered_at">) => {
      const { data, error } = await supabase
        .from("inventory_purchase_orders")
        .insert({ ...po, items: po.items as any })
        .select()
        .single();
      if (error) throw error;
      return data as PurchaseOrder;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_purchase_orders", d.restaurant_id] }),
  });
}

export function useUpdatePOStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, restaurantId }: { id: string; status: PurchaseOrder["status"]; restaurantId: string }) => {
      const { error } = await supabase
        .from("inventory_purchase_orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return { id, restaurantId };
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_purchase_orders", d.restaurantId] }),
  });
}

export function useDeletePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      const { error } = await supabase.from("inventory_purchase_orders").delete().eq("id", id);
      if (error) throw error;
      return { id, restaurantId };
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["inventory_purchase_orders", d.restaurantId] }),
  });
}
