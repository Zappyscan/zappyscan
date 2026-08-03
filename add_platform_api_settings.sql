-- Platform API settings — stores credentials for Zomato, Swiggy, Uber Eats etc.
-- Each row = one platform connected to one restaurant.

CREATE TABLE IF NOT EXISTS public.platform_api_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  platform            TEXT NOT NULL CHECK (platform IN ('zomato','swiggy','dunzo','uber_eats','direct','other')),

  -- Credentials supplied by the delivery platform's partner portal
  api_key             TEXT,          -- Zomato client_id / Swiggy merchant_id / UberEats client_id
  api_secret          TEXT,          -- Zomato client_secret / Swiggy secret_key / UberEats client_secret
  webhook_secret      TEXT,          -- HMAC signing secret for signature verification
  restaurant_ref      TEXT,          -- Platform's own restaurant/store ID (e.g. Zomato res_id)
  extra_config        JSONB,         -- Platform-specific extra fields (access tokens, scope, etc.)

  -- Status
  is_active           BOOLEAN NOT NULL DEFAULT FALSE,
  last_order_at       TIMESTAMPTZ,
  orders_received     INTEGER NOT NULL DEFAULT 0,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (restaurant_id, platform)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_platform_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON public.platform_api_settings;
CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_api_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_platform_settings_updated_at();

-- RLS: only restaurant admins can read/write their own settings
ALTER TABLE public.platform_api_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_settings_owner" ON public.platform_api_settings;
CREATE POLICY "platform_settings_owner" ON public.platform_api_settings
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('restaurant_admin','manager')
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('restaurant_admin','manager')
    )
  );

-- Service role (used by Edge Functions) bypasses RLS — no extra policy needed.

CREATE INDEX IF NOT EXISTS idx_platform_settings_restaurant
  ON public.platform_api_settings (restaurant_id, platform);
