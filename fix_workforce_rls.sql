-- ============================================================
-- Fix: All workforce tables missing WITH CHECK on INSERT policies
-- Affects: employee_shifts, employee_attendance, employee_breaks
-- (employee_assignments was fixed separately in fix_employee_assignments_rls.sql)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── employee_shifts ────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all for users based on restaurant_id" ON public.employee_shifts;
CREATE POLICY "Enable all for users based on restaurant_id"
  ON public.employee_shifts FOR ALL
  USING (
    restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid())
  );

-- ── employee_attendance ────────────────────────────────────
DROP POLICY IF EXISTS "Enable all for users based on restaurant_id" ON public.employee_attendance;
CREATE POLICY "Enable all for users based on restaurant_id"
  ON public.employee_attendance FOR ALL
  USING (
    restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid())
  );

-- ── employee_breaks ────────────────────────────────────────
DROP POLICY IF EXISTS "Enable all for users based on attendance" ON public.employee_breaks;
CREATE POLICY "Enable all for users based on attendance"
  ON public.employee_breaks FOR ALL
  USING (
    attendance_id IN (
      SELECT id FROM public.employee_attendance
      WHERE restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    attendance_id IN (
      SELECT id FROM public.employee_attendance
      WHERE restaurant_id IN (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid())
    )
  );

-- ── employees table (backup fix, in case 20260706000001 wasn't applied) ──
DROP POLICY IF EXISTS "Enable all for users based on restaurant_id" ON public.employees;
-- Note: If tenant_write_employees already exists from 20260706000001, this is a no-op
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'employees' AND policyname = 'tenant_write_employees'
  ) THEN
    CREATE POLICY "tenant_write_employees"
      ON public.employees FOR ALL
      TO authenticated
      USING (
        restaurant_id = (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid() AND role != 'super_admin' LIMIT 1)
      )
      WITH CHECK (
        restaurant_id = (SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid() AND role != 'super_admin' LIMIT 1)
      );
  END IF;
END $$;

RAISE NOTICE 'All workforce RLS policies fixed with WITH CHECK!';
