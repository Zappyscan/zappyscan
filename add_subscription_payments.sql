-- ─── Subscription Payments ─────────────────────────────────────────────────────
-- Tracks Razorpay subscription details per hotel / tenant.
-- Run this in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id             UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,

  -- Razorpay identifiers
  razorpay_subscription_id  TEXT UNIQUE,
  razorpay_plan_id          TEXT,
  razorpay_payment_id       TEXT,   -- populated after first charge
  payment_link              TEXT,   -- short_url from Razorpay subscription

  -- Plan details
  billing_cycle             TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  tier                      TEXT NOT NULL DEFAULT 'pro',
  amount                    NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Autopay / mandate
  autopay_enabled           BOOLEAN NOT NULL DEFAULT TRUE,
  payment_method            TEXT DEFAULT 'upi'
                              CHECK (payment_method IN ('upi','card','nach','link')),
  upi_id                    TEXT,

  -- Billing contact
  billing_name              TEXT,
  billing_email             TEXT,
  gst_number                TEXT,

  -- Status
  status                    TEXT NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','active','halted','cancelled','expired')),
  next_billing_at           TIMESTAMPTZ,
  activated_at              TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.set_subscription_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_sub_payments_updated_at ON public.subscription_payments;
CREATE TRIGGER trg_sub_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_subscription_updated_at();

-- RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Super-admins have full access; regular admins can only read their own restaurant's row
CREATE POLICY "superadmin_full_access" ON public.subscription_payments
  USING (
    EXISTS (
      SELECT 1 FROM public.super_admin_profile
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.super_admin_profile
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "restaurant_read_own" ON public.subscription_payments
  FOR SELECT
  USING (
    restaurant_id = public.get_user_restaurant_id(auth.uid())
  );

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_sub_payments_restaurant
  ON public.subscription_payments (restaurant_id);
