-- ============================================================
-- Fix 1: Remove the over-permissive anon read policy added
--        in 20260706000000. Replace with a security-definer
--        RPC so WaiterLogin can resolve username → email
--        without exposing the whole employees table.
-- ============================================================
DROP POLICY IF EXISTS "employees_username_lookup" ON public.employees;

-- Security-definer function: returns the faux email for a given
-- username. Only exposes email — no other columns — to callers.
CREATE OR REPLACE FUNCTION public.resolve_staff_email(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT email
    FROM public.employees
    WHERE lower(username) = lower(p_username)
    LIMIT 1
  );
END;
$$;

-- Allow any caller (including anon) to execute this function
GRANT EXECUTE ON FUNCTION public.resolve_staff_email(TEXT) TO anon, authenticated;

-- ============================================================
-- Fix 2: Super admin bypass — let super_admins read all
--        employees (needed for the User Management panel).
-- ============================================================
DROP POLICY IF EXISTS "super_admin_read_all_employees" ON public.employees;
CREATE POLICY "super_admin_read_all_employees"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

-- ============================================================
-- Fix 3: Tighten the existing tenant-isolation read policy.
--        The previous one allowed users with MULTIPLE restaurant
--        IDs in user_roles to see employees from all of them.
--        Re-create it scoped to a single restaurant.
-- ============================================================
DROP POLICY IF EXISTS "Enable read for users based on restaurant_id" ON public.employees;
CREATE POLICY "tenant_read_employees"
  ON public.employees
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id = (
      SELECT restaurant_id
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role != 'super_admin'
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "Enable all for users based on restaurant_id" ON public.employees;
CREATE POLICY "tenant_write_employees"
  ON public.employees
  FOR ALL
  TO authenticated
  USING (
    restaurant_id = (
      SELECT restaurant_id
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role != 'super_admin'
      LIMIT 1
    )
  )
  WITH CHECK (
    restaurant_id = (
      SELECT restaurant_id
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role != 'super_admin'
      LIMIT 1
    )
  );
