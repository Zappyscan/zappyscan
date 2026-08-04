import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  restaurant_id: string;
  full_name: string;
  username: string;
  role: string;
  phone: string | null;
  status: string;
  department: string | null;
  email: string | null;
  date_of_joining: string | null;
  bank_account: string | null;
  bank_name: string | null;
  ifsc_code: string | null;
  profile_photo: string | null;
  created_at: string;
}

export interface EmployeeSalary {
  id: string;
  employee_id: string;
  salary_type: "monthly" | "daily" | "hourly";
  basic_salary: number;
  hra: number;
  transport: number;
  other_allowances: number;
  pf_deduction: number;
  esi_deduction: number;
  other_deductions: number;
  effective_from: string;
}

export interface SalaryAdvance {
  id: string;
  restaurant_id: string;
  employee_id: string;
  amount: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "deducted";
  requested_at: string;
  approved_at: string | null;
  deducted_month: string | null;
  employee?: { full_name: string };
}

export interface PayrollRun {
  id: string;
  restaurant_id: string;
  month: string;
  status: "draft" | "processed" | "paid";
  total_gross: number;
  total_deductions: number;
  total_net: number;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Payslip {
  id: string;
  restaurant_id: string;
  employee_id: string;
  month: string;
  days_in_month: number;
  days_worked: number;
  days_absent: number;
  days_leave: number;
  basic_salary: number;
  hra: number;
  transport: number;
  other_allowances: number;
  gross_salary: number;
  pf_deduction: number;
  esi_deduction: number;
  advance_deduction: number;
  other_deductions: number;
  net_salary: number;
  overtime_hours: number;
  overtime_pay: number;
  status: "draft" | "approved" | "paid";
  paid_at: string | null;
  notes: string | null;
  employee?: { full_name: string; role: string; department: string | null };
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  login_time: string;
  logout_time: string | null;
  total_worked_minutes: number;
  total_break_minutes: number;
  overtime_minutes: number;
  employee?: { full_name: string; role: string };
}

// ─── Employees ───────────────────────────────────────────────────────────────

export function useEmployees(restaurantId?: string) {
  return useQuery({
    queryKey: ["employees", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .neq("status", "TERMINATED")
        .order("full_name");
      if (error) throw error;
      return (data || []) as Employee[];
    },
    enabled: !!restaurantId,
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId, updates }: { id: string; restaurantId: string; updates: Partial<Employee> }) => {
      const { error } = await supabase.from("employees").update(updates).eq("id", id);
      if (error) throw error;
      return restaurantId;
    },
    onSuccess: (restaurantId) => qc.invalidateQueries({ queryKey: ["employees", restaurantId] }),
  });
}

// ─── Salary config ───────────────────────────────────────────────────────────

export function useEmployeeSalaries(restaurantId?: string) {
  return useQuery({
    queryKey: ["employee_salary", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_salary")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      // Return a map: employee_id → latest salary config
      const map: Record<string, EmployeeSalary> = {};
      (data || []).forEach((row: EmployeeSalary) => {
        if (!map[row.employee_id]) map[row.employee_id] = row;
      });
      return map;
    },
    enabled: !!restaurantId,
  });
}

export function useUpsertSalary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      restaurantId: string;
      employeeId: string;
      salaryType: string;
      basicSalary: number;
      hra: number;
      transport: number;
      otherAllowances: number;
      pfDeduction: number;
      esiDeduction: number;
      otherDeductions: number;
    }) => {
      const { error } = await supabase.from("employee_salary").upsert({
        restaurant_id: payload.restaurantId,
        employee_id: payload.employeeId,
        salary_type: payload.salaryType,
        basic_salary: payload.basicSalary,
        hra: payload.hra,
        transport: payload.transport,
        other_allowances: payload.otherAllowances,
        pf_deduction: payload.pfDeduction,
        esi_deduction: payload.esiDeduction,
        other_deductions: payload.otherDeductions,
        effective_from: format(new Date(), "yyyy-MM-dd"),
      }, { onConflict: "restaurant_id,employee_id,effective_from" });
      if (error) throw error;
      return payload.restaurantId;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["employee_salary", rid] }),
  });
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export function useAttendance(restaurantId?: string, month?: string) {
  return useQuery({
    queryKey: ["attendance", restaurantId, month],
    queryFn: async () => {
      const startDate = `${month}-01`;
      const [y, m] = month!.split("-").map(Number);
      const endDate = `${month}-${new Date(y, m, 0).getDate()}`;
      const { data, error } = await supabase
        .from("employee_attendance")
        .select("*, employee:employees(full_name, role)")
        .eq("restaurant_id", restaurantId!)
        .gte("login_time", `${startDate}T00:00:00`)
        .lte("login_time", `${endDate}T23:59:59`)
        .order("login_time", { ascending: false });
      if (error) throw error;
      return (data || []) as AttendanceRecord[];
    },
    enabled: !!restaurantId && !!month,
  });
}

