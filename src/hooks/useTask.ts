import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, startOfDay } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TaskTemplate {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  category: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  recurrence_days: number[] | null;
  due_time: string | null;
  priority: "low" | "medium" | "high";
  assigned_role: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TaskAssignment {
  id: string;
  restaurant_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  category: string;
  priority: "low" | "medium" | "high";
  assigned_to: string | null;
  assigned_role: string | null;
  due_date: string;
  due_time: string | null;
  status: "pending" | "in_progress" | "completed" | "skipped" | "overdue";
  notes: string | null;
  created_at: string;
  employee?: { id: string; name: string } | null;
}

export interface TaskCompletion {
  id: string;
  assignment_id: string;
  completed_by: string | null;
  completed_at: string;
  time_taken_mins: number | null;
  notes: string | null;
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function useTaskTemplates(restaurantId?: string) {
  return useQuery({
    queryKey: ["task_templates", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_templates")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("category")
        .order("title");
      if (error) throw error;
      return (data || []) as TaskTemplate[];
    },
    enabled: !!restaurantId,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<TaskTemplate, "id" | "created_at">) => {
      const { error } = await supabase.from("task_templates").insert(payload);
      if (error) throw error;
      return payload.restaurant_id;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["task_templates", rid] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId, updates }: { id: string; restaurantId: string; updates: Partial<TaskTemplate> }) => {
      const { error } = await supabase.from("task_templates").update(updates).eq("id", id);
      if (error) throw error;
      return restaurantId;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["task_templates", rid] }),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      const { error } = await supabase.from("task_templates").delete().eq("id", id);
      if (error) throw error;
      return restaurantId;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["task_templates", rid] }),
  });
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export function useTaskAssignments(restaurantId?: string, date?: string) {
  return useQuery({
    queryKey: ["task_assignments", restaurantId, date],
    queryFn: async () => {
      let q = supabase
        .from("task_assignments")
        .select("*, employee:employees(id,name)")
        .eq("restaurant_id", restaurantId!);
      if (date) q = q.eq("due_date", date);
      else q = q.order("due_date", { ascending: false }).limit(200);
      const { data, error } = await q.order("due_time", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data || []) as TaskAssignment[];
    },
    enabled: !!restaurantId,
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<TaskAssignment, "id" | "created_at" | "employee">) => {
      const { error } = await supabase.from("task_assignments").insert(payload);
      if (error) throw error;
      return { restaurantId: payload.restaurant_id, date: payload.due_date };
    },
    onSuccess: ({ restaurantId, date }) => {
      qc.invalidateQueries({ queryKey: ["task_assignments", restaurantId, date] });
      qc.invalidateQueries({ queryKey: ["task_assignments", restaurantId] });
    },
  });
}

export function useUpdateAssignmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, restaurantId, date, status, notes,
    }: { id: string; restaurantId: string; date: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("task_assignments")
        .update({ status, notes: notes || null })
        .eq("id", id);
      if (error) throw error;
      return { restaurantId, date };
    },
    onSuccess: ({ restaurantId, date }) => {
      qc.invalidateQueries({ queryKey: ["task_assignments", restaurantId, date] });
      qc.invalidateQueries({ queryKey: ["task_assignments", restaurantId] });
    },
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId, date }: { id: string; restaurantId: string; date: string }) => {
      const { error } = await supabase.from("task_assignments").delete().eq("id", id);
      if (error) throw error;
      return { restaurantId, date };
    },
    onSuccess: ({ restaurantId, date }) => {
      qc.invalidateQueries({ queryKey: ["task_assignments", restaurantId, date] });
      qc.invalidateQueries({ queryKey: ["task_assignments", restaurantId] });
    },
  });
}

// ─── Generate today's tasks from active recurring templates ───────────────────

export function useGenerateDailyTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ restaurantId, templates }: { restaurantId: string; templates: TaskTemplate[] }) => {
      const today = format(new Date(), "yyyy-MM-dd");
      const dayOfWeek = new Date().getDay(); // 0=Sun..6=Sat

      // Check which templates should fire today
      const toCreate = templates.filter((t) => {
        if (!t.is_active) return false;
        if (t.recurrence === "none") return false;
        if (t.recurrence === "daily") return true;
        if (t.recurrence === "weekly") {
          return t.recurrence_days?.includes(dayOfWeek) ?? false;
        }
        if (t.recurrence === "monthly") {
          return new Date().getDate() === 1; // first of month
        }
        return false;
      });

      if (toCreate.length === 0) return { restaurantId, date: today };

      // Check which ones already exist for today (avoid duplicates)
      const { data: existing } = await supabase
        .from("task_assignments")
        .select("template_id")
        .eq("restaurant_id", restaurantId)
        .eq("due_date", today)
        .not("template_id", "is", null);

      const existingTemplateIds = new Set((existing || []).map((e) => e.template_id));
      const newTasks = toCreate
        .filter((t) => !existingTemplateIds.has(t.id))
        .map((t) => ({
          restaurant_id: restaurantId,
          template_id: t.id,
          title: t.title,
          description: t.description,
          category: t.category,
          priority: t.priority,
          assigned_role: t.assigned_role,
          assigned_to: null,
          due_date: today,
          due_time: t.due_time,
          status: "pending" as const,
          notes: null,
        }));

      if (newTasks.length > 0) {
        const { error } = await supabase.from("task_assignments").insert(newTasks);
        if (error) throw error;
      }

      return { restaurantId, date: today };
    },
    onSuccess: ({ restaurantId, date }) => {
      qc.invalidateQueries({ queryKey: ["task_assignments", restaurantId, date] });
    },
  });
}

// ─── Task stats ───────────────────────────────────────────────────────────────

export function useTaskStats(restaurantId?: string, date?: string) {
  return useQuery({
    queryKey: ["task_stats", restaurantId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_assignments")
        .select("status")
        .eq("restaurant_id", restaurantId!)
        .eq("due_date", date || format(new Date(), "yyyy-MM-dd"));
      if (error) throw error;
      const tasks = data || [];
      return {
        total: tasks.length,
        completed: tasks.filter((t) => t.status === "completed").length,
        pending: tasks.filter((t) => t.status === "pending").length,
        inProgress: tasks.filter((t) => t.status === "in_progress").length,
        overdue: tasks.filter((t) => t.status === "overdue").length,
        skipped: tasks.filter((t) => t.status === "skipped").length,
      };
    },
    enabled: !!restaurantId,
  });
}
