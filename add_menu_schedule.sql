-- ─────────────────────────────────────────────────────────────────────────────
-- Menu Time-Based Availability Schedule
-- Run this once in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Add scheduling columns to categories
-- available_from / available_until are local TIME values (no timezone)
-- NULL on both = always available (default behaviour, no change)
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS available_from TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS available_until TIME WITHOUT TIME ZONE;

-- Optional: seed some sensible defaults for existing data (all left NULL = always on)
-- If you want to see it work immediately, uncomment and adjust:
-- UPDATE public.categories SET available_from = '07:00', available_until = '11:30'
--   WHERE name ILIKE '%breakfast%';
-- UPDATE public.categories SET available_from = '12:00', available_until = '15:30'
--   WHERE name ILIKE '%lunch%';
-- UPDATE public.categories SET available_from = '19:00', available_until = '23:00'
--   WHERE name ILIKE '%dinner%';

-- Confirm
SELECT id, name, available_from, available_until
FROM public.categories
ORDER BY display_order;
