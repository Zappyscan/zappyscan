import { useState, useEffect } from "react";
import { format, addDays, subDays } from "date-fns";
import { motion } from "framer-motion";
import {
  CheckSquare, Plus, ChevronLeft, ChevronRight, RefreshCw,
  Clock, AlertCircle, CheckCircle2, SkipForward, PlayCircle,
  Trash2, Edit2, Star, Repeat, Calendar, Users, Tag,
  ClipboardList, LayoutTemplate, History, BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useTaskTemplates, useCreateTemplate, useUpdateTemplate, useDeleteTemplate,
  useTaskAssignments, useCreateAssignment, useUpdateAssignmentStatus, useDeleteAssignment,
  useGenerateDailyTasks, useTaskStats,
  type TaskTemplate, type TaskAssignment,
} from "@/hooks/useTask";
import { useEmployees } from "@/hooks/usePayroll";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ["general", "opening", "closing", "cleaning", "kitchen", "service", "stock", "maintenance", "safety"];
const PRIORITIES = ["low", "medium", "high"] as const;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PRIORITY_CONFIG = {
  low:    { label: "Low",    color: "bg-blue-100 text-blue-700 border-blue-200" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  high:   { label: "High",   color: "bg-red-100 text-red-700 border-red-200" },
};

const STATUS_CONFIG = {
  pending:     { label: "Pending",     icon: Clock,         color: "text-muted-foreground", bg: "bg-muted/40" },
  in_progress: { label: "In Progress", icon: PlayCircle,    color: "text-blue-600",         bg: "bg-blue-50" },
  completed:   { label: "Done",        icon: CheckCircle2,  color: "text-green-600",         bg: "bg-green-50" },
  skipped:     { label: "Skipped",     icon: SkipForward,   color: "text-muted-foreground", bg: "bg-muted/20" },
  overdue:     { label: "Overdue",     icon: AlertCircle,   color: "text-red-600",           bg: "bg-red-50" },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  restaurantId: string;
}

// ─── Blank forms ──────────────────────────────────────────────────────────────

const blankTemplate = (): Omit<TaskTemplate, "id" | "created_at"> => ({
  restaurant_id: "",
  title: "",
  description: null,
  category: "general",
  recurrence: "daily",
  recurrence_days: [1, 2, 3, 4, 5],
  due_time: null,
  priority: "medium",
  assigned_role: null,
  is_active: true,
});

// ─── Main component ───────────────────────────────────────────────────────────

export function TaskManagement({ restaurantId }: Props) {
  const [tab, setTab] = useState<"today" | "templates" | "history" | "stats">("today");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Queries
  const { data: templates = [] } = useTaskTemplates(restaurantId);
  const { data: todayTasks = [], isLoading: loadingTasks } = useTaskAssignments(restaurantId, selectedDate);
  const { data: allTasks = [] } = useTaskAssignments(restaurantId);
  const { data: stats } = useTaskStats(restaurantId, selectedDate);
  const { data: employees = [] } = useEmployees(restaurantId);

  // Mutations
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const createAssignment = useCreateAssignment();
  const updateStatus = useUpdateAssignmentStatus();
  const deleteAssignment = useDeleteAssignment();
  const generateDaily = useGenerateDailyTasks();

  // Dialog state
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState(blankTemplate());

  const [taskDialog, setTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", category: "general", priority: "medium" as const,
    assigned_to: "", due_date: selectedDate, due_time: "",
  });

  // Auto-generate on mount for today
  useEffect(() => {
    if (templates.length > 0 && selectedDate === format(new Date(), "yyyy-MM-dd")) {
      generateDaily.mutate({ restaurantId, templates });
    }
  }, [templates.length, restaurantId]);

  // ── Template dialog helpers ──
  const openNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({ ...blankTemplate(), restaurant_id: restaurantId });
    setTemplateDialog(true);
  };
  const openEditTemplate = (t: TaskTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({ ...t });
    setTemplateDialog(true);
  };
  const saveTemplate = async () => {
    if (!templateForm.title.trim()) { toast.error("Title required"); return; }
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, restaurantId, updates: templateForm });
        toast.success("Template updated");
      } else {
        await createTemplate.mutateAsync({ ...templateForm, restaurant_id: restaurantId });
        toast.success("Template created");
      }
      setTemplateDialog(false);
    } catch { toast.error("Failed to save template"); }
  };

  // ── Task dialog helpers ──
  const saveTask = async () => {
    if (!taskForm.title.trim()) { toast.error("Title required"); return; }
    try {
      await createAssignment.mutateAsync({
        restaurant_id: restaurantId,
        template_id: null,
        title: taskForm.title,
        description: taskForm.description || null,
        category: taskForm.category,
        priority: taskForm.priority,
        assigned_to: taskForm.assigned_to || null,
        assigned_role: null,
        due_date: taskForm.due_date || selectedDate,
        due_time: taskForm.due_time || null,
        status: "pending",
        notes: null,
      });
      toast.success("Task created");
      setTaskDialog(false);
      setTaskForm({ title: "", description: "", category: "general", priority: "medium", assigned_to: "", due_date: selectedDate, due_time: "" });
    } catch { toast.error("Failed to create task"); }
  };

  const handleStatusChange = async (task: TaskAssignment, status: TaskAssignment["status"]) => {
    try {
      await updateStatus.mutateAsync({ id: task.id, restaurantId, date: task.due_date, status });
    } catch { toast.error("Failed to update status"); }
  };

  const completionPct = stats && stats.total > 0
    ? Math.round((stats.completed / stats.total) * 100)
    : 0;

  const tabs = [
    { id: "today" as const,     label: "Today",     icon: ClipboardList },
    { id: "templates" as const, label: "Templates", icon: LayoutTemplate },
    { id: "history" as const,   label: "History",   icon: History },
    { id: "stats" as const,     label: "Stats",     icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-primary" /> Tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Checklists, assignments & recurring schedules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setTemplateDialog(true); openNewTemplate(); }}>
            <Plus className="w-4 h-4 mr-1" /> Template
          </Button>
          <Button size="sm" onClick={() => { setTaskForm(f => ({ ...f, due_date: selectedDate })); setTaskDialog(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Task
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",       value: stats?.total ?? 0,      color: "text-foreground" },
          { label: "Completed",   value: stats?.completed ?? 0,  color: "text-green-600" },
          { label: "In Progress", value: stats?.inProgress ?? 0, color: "text-blue-600" },
          { label: "Overdue",     value: stats?.overdue ?? 0,    color: "text-red-600" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress bar for today */}
      {stats && stats.total > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Today's completion</span>
            <span className="font-medium">{completionPct}%</span>
          </div>
          <Progress value={completionPct} className="h-2" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              tab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TODAY TAB ── */}
      {tab === "today" && (
        <div className="space-y-4">
          {/* Date navigator */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => format(subDays(new Date(d), 1), "yyyy-MM-dd"))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-center">
              <p className="font-semibold">{format(new Date(selectedDate + "T00:00:00"), "EEEE, d MMM yyyy")}</p>
              {selectedDate === format(new Date(), "yyyy-MM-dd") && (
                <p className="text-xs text-primary font-medium">Today</p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => format(addDays(new Date(d), 1), "yyyy-MM-dd"))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline" size="sm" className="ml-auto"
              onClick={() => generateDaily.mutate({ restaurantId, templates })}
              disabled={generateDaily.isPending}
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", generateDaily.isPending && "animate-spin")} />
              Generate
            </Button>
          </div>

          {loadingTasks ? (
            <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
          ) : todayTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No tasks for this day</p>
              <p className="text-sm">Add a task or click Generate to create from templates</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onDelete={() => deleteAssignment.mutate({ id: task.id, restaurantId, date: task.due_date })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEMPLATES TAB ── */}
      {tab === "templates" && (
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LayoutTemplate className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No templates yet</p>
              <p className="text-sm">Create recurring task templates for daily checklists</p>
            </div>
          ) : (
            templates.map((t) => (
              <Card key={t.id} className={cn("border-0 shadow-sm", !t.is_active && "opacity-50")}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{t.title}</span>
                      <Badge variant="outline" className={PRIORITY_CONFIG[t.priority].color}>
                        {PRIORITY_CONFIG[t.priority].label}
                      </Badge>
                      <Badge variant="outline" className="capitalize">{t.category}</Badge>
                      {t.recurrence !== "none" && (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                          <Repeat className="w-3 h-3 mr-1" />
                          {t.recurrence === "weekly" && t.recurrence_days
                            ? t.recurrence_days.map(d => DAYS[d]).join(", ")
                            : t.recurrence}
                        </Badge>
                      )}
                      {!t.is_active && <Badge variant="outline" className="bg-muted">Inactive</Badge>}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {t.due_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t.due_time.slice(0, 5)}</span>}
                      {t.assigned_role && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{t.assigned_role}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTemplate(t)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteTemplate.mutate({ id: t.id, restaurantId })}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          <Button variant="outline" className="w-full" onClick={openNewTemplate}>
            <Plus className="w-4 h-4 mr-1" /> New Template
          </Button>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div className="space-y-2">
          {allTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No task history yet</div>
          ) : (
            allTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 text-sm">
                <StatusIcon status={task.status} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.due_date} · {task.category}</p>
                </div>
                <Badge variant="outline" className={PRIORITY_CONFIG[task.priority].color}>
                  {PRIORITY_CONFIG[task.priority].label}
                </Badge>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── STATS TAB ── */}
      {tab === "stats" && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By Category (Today)</CardTitle>
            </CardHeader>
            <CardContent>
              {CATEGORIES.map((cat) => {
                const catTasks = todayTasks.filter(t => t.category === cat);
                if (catTasks.length === 0) return null;
                const done = catTasks.filter(t => t.status === "completed").length;
                return (
                  <div key={cat} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium">{cat}</span>
                      <span className="text-muted-foreground">{done}/{catTasks.length}</span>
                    </div>
                    <Progress value={catTasks.length > 0 ? (done / catTasks.length) * 100 : 0} className="h-1.5" />
                  </div>
                );
              })}
              {todayTasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks today</p>}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Templates Active</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{templates.filter(t => t.is_active).length}</p>
              <p className="text-sm text-muted-foreground">{templates.length} total templates</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Template Dialog ── */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={templateForm.title} onChange={e => setTemplateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Clean kitchen surfaces" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={templateForm.description || ""} onChange={e => setTemplateForm(f => ({ ...f, description: e.target.value || null }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={templateForm.category} onValueChange={v => setTemplateForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={templateForm.priority} onValueChange={(v: any) => setTemplateForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recurrence</Label>
                <Select value={templateForm.recurrence} onValueChange={(v: any) => setTemplateForm(f => ({ ...f, recurrence: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">One-time</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly (1st)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Time</Label>
                <Input type="time" value={templateForm.due_time || ""} onChange={e => setTemplateForm(f => ({ ...f, due_time: e.target.value || null }))} />
              </div>
            </div>
            {templateForm.recurrence === "weekly" && (
              <div className="space-y-1.5">
                <Label>Days of Week</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((day, i) => (
                    <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        checked={templateForm.recurrence_days?.includes(i) ?? false}
                        onCheckedChange={(checked) => {
                          const days = templateForm.recurrence_days || [];
                          setTemplateForm(f => ({
                            ...f,
                            recurrence_days: checked ? [...days, i].sort() : days.filter(d => d !== i),
                          }));
                        }}
                      />
                      <span className="text-sm">{day}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Assigned Role</Label>
              <Input value={templateForm.assigned_role || ""} onChange={e => setTemplateForm(f => ({ ...f, assigned_role: e.target.value || null }))} placeholder="e.g. kitchen, waiter, manager" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={templateForm.is_active} onCheckedChange={(v) => setTemplateForm(f => ({ ...f, is_active: !!v }))} />
              <span className="text-sm font-medium">Active (generate automatically)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={createTemplate.isPending || updateTemplate.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Task Dialog ── */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={taskForm.category} onValueChange={v => setTaskForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={(v: any) => setTaskForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Time</Label>
                <Input type="time" value={taskForm.due_time} onChange={e => setTaskForm(f => ({ ...f, due_time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={taskForm.assigned_to} onValueChange={v => setTaskForm(f => ({ ...f, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialog(false)}>Cancel</Button>
            <Button onClick={saveTask} disabled={createAssignment.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: TaskAssignment;
  onStatusChange: (task: TaskAssignment, status: TaskAssignment["status"]) => void;
  onDelete: () => void;
}) {
  const cfg = STATUS_CONFIG[task.status];
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-start gap-3 p-3 rounded-xl border border-border/50 transition-colors", cfg.bg)}
    >
      {/* Status toggle */}
      <button
        onClick={() => onStatusChange(task, task.status === "completed" ? "pending" : "completed")}
        className="mt-0.5 shrink-0"
      >
        <Icon className={cn("w-5 h-5", cfg.color)} />
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("font-medium text-sm", task.status === "completed" && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <Badge variant="outline" className={cn("text-xs", PRIORITY_CONFIG[task.priority].color)}>
            {PRIORITY_CONFIG[task.priority].label}
          </Badge>
          <span className="text-xs text-muted-foreground capitalize">{task.category}</span>
          {task.due_time && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-3 h-3" />{task.due_time.slice(0, 5)}
            </span>
          )}
          {task.employee && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <Users className="w-3 h-3" />{task.employee.name}
            </span>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-1 shrink-0">
        {task.status !== "in_progress" && task.status !== "completed" && (
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700"
            onClick={() => onStatusChange(task, "in_progress")}
            title="Mark in progress"
          >
            <PlayCircle className="w-3.5 h-3.5" />
          </Button>
        )}
        {task.status !== "skipped" && task.status !== "completed" && (
          <Button
            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"
            onClick={() => onStatusChange(task, "skipped")}
            title="Skip"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button
          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Status Icon ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: TaskAssignment["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return <Icon className={cn("w-4 h-4 shrink-0", cfg.color)} />;
}
