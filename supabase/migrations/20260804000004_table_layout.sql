-- ─── Table Layout Persistence ────────────────────────────────────────────────
-- Adds section assignment, reservation details, and merge groups to the DB,
-- replacing the previous localStorage-based storage.

-- ── Extend tables with section and reservation fields ─────────────────────────

ALTER TABLE public.tables
  ADD COLUMN IF NOT EXISTS section          TEXT NOT NULL DEFAULT 'Main Hall',
  ADD COLUMN IF NOT EXISTS reservation_time TEXT,
  ADD COLUMN IF NOT EXISTS reservation_name TEXT;

-- ── Table Merges ──────────────────────────────────────────────────────────────
-- Stores groups of tables merged together for larger parties.

CREATE TABLE IF NOT EXISTS public.table_merges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_ids     JSONB NOT NULL DEFAULT '[]'::jsonb,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_merges_restaurant
  ON public.table_merges (restaurant_id);

ALTER TABLE public.table_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "table_merges_restaurant_access" ON public.table_merges;
CREATE POLICY "table_merges_restaurant_access" ON public.table_merges
  USING (restaurant_id = public.get_user_restaurant_id(auth.uid()))
  WITH CHECK (restaurant_id = public.get_user_restaurant_id(auth.uid()));
