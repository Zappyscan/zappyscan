-- Add email column to employees so WaiterLogin can resolve username → Supabase auth email
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill existing rows: reconstruct the faux email from username + restaurant slug
-- Pattern: {sanitized_username}@{slug}.zappy.local
UPDATE public.employees e
SET email = lower(regexp_replace(e.username, '[^a-z0-9]', '', 'g'))
            || '@'
            || coalesce(
                 (SELECT slug FROM public.restaurants r WHERE r.id = e.restaurant_id LIMIT 1),
                 left(e.restaurant_id::text, 8)
               )
            || '.zappy.local'
WHERE e.email IS NULL;

-- Allow unauthenticated clients to resolve username → email for login purposes.
-- The "email" here is a system-generated faux address, not a real email — safe to expose.
CREATE POLICY "employees_username_lookup"
  ON public.employees
  FOR SELECT
  TO anon
  USING (true);