// ─── Advances ────────────────────────────────────────────────────────────────

export function useSalaryAdvances(restaurantId?: string) {
  return useQuery({
    queryKey: ["salary_advances", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_advances")
        .select("*, employee:employees(full_name)")
        .eq("restaurant_id", restaurantId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data || []) as SalaryAdvance[];
    },
    enabled: !!restaurantId,
  });
}

export function useCreateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { restaurantId: string; employeeId: string; amount: number; reason: string }) => {
      const { error } = await supabase.from("salary_advances").insert({
        restaurant_id: payload.restaurantId,
        employee_id: payload.employeeId,
        amount: payload.amount,
        reason: payload.reason,
        status: "pending",
      });
      if (error) throw error;
      return payload.restaurantId;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["salary_advances", rid] }),
  });
}

export function useUpdateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId, status }: { id: string; restaurantId: string; status: string }) => {
      const updates: any = { status };
      if (status === "approved") updates.approved_at = new Date().toISOString();
      const { error } = await supabase.from("salary_advances").update(updates).eq("id", id);
      if (error) throw error;
      return restaurantId;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["salary_advances", rid] }),
  });
}

// ─── Payroll runs & payslips ──────────────────────────────────────────────────

export function usePayrollRuns(restaurantId?: string) {
  return useQuery({
    queryKey: ["payroll_runs", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("month", { ascending: false });
      if (error) throw error;
      return (data || []) as PayrollRun[];
    },
    enabled: !!restaurantId,
  });
}

export function usePayslips(restaurantId?: string, month?: string) {
  return useQuery({
    queryKey: ["payslips", restaurantId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("*, employee:employees(full_name, role, department)")
        .eq("restaurant_id", restaurantId!)
        .eq("month", month!)
        .order("created_at");
      if (error) throw error;
      return (data || []) as Payslip[];
    },
    enabled: !!restaurantId && !!month,
  });
}

