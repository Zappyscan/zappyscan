-- ============================================================
-- ZAPPY PAYROLL MODULE
-- Extends existing employees / employee_attendance tables
-- ============================================================

-- 1. Extra columns on employees (all optional, non-breaking)
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS date_of_joining  DATE,
  ADD COLUMN IF NOT EXISTS department       TEXT,
  ADD COLUMN IF NOT EXISTS email            TEXT,
  ADD COLUMN IF NOT EXISTS address          TEXT,
  ADD COLUMN IF NOT EXISTS bank_account     TEXT,
  ADD COLUMN IF NOT EXISTS bank_name        TEXT,
  ADD COLUMN IF NOT EXISTS ifsc_code        TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo    TEXT;

-- 2. Salary configuration per employee
CREATE TABLE IF NOT EXISTS public.employee_salary (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  employee_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_type    TEXT NOT NULL DEFAULT 'monthly'
                   CHECK (salary_type IN ('monthly','daily','hourly')),
  basic_salary   NUMERIC NOT NULL DEFAULT 0,
  hra            NUMERIC NOT NULL DEFAULT 0,   -- House Rent Allowance
  transport      NUMERIC NOT NULL DEFAULT 0,   -- Transport allowance
  other_allowances NUMERIC NOT NULL DEFAULT 0,
  pf_deduction   NUMERIC NOT NULL DEFAULT 0,   -- Provident Fund
  esi_deduction  NUMERIC NOT NULL DEFAULT 0,   -- ESI
  other_deductions NUMERIC NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, employee_id, effective_from)
);

-- 3. Salary advances
CREATE TABLE IF NOT EXISTS public.salary_advances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  employee_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','deducted')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at    TIMESTAMPTZ,
  deducted_month TEXT,   -- '2026-08'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Monthly payroll runs
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  month            TEXT NOT NULL,   -- '2026-08'
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','processed','paid')),
  total_gross      NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  total_net        NUMERIC NOT NULL DEFAULT 0,
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, month)
);

-- 5. Individual payslips
CREATE TABLE IF NOT EXISTS public.payslips (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id      UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  employee_id        UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  payroll_run_id     UUID REFERENCES public.payroll_runs(id) ON DELETE SET NULL,
  month              TEXT NOT NULL,   -- '2026-08'
  days_in_month      INTEGER NOT NULL DEFAULT 30,
  days_worked        INTEGER NOT NULL DEFAULT 0,
  days_absent        INTEGER NOT NULL DEFAULT 0,
  days_leave         INTEGER NOT NULL DEFAULT 0,
  basic_salary       NUMERIC NOT NULL DEFAULT 0,
  hra                NUMERIC NOT NULL DEFAULT 0,
  transport          NUMERIC NOT NULL DEFAULT 0,
  other_allowances   NUMERIC NOT NULL DEFAULT 0,
  gross_salary       NUMERIC NOT NULL DEFAULT 0,
  pf_deduction       NUMERIC NOT NULL DEFAULT 0,
  esi_deduction      NUMERIC NOT NULL DEFAULT 0,
  advance_deduction  NUMERIC NOT NULL DEFAULT 0,
  other_deductions   NUMERIC NOT NULL DEFAULT 0,
  net_salary         NUMERIC NOT NULL DEFAULT 0,
  overtime_hours     NUMERIC NOT NULL DEFAULT 0,
  overtime_pay       NUMERIC NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','approved','paid')),
  paid_at            TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, employee_id, month)
);

-- ── Enable RLS ───────────────────────────────────────────────
ALTER TABLE public.employee_salary  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_advances  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips         ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────
CREATE POLICY "payroll_restaurant_access" ON public.employee_salary
  FOR ALL USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "advances_restaurant_access" ON public.salary_advances
  FOR ALL USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "payroll_runs_restaurant_access" ON public.payroll_runs
  FOR ALL USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "payslips_restaurant_access" ON public.payslips
  FOR ALL USING (restaurant_id = get_user_restaurant_id(auth.uid()));

-- ── updated_at triggers ───────────────────────────────────────
CREATE TRIGGER set_updated_at_employee_salary
  BEFORE UPDATE ON public.employee_salary
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_salary_advances
  BEFORE UPDATE ON public.salary_advances
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_payroll_runs
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_payslips
  BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
