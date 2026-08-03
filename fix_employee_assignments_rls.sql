-- Fix: employee_assignments RLS blocking INSERT (Assign Table)
-- The existing policy has USING but no WITH CHECK, so inserts are always rejected.

-- Drop the broken policy
DROP POLICY IF EXISTS "Enable all for users based on restaurant_id" ON public.employee_assignments;

-- Recreate with both USING (for SELECT/UPDATE/DELETE) and WITH CHECK (for INSERT)
CREATE POLICY "Enable all for users based on restaurant_id"
  ON public.employee_assignments
  FOR ALL
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
    )
  );