/** Generate payslips for a month based on salary config + attendance */
export function useRunPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId,
      month,
      employees,
      salaryMap,
      attendanceRecords,
      advanceList,
    }: {
      restaurantId: string;
      month: string;
      employees: Employee[];
      salaryMap: Record<string, EmployeeSalary>;
      attendanceRecords: AttendanceRecord[];
      advanceList: SalaryAdvance[];
    }) => {
      const [y, m] = month.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();

      // Count attendance days per employee
      const attendedDays: Record<string, Set<string>> = {};
      attendanceRecords.forEach((a) => {
        if (!attendedDays[a.employee_id]) attendedDays[a.employee_id] = new Set();
        attendedDays[a.employee_id].add(a.login_time.slice(0, 10));
      });

      // Approved advances for this month
      const advanceDeductions: Record<string, number> = {};
      advanceList
        .filter((a) => a.status === "approved" && !a.deducted_month)
        .forEach((a) => {
          advanceDeductions[a.employee_id] = (advanceDeductions[a.employee_id] || 0) + a.amount;
        });

      // Upsert payroll run
      const { data: runData, error: runError } = await supabase
        .from("payroll_runs")
        .upsert({ restaurant_id: restaurantId, month, status: "draft" }, { onConflict: "restaurant_id,month" })
        .select("id")
        .single();
      if (runError) throw runError;
      const runId = runData.id;

      // Generate payslips
      const payslips = employees
        .filter((e) => salaryMap[e.id])
        .map((emp) => {
          const sal = salaryMap[emp.id];
          const daysWorked = attendedDays[emp.id]?.size || 0;
          const daysAbsent = Math.max(0, daysInMonth - daysWorked);
          const perDay = sal.basic_salary / daysInMonth;
          const earnedBasic = parseFloat((perDay * daysWorked).toFixed(2));
          const earnedHRA = parseFloat(((sal.hra / daysInMonth) * daysWorked).toFixed(2));
          const earnedTransport = parseFloat(((sal.transport / daysInMonth) * daysWorked).toFixed(2));
          const gross = earnedBasic + earnedHRA + earnedTransport + sal.other_allowances;
          const advance = advanceDeductions[emp.id] || 0;
          const totalDeductions = sal.pf_deduction + sal.esi_deduction + sal.other_deductions + advance;
          const net = Math.max(0, gross - totalDeductions);
          return {
            restaurant_id: restaurantId,
            employee_id: emp.id,
            payroll_run_id: runId,
            month,
            days_in_month: daysInMonth,
            days_worked: daysWorked,
            days_absent: daysAbsent,
            days_leave: 0,
            basic_salary: earnedBasic,
            hra: earnedHRA,
            transport: earnedTransport,
            other_allowances: sal.other_allowances,
            gross_salary: parseFloat(gross.toFixed(2)),
            pf_deduction: sal.pf_deduction,
            esi_deduction: sal.esi_deduction,
            advance_deduction: advance,
            other_deductions: sal.other_deductions,
            net_salary: parseFloat(net.toFixed(2)),
            overtime_hours: 0,
            overtime_pay: 0,
            status: "draft" as const,
          };
        });

      if (payslips.length > 0) {
        const { error: psError } = await supabase
          .from("payslips")
          .upsert(payslips, { onConflict: "restaurant_id,employee_id,month" });
        if (psError) throw psError;
      }

      // Update payroll run totals
      const totals = payslips.reduce(
        (acc, p) => ({ gross: acc.gross + p.gross_salary, deductions: acc.deductions + p.pf_deduction + p.esi_deduction + p.advance_deduction + p.other_deductions, net: acc.net + p.net_salary }),
        { gross: 0, deductions: 0, net: 0 }
      );
      await supabase.from("payroll_runs").update({
        total_gross: parseFloat(totals.gross.toFixed(2)),
        total_deductions: parseFloat(totals.deductions.toFixed(2)),
        total_net: parseFloat(totals.net.toFixed(2)),
        status: "processed",
      }).eq("id", runId);

      // Mark advances as deducted
      const advanceIds = advanceList
        .filter((a) => a.status === "approved" && !a.deducted_month && advanceDeductions[a.employee_id])
        .map((a) => a.id);
      if (advanceIds.length > 0) {
        await supabase.from("salary_advances")
          .update({ status: "deducted", deducted_month: month })
          .in("id", advanceIds);
      }

      return restaurantId;
    },
    onSuccess: (rid) => {
      qc.invalidateQueries({ queryKey: ["payroll_runs", rid] });
      qc.invalidateQueries({ queryKey: ["payslips", rid] });
      qc.invalidateQueries({ queryKey: ["salary_advances", rid] });
    },
  });
}

export function useMarkPayrollPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, restaurantId, month }: { runId: string; restaurantId: string; month: string }) => {
      const now = new Date().toISOString();
      await supabase.from("payroll_runs").update({ status: "paid", paid_at: now }).eq("id", runId);
      await supabase.from("payslips").update({ status: "paid", paid_at: now }).eq("payroll_run_id", runId);
      return { restaurantId, month };
    },
    onSuccess: ({ restaurantId, month }) => {
      qc.invalidateQueries({ queryKey: ["payroll_runs", restaurantId] });
      qc.invalidateQueries({ queryKey: ["payslips", restaurantId, month] });
    },
  });
}
