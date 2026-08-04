-- ── Platform Order Actions ────────────────────────────────────────────────────
-- Logs every accept/reject/status push sent to a delivery platform
CREATE TABLE IF NOT EXISTS public.platform_order_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  online_order_id UUID NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  restaurant_id   UUID NOT NULL,
  platform        TEXT NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('accept','reject','status_update','cancel')),
  payload         JSONB,           -- what was sent to the platform
  response        JSONB,           -- what the platform replied
  success         BOOLEAN NOT NULL DEFAULT FALSE,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Platform Item Availability Overrides ──────────────────────────────────────
-- Per-platform per-item availability (when you 86 an item on Zomato only, etc.)
CREATE TABLE IF NOT EXISTS public.platform_item_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  menu_item_id    UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('zomato','swiggy','dunzo','uber_eats')),
  is_available    BOOLEAN NOT NULL DEFAULT TRUE,
  platform_item_id TEXT,           -- platform's own ID for this item (after first sync)
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, menu_item_id, platform)
);

-- ── Platform Menu Sync Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_menu_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL,
  platform        TEXT NOT NULL,
  items_synced    INTEGER DEFAULT 0,
  success         BOOLEAN NOT NULL DEFAULT FALSE,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Add prep_time and reject_reason to online_orders ─────────────────────────
ALTER TABLE public.online_orders
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS reject_reason     TEXT,
  ADD COLUMN IF NOT EXISTS platform_accepted BOOLEAN,  -- TRUE=accepted, FALSE=rejected, NULL=pending
  ADD COLUMN IF NOT EXISTS kot_printed_at    TIMESTAMPTZ;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.platform_order_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_item_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_menu_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_staff_order_actions" ON public.platform_order_actions;
CREATE POLICY "restaurant_staff_order_actions" ON public.platform_order_actions
  USING (restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "restaurant_staff_item_overrides" ON public.platform_item_overrides;
CREATE POLICY "restaurant_staff_item_overrides" ON public.platform_item_overrides
  USING (restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('restaurant_admin','manager')));

DROP POLICY IF EXISTS "restaurant_staff_sync_log" ON public.platform_menu_sync_log;
CREATE POLICY "restaurant_staff_sync_log" ON public.platform_menu_sync_log
  USING (restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()));

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_platform_order_actions_order ON public.platform_order_actions(online_order_id);
CREATE INDEX IF NOT EXISTS idx_platform_item_overrides_restaurant ON public.platform_item_overrides(restaurant_id, platform);
