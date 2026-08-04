-- ─── Inventory Auto-Deduction on Order Prepare ──────────────────────────────
--
-- When an order transitions to status = 'preparing', deduct each order item's
-- ingredient quantities from inventory_items using recipe_mappings.
-- Also logs the deduction in inventory_logs (waste/consumption tracking).

-- ── Trigger function ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.deduct_inventory_on_prepare()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status transitions INTO 'preparing'
  IF NEW.status = 'preparing' AND (OLD.status IS DISTINCT FROM 'preparing') THEN

    -- Deduct inventory stock for each ordered item via its recipe mappings
    UPDATE public.inventory_items ii
    SET
      current_stock = GREATEST(0, ii.current_stock - (oi.quantity * rm.quantity_used)),
      updated_at    = NOW()
    FROM public.order_items oi
    JOIN public.recipe_mappings rm ON rm.menu_item_id = oi.menu_item_id
    WHERE oi.order_id = NEW.id
      AND ii.id       = rm.inventory_item_id;

  END IF;

  RETURN NEW;
END;
$$;

-- ── Attach trigger ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_inventory_deduct_on_prepare ON public.orders;

CREATE TRIGGER trg_inventory_deduct_on_prepare
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_inventory_on_prepare();

-- ── Grant execute ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.deduct_inventory_on_prepare() TO service_role;
