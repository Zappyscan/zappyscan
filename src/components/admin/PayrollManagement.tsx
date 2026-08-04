import { useState } from "react";
import { format, subMonths } from "date-fns";
import { motion } from "framer-motion";
import {
  Users, IndianRupee, CalendarCheck, TrendingUp,
  Plus, Check, X, ChevronDown, Loader2, Download,
  Clock, AlertCircle, Banknote, FileText, Play,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  useEmployees, useEmployeeSalaries, useUpsertSalary,
  useUpdateEmployee, useSalaryAdvances, useCreateAdvance,
  useUpdateAdvance, usePayrollRuns, usePayslips,
  useRunPayroll, useMarkPayrollPaid,
} from "@/hooks/usePayroll";
import { useAttendance } from "@/hooks/usePayroll";

interface Props { restaurantId: string; currencySymbol?: string; }

const fmt = (n: number) => n.toLocaleString("en-IN");
const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return format(new Date(Number(y), Number(mo) - 1, 1), "MMMM yyyy");
};

export function PayrollManagement({ restaurantId, currencySymbol = "₹" }: Props) {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(format(today, "yyyy-MM"));
  const [salaryDialogEmp, setSalaryDialogEmp] = useState<any>(null);
  const [advanceDialog, setAdvanceDialog] = useState(false);
  const [advEmpId, setAdvEmpId] = useState("");
  const [advAmount, setAdvAmount] = useState("");
  const [advReason, setAdvReason] = useState("");

  // Salary dialog form state
  const [salForm, setSalForm] = useState({
    salary_type: "monthly", basic_salary: "", hra: "", transport: "",
    other_allowances: "", pf_deduction: "", esi_deduction: "", other_deductions: "",
  });

  const { data: employees = [], isLoading: empLoading } = useEmployees(restaurantId);
  const { data: salaryMap = {} } = useEmployeeSalaries(restaurantId);
  const { data: attendance = [] } = useAttendance(restaurantId, selectedMonth);
  const { data: advances = [] } = useSalaryAdvances(restaurantId);
  const { data: payrollRuns = [] } = usePayrollRuns(restaurantId);
  const { data: payslips = [] } = usePayslips(restaurantId, selectedMonth);

  const upsertSalary = useUpsertSalary();
  const updateEmployee = useUpdateEmployee();
  const createAdvance = useCreateAdvance();
  const updateAdvance = useUpdateAdvance();
  const runPayroll = useRunPayroll();
  const markPaid = useMarkPayrollPaid();

  // Build month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(today, i);
    return format(d, "yyyy-MM");
  });

  // Stats
  const totalStaff = employees.length;
  const staffWithSalary = employees.filter((e) => salaryMap[e.id]).length;
  const currentRun = payrollRuns.find((r) => r.month === selectedMonth);
  const pendingAdvances = advances.filter((a) => a.status === "pending").length;
  const totalMonthlyPayroll = employees.reduce((sum, e) => {
    const s = salaryMap[e.id];
    return sum + (s ? s.basic_salary + s.hra + s.transport + s.other_allowances : 0);
  }, 0);

  // Attendance summary for selected month
  const attendedDays: Record<string, Set<string>> = {};
  attendance.forEach((a) => {
    if (!attendedDays[a.employee_id]) attendedDays[a.employee_id] = new Set();
    attendedDays[a.employee_id].add(a.login_time.slice(0, 10));
  });

  function openSalaryDialog(emp: any) {
    const existing = salaryMap[emp.id];
    setSalForm({
      salary_type: existing?.salary_type || "monthly",
      basic_salary: existing?.basic_salary?.toString() || "",
      hra: existing?.hra?.toString() || "",
      transport: existing?.transport?.toString() || "",
      other_allowances: existing?.other_allowances?.toString() || "",
      pf_deduction: existing?.pf_deduction?.toString() || "",
      esi_deduction: existing?.esi_deduction?.toString() || "",
      other_deductions: existing?.other_deductions?.toString() || "",
    });
    setSalaryDialogEmp(emp);
  }

  async function handleSaveSalary() {
    if (!salaryDialogEmp || !salForm.basic_salary) {
      toast.error("Basic salary is required");
      return;
    }
    await upsertSalary.mutateAsync({
      restaurantId,
      employeeId: salaryDialogEmp.id,
      salaryType: salForm.salary_type,
      basicSalary: Number(salForm.basic_salary),
      hra: Number(salForm.hra || 0),
      transport: Number(salForm.transport || 0),
      otherAllowances: Number(salForm.other_allowances || 0),
      pfDeduction: Number(salForm.pf_deduction || 0),
      esiDeduction: Number(salForm.esi_deduction || 0),
      otherDeductions: Number(salForm.other_deductions || 0),
    });
    toast.success("Salary saved");
    setSalaryDialogEmp(null);
  }

  async function handleCreateAdvance() {
    if (!advEmpId || !advAmount) { toast.error("Select employee and enter amount"); return; }
    await createAdvance.mutateAsync({ restaurantId, employeeId: advEmpId, amount: Number(advAmount), reason: advReason });
    toast.success("Advance request created");
    setAdvanceDialog(false);
    setAdvEmpId(""); setAdvAmount(""); setAdvReason("");
  }

  async function handleRunPayroll() {
    if (employees.length === 0) { toast.error("No employees found"); return; }
    await runPayroll.mutateAsync({ restaurantId, month: selectedMonth, employees, salaryMap, attendanceRecords: attendance, advanceList: advances });
    toast.success(`Payroll processed for ${monthLabel(selectedMonth)}`);
  }

  async function handleMarkPaid() {
    if (!currentRun) return;
    await markPaid.mutateAsync({ runId: currentRun.id, restaurantId, month: selectedMonth });
    toast.success("Payroll marked as paid");
  }

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      draft: "secondary", processed: "default", paid: "success",
      pending: "secondary", approved: "default", rejected: "destructive", deducted: "outline",
    };
    return <Badge variant={(map[s] || "secondary") as any} className="capitalize">{s}</Badge>;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-muted-foreground text-sm">Manage salaries, attendance, and monthly payroll</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setAdvanceDialog(true)}>
            <Plus className="w-4 h-4 mr-1" /> Advance
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Staff", value: totalStaff, icon: Users, color: "text-blue-500" },
          { label: "Monthly Payroll", value: `${currencySymbol}${fmt(totalMonthlyPayroll)}`, icon: IndianRupee, color: "text-green-500" },
          { label: "Salary Set", value: `${staffWithSalary}/${totalStaff}`, icon: CalendarCheck, color: "text-orange-500" },
          { label: "Pending Advances", value: pendingAdvances, icon: AlertCircle, color: "text-red-500" },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="payroll">Run Payroll</TabsTrigger>
          <TabsTrigger value="advances">Advances</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
        </TabsList>

        {/* ── EMPLOYEES TAB ── */}
        <TabsContent value="employees" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Staff & Salary Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {empLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-muted-foreground" /></div>
              ) : employees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No employees found. Add staff from the Staff tab first.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Basic Salary</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp) => {
                        const sal = salaryMap[emp.id];
                        const gross = sal ? sal.basic_salary + sal.hra + sal.transport + sal.other_allowances : 0;
                        const deductions = sal ? sal.pf_deduction + sal.esi_deduction + sal.other_deductions : 0;
                        const net = gross - deductions;
                        return (
                          <TableRow key={emp.id}>
                            <TableCell>
                              <div className="font-medium">{emp.full_name}</div>
                              <div className="text-xs text-muted-foreground">{emp.phone || "—"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{emp.role}</Badge>
                            </TableCell>
                            <TableCell>{sal ? `${currencySymbol}${fmt(sal.basic_salary)}` : <span className="text-muted-foreground text-xs">Not set</span>}</TableCell>
                            <TableCell>{sal ? `${currencySymbol}${fmt(gross)}` : "—"}</TableCell>
                            <TableCell className="text-red-500">{sal ? `−${currencySymbol}${fmt(deductions)}` : "—"}</TableCell>
                            <TableCell className="font-semibold text-green-600">{sal ? `${currencySymbol}${fmt(net)}` : "—"}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={() => openSalaryDialog(emp)}>
                                {sal ? "Edit Salary" : "Set Salary"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ATTENDANCE TAB ── */}
        <TabsContent value="attendance" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Attendance — {monthLabel(selectedMonth)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {employees.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No employees found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Days Present</TableHead>
                        <TableHead>Days Absent</TableHead>
                        <TableHead>Total Hours</TableHead>
                        <TableHead>Overtime Hrs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map((emp) => {
                        const records = attendance.filter((a) => a.employee_id === emp.id);
                        const daysPresent = attendedDays[emp.id]?.size || 0;
                        const [y, mo] = selectedMonth.split("-").map(Number);
                        const daysInMonth = new Date(y, mo, 0).getDate();
                        const daysAbsent = daysInMonth - daysPresent;
                        const totalMins = records.reduce((s, r) => s + (r.total_worked_minutes || 0), 0);
                        const overtimeMins = records.reduce((s, r) => s + (r.overtime_minutes || 0), 0);
                        return (
                          <TableRow key={emp.id}>
                            <TableCell className="font-medium">{emp.full_name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{emp.role}</Badge></TableCell>
                            <TableCell>
                              <span className="font-semibold text-green-600">{daysPresent}</span>
                              <span className="text-muted-foreground text-xs"> / {daysInMonth}</span>
                            </TableCell>
                            <TableCell className={daysAbsent > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>{daysAbsent}</TableCell>
                            <TableCell>{Math.floor(totalMins / 60)}h {totalMins % 60}m</TableCell>
                            <TableCell>{Math.floor(overtimeMins / 60)}h {overtimeMins % 60}m</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PAYROLL TAB ── */}
        <TabsContent value="payroll" className="mt-4 space-y-4">
          {/* Current month status */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5 flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Payroll for</p>
                <p className="text-xl font-bold">{monthLabel(selectedMonth)}</p>
                <div className="mt-1">{currentRun ? statusBadge(currentRun.status) : <Badge variant="secondary">Not started</Badge>}</div>
              </div>
              {currentRun && (
                <div className="flex gap-6 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Gross</p>
                    <p className="text-lg font-bold">{currencySymbol}{fmt(currentRun.total_gross)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Deductions</p>
                    <p className="text-lg font-bold text-red-500">−{currencySymbol}{fmt(currentRun.total_deductions)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Net Pay</p>
                    <p className="text-lg font-bold text-green-600">{currencySymbol}{fmt(currentRun.total_net)}</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={handleRunPayroll}
                  disabled={runPayroll.isPending || staffWithSalary === 0}
                >
                  {runPayroll.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                  {currentRun ? "Re-run Payroll" : "Run Payroll"}
                </Button>
                {currentRun?.status === "processed" && (
                  <Button variant="outline" onClick={handleMarkPaid} disabled={markPaid.isPending}>
                    <Check className="w-4 h-4 mr-1" /> Mark as Paid
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Payroll history */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3"><CardTitle className="text-base">Payroll History</CardTitle></CardHeader>
            <CardContent className="p-0">
              {payrollRuns.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No payroll runs yet. Run your first payroll above.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRuns.map((run) => (
                      <TableRow key={run.id} className="cursor-pointer" onClick={() => setSelectedMonth(run.month)}>
                        <TableCell className="font-medium">{monthLabel(run.month)}</TableCell>
                        <TableCell>{currencySymbol}{fmt(run.total_gross)}</TableCell>
                        <TableCell className="text-red-500">−{currencySymbol}{fmt(run.total_deductions)}</TableCell>
                        <TableCell className="font-semibold text-green-600">{currencySymbol}{fmt(run.total_net)}</TableCell>
                        <TableCell>{statusBadge(run.status)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{run.paid_at ? format(new Date(run.paid_at), "dd MMM yyyy") : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ADVANCES TAB ── */}
        <TabsContent value="advances" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Salary Advances</CardTitle>
              <Button size="sm" onClick={() => setAdvanceDialog(true)}>
                <Plus className="w-4 h-4 mr-1" /> New Advance
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {advances.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No advance requests yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.map((adv) => (
                      <TableRow key={adv.id}>
                        <TableCell className="font-medium">{(adv.employee as any)?.full_name || "—"}</TableCell>
                        <TableCell className="font-semibold">{currencySymbol}{fmt(adv.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{adv.reason || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(adv.requested_at), "dd MMM yyyy")}</TableCell>
                        <TableCell>{statusBadge(adv.status)}</TableCell>
                        <TableCell>
                          {adv.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => updateAdvance.mutateAsync({ id: adv.id, restaurantId, status: "approved" }).then(() => toast.success("Approved"))}>
                                <Check className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => updateAdvance.mutateAsync({ id: adv.id, restaurantId, status: "rejected" }).then(() => toast.success("Rejected"))}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PAYSLIPS TAB ── */}
        <TabsContent value="payslips" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payslips — {monthLabel(selectedMonth)}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {payslips.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No payslips for {monthLabel(selectedMonth)}. Run payroll first.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Basic</TableHead>
                      <TableHead>Allowances</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((ps) => (
                      <TableRow key={ps.id}>
                        <TableCell>
                          <div className="font-medium">{(ps.employee as any)?.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{(ps.employee as any)?.role}</div>
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">{ps.days_worked}</span>
                          <span className="text-muted-foreground text-xs"> / {ps.days_in_month}</span>
                        </TableCell>
                        <TableCell>{currencySymbol}{fmt(ps.basic_salary)}</TableCell>
                        <TableCell>{currencySymbol}{fmt(ps.hra + ps.transport + ps.other_allowances)}</TableCell>
                        <TableCell className="font-medium">{currencySymbol}{fmt(ps.gross_salary)}</TableCell>
                        <TableCell className="text-red-500">
                          −{currencySymbol}{fmt(ps.pf_deduction + ps.esi_deduction + ps.advance_deduction + ps.other_deductions)}
                        </TableCell>
                        <TableCell className="font-bold text-green-600">{currencySymbol}{fmt(ps.net_salary)}</TableCell>
                        <TableCell>{statusBadge(ps.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <tr className="bg-muted/40 font-semibold">
                      <td colSpan={4} className="px-4 py-3 text-sm">Total</td>
                      <td className="px-4 py-3 text-sm">{currencySymbol}{fmt(payslips.reduce((s, p) => s + p.gross_salary, 0))}</td>
                      <td className="px-4 py-3 text-sm text-red-500">
                        −{currencySymbol}{fmt(payslips.reduce((s, p) => s + p.pf_deduction + p.esi_deduction + p.advance_deduction + p.other_deductions, 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600">{currencySymbol}{fmt(payslips.reduce((s, p) => s + p.net_salary, 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Salary Dialog ── */}
      <Dialog open={!!salaryDialogEmp} onOpenChange={() => setSalaryDialogEmp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Salary — {salaryDialogEmp?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Salary Type</Label>
              <Select value={salForm.salary_type} onValueChange={(v) => setSalForm({ ...salForm, salary_type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "basic_salary", label: "Basic Salary *" },
                { key: "hra", label: "HRA" },
                { key: "transport", label: "Transport Allowance" },
                { key: "other_allowances", label: "Other Allowances" },
                { key: "pf_deduction", label: "PF Deduction" },
                { key: "esi_deduction", label: "ESI Deduction" },
                { key: "other_deductions", label: "Other Deductions" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number" min={0}
                    className="mt-1"
                    placeholder="0"
                    value={(salForm as any)[key]}
                    onChange={(e) => setSalForm({ ...salForm, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            {/* Live preview */}
            {salForm.basic_salary && (
              <div className="rounded-lg bg-muted p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">Gross</span>
                <span className="font-semibold">{currencySymbol}{fmt(
                  Number(salForm.basic_salary) + Number(salForm.hra || 0) +
                  Number(salForm.transport || 0) + Number(salForm.other_allowances || 0)
                )}</span>
                <span className="text-muted-foreground ml-4">Net</span>
                <span className="font-bold text-green-600">{currencySymbol}{fmt(
                  Number(salForm.basic_salary) + Number(salForm.hra || 0) +
                  Number(salForm.transport || 0) + Number(salForm.other_allowances || 0) -
                  Number(salForm.pf_deduction || 0) - Number(salForm.esi_deduction || 0) - Number(salForm.other_deductions || 0)
                )}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSalaryDialogEmp(null)}>Cancel</Button>
            <Button onClick={handleSaveSalary} disabled={upsertSalary.isPending}>
              {upsertSalary.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save Salary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Advance Dialog ── */}
      <Dialog open={advanceDialog} onOpenChange={setAdvanceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Salary Advance</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Employee</Label>
              <Select value={advEmpId} onValueChange={setAdvEmpId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount ({currencySymbol})</Label>
              <Input type="number" min={1} className="mt-1" placeholder="5000" value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} />
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Input className="mt-1" placeholder="Medical emergency, etc." value={advReason} onChange={(e) => setAdvReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdvanceDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateAdvance} disabled={createAdvance.isPending}>
              {createAdvance.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Submit Advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
