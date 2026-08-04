-- ─── Customer Loyalty Points ─────────────────────────────────────────────────
-- Persistent per-customer point balances, keyed by restaurant + phone number.
-- Replaces the previous localStorage-based loyalty store.

CREATE TABLE IF NOT EXISTS public.customer_loyalty_points (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  phone         TEXT NOT NULL,
  points        INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_restaurant
  ON public.customer_loyalty_points (restaurant_id);

ALTER TABLE public.customer_loyalty_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_restaurant_access" ON public.customer_loyalty_points;
CREATE POLICY "loyalty_restaurant_access" ON public.customer_loyalty_points
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));

-- Reuse set_updated_at() created in the inventory migration
DROP TRIGGER IF EXISTS trg_loyalty_updated_at ON public.customer_loyalty_points;
CREATE TRIGGER trg_loyalty_updated_at
  BEFORE UPDATE ON public.customer_loyalty_points
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
