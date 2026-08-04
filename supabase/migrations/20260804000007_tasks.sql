-- ─────────────────────────────────────────────────────────────────────────────
-- Zappy Tasks Module
-- ─────────────────────────────────────────────────────────────────────────────

-- Task templates: reusable task definitions
CREATE TABLE IF NOT EXISTS task_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'general',
  -- recurring config
  recurrence      TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
  recurrence_days INTEGER[] DEFAULT NULL,  -- 0=Sun..6=Sat for weekly
  due_time        TIME DEFAULT NULL,       -- time of day task is due
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  assigned_role   TEXT DEFAULT NULL,       -- 'waiter','kitchen','manager',etc.
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_templates_rls" ON task_templates
  USING (restaurant_id = get_user_restaurant_id(auth.uid()));

-- Task assignments: a specific instance of a task on a specific date
CREATE TABLE IF NOT EXISTS task_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  template_id     UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL DEFAULT 'general',
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  assigned_to     UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_role   TEXT DEFAULT NULL,
  due_date        DATE NOT NULL,
  due_time        TIME DEFAULT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped','overdue')),
  notes           TEXT DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_assignments_rls" ON task_assignments
  USING (restaurant_id = get_user_restaurant_id(auth.uid()));

-- Task completions: audit log of who completed what and when
CREATE TABLE IF NOT EXISTS task_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  assignment_id   UUID NOT NULL REFERENCES task_assignments(id) ON DELETE CASCADE,
  completed_by    UUID REFERENCES employees(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time_taken_mins INTEGER DEFAULT NULL,
  notes           TEXT DEFAULT NULL,
  photo_url       TEXT DEFAULT NULL
);

ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_completions_rls" ON task_completions
  USING (restaurant_id = get_user_restaurant_id(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER set_updated_at_task_templates
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_task_assignments
  BEFORE UPDATE ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_task_assignments_restaurant_date
  ON task_assignments(restaurant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignments_status
  ON task_assignments(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_task_templates_restaurant
  ON task_templates(restaurant_id, is_active);
