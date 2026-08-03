-- Online Orders table for Zomato / Swiggy / Dunzo / Uber Eats / Direct delivery management
CREATE TABLE IF NOT EXISTS public.online_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('zomato','swiggy','dunzo','uber_eats','direct','other')),
  platform_order_id TEXT,                     -- order ID from the delivery platform
  customer_name   TEXT,
  customer_phone  TEXT,
  delivery_address TEXT,
  items_summary   TEXT NOT NULL,              -- free-text or JSON summary of items
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_commission NUMERIC(10,2) DEFAULT 0,
  net_amount      NUMERIC(10,2) GENERATED ALWAYS AS (subtotal - platform_commission) STORED,
  status          TEXT NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received','accepted','preparing','out_for_delivery','delivered','cancelled')),
  payment_method  TEXT DEFAULT 'online' CHECK (payment_method IN ('online','cod','wallet')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_online_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_online_orders_updated_at ON public.online_orders;
CREATE TRIGGER trg_online_orders_updated_at
  BEFORE UPDATE ON public.online_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_online_orders_updated_at();

-- RLS
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_admin_online_orders" ON public.online_orders;
CREATE POLICY "restaurant_admin_online_orders" ON public.online_orders
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('restaurant_admin','manager','billing_staff','kitchen_staff','waiter_staff')
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('restaurant_admin','manager')
    )
  );

-- Index for fast per-restaurant queries
CREATE INDEX IF NOT EXISTS idx_online_orders_restaurant_created
  ON public.online_orders (restaurant_id, created_at DESC);
