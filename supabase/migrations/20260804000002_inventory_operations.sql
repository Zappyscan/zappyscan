-- ─── Inventory Operations ───────────────────────────────────────────────────
-- Suppliers, waste logs, and purchase orders for restaurant inventory management.

-- ── Suppliers ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_person TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_suppliers_restaurant
  ON public.inventory_suppliers (restaurant_id);

ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_restaurant_access" ON public.inventory_suppliers;
CREATE POLICY "supplier_restaurant_access" ON public.inventory_suppliers
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

-- ── Waste Logs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_waste_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  inventory_item_id   UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  item_name           TEXT NOT NULL,
  quantity            NUMERIC(10,3) NOT NULL,
  unit                TEXT NOT NULL DEFAULT 'kg',
  reason              TEXT NOT NULL DEFAULT 'SPOILAGE'
                        CHECK (reason IN ('SPOILAGE','EXPIRED','DAMAGED','OTHER')),
  logged_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_waste_restaurant
  ON public.inventory_waste_logs (restaurant_id, logged_at DESC);

ALTER TABLE public.inventory_waste_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waste_restaurant_access" ON public.inventory_waste_logs;
CREATE POLICY "waste_restaurant_access" ON public.inventory_waste_logs
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

-- ── Purchase Orders ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  po_number     TEXT NOT NULL,
  supplier_id   UUID REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','RECEIVED','CANCELLED')),
  total_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ordered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_po_restaurant
  ON public.inventory_purchase_orders (restaurant_id, ordered_at DESC);

ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_restaurant_access" ON public.inventory_purchase_orders;
CREATE POLICY "po_restaurant_access" ON public.inventory_purchase_orders
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

-- ── Updated-at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.inventory_suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.inventory_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_po_updated_at ON public.inventory_purchase_orders;
CREATE TRIGGER trg_po_updated_at
  BEFORE UPDATE ON public.inventory_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
