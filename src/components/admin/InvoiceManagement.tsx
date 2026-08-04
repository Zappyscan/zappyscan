import { useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Plus, FileText, Users, BarChart3, X, Check,
  Loader2, ChevronRight, IndianRupee, Search,
  Building2, Phone, Mail, Trash2, Edit2, Eye,
  Share2, Wallet,
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useInvoiceParties, useCreateParty, useUpdateParty, useDeleteParty,
  useInvoices, useCreateInvoice, useUpdateInvoiceStatus, useRecordPayment,
  calcInvoiceTotals,
  type InvoiceParty, type Invoice, type InvoiceItem,
} from "@/hooks/useInvoice";

interface Props { restaurantId: string; restaurantName?: string; currencySymbol?: string; }

const GST_RATES = [0, 5, 12, 18, 28];
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh",
];

const emptyItem = (): InvoiceItem => ({
  description: "", hsn_sac: "", quantity: 1, unit: "pcs", rate: 0,
  discount_pct: 0, taxable_amount: 0, gst_rate: 18,
  cgst_rate: 9, sgst_rate: 9, igst_rate: 0,
  cgst_amount: 0, sgst_amount: 0, igst_amount: 0, total: 0, sort_order: 0,
});

const statusColor: Record<string, string> = {
  draft: "secondary", sent: "default", paid: "outline",
  partially_paid: "default", overdue: "destructive", cancelled: "secondary",
};

const fmt = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function InvoiceManagement({ restaurantId, restaurantName = "Restaurant", currencySymbol = "₹" }: Props) {
  const [search, setSearch] = useState("");

  // Party dialog
  const [partyDialog, setPartyDialog] = useState(false);
  const [editParty, setEditParty] = useState<InvoiceParty | null>(null);
  const [partyForm, setPartyForm] = useState({
    name: "", type: "client" as "client" | "vendor" | "both",
    gstin: "", pan: "", phone: "", email: "", address: "", city: "", state: "", pincode: "", notes: "",
  });

  // Invoice create dialog
  const [createDialog, setCreateDialog] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    partyId: "", type: "sales" as string,
    supplyType: "intrastate" as "intrastate" | "interstate",
    invoiceDate: format(new Date(), "yyyy-MM-dd"),
    dueDate: "", placeOfSupply: "", notes: "", terms: "Payment due within 30 days.",
  });
  const [lineItems, setLineItems] = useState<InvoiceItem[]>([emptyItem()]);

  // Payment dialog
  const [payDialog, setPayDialog] = useState<Invoice | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "cash", reference: "" });

  // View dialog
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const { data: parties = [] } = useInvoiceParties(restaurantId);
  const { data: invoices = [], isLoading } = useInvoices(restaurantId);
  const createParty = useCreateParty();
  const updateParty = useUpdateParty();
  const deleteParty = useDeleteParty();
  const createInvoice = useCreateInvoice();
  const updateStatus = useUpdateInvoiceStatus();
  const recordPayment = useRecordPayment();

  const totals = calcInvoiceTotals(lineItems, invoiceForm.supplyType);

  // Stats
  const totalInvoiced = invoices.filter(i => i.type === "sales").reduce((s, i) => s + i.grand_total, 0);
  const totalOutstanding = invoices.filter(i => ["sent","partially_paid","overdue"].includes(i.status)).reduce((s, i) => s + i.amount_due, 0);
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.grand_total, 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  const filteredInvoices = invoices.filter(inv =>
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.party as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  function openPartyDialog(party?: InvoiceParty) {
    if (party) {
      setEditParty(party);
      setPartyForm({
        name: party.name, type: party.type, gstin: party.gstin || "",
        pan: party.pan || "", phone: party.phone || "", email: party.email || "",
        address: party.address || "", city: party.city || "", state: party.state || "",
        pincode: party.pincode || "", notes: party.notes || "",
      });
    } else {
      setEditParty(null);
      setPartyForm({ name: "", type: "client", gstin: "", pan: "", phone: "", email: "", address: "", city: "", state: "", pincode: "", notes: "" });
    }
    setPartyDialog(true);
  }

  async function handleSaveParty() {
    if (!partyForm.name) { toast.error("Party name is required"); return; }
    if (editParty) {
      await updateParty.mutateAsync({ id: editParty.id, restaurantId, updates: partyForm });
      toast.success("Party updated");
    } else {
      await createParty.mutateAsync({ ...partyForm, restaurant_id: restaurantId });
      toast.success("Party added");
    }
    setPartyDialog(false);
  }

  function updateLineItem(index: number, field: keyof InvoiceItem, value: any) {
    setLineItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleCreateInvoice() {
    if (!invoiceForm.invoiceDate) { toast.error("Invoice date is required"); return; }
    if (lineItems.some(i => !i.description)) { toast.error("All line items need a description"); return; }
    await createInvoice.mutateAsync({
      restaurantId,
      partyId: invoiceForm.partyId || null,
      type: invoiceForm.type,
      supplyType: invoiceForm.supplyType,
      invoiceDate: invoiceForm.invoiceDate,
      dueDate: invoiceForm.dueDate || null,
      placeOfSupply: invoiceForm.placeOfSupply,
      items: lineItems,
      notes: invoiceForm.notes,
      terms: invoiceForm.terms,
    });
    toast.success("Invoice created");
    setCreateDialog(false);
    setLineItems([emptyItem()]);
    setInvoiceForm(f => ({ ...f, partyId: "", notes: "", dueDate: "" }));
  }

  async function handleRecordPayment() {
    if (!payDialog || !payForm.amount) { toast.error("Enter payment amount"); return; }
    await recordPayment.mutateAsync({
      invoiceId: payDialog.id, restaurantId,
      amount: Number(payForm.amount), method: payForm.method,
      reference: payForm.reference, grandTotal: payDialog.grand_total,
      currentPaid: payDialog.amount_paid,
    });
    toast.success("Payment recorded");
    setPayDialog(null);
    setPayForm({ amount: "", method: "cash", reference: "" });
  }

  const typeLabel: Record<string, string> = {
    sales: "Sales Invoice", purchase: "Purchase Order",
    credit_note: "Credit Note", debit_note: "Debit Note",
    proforma: "Proforma Invoice", quotation: "Quotation",
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="text-muted-foreground text-sm">GST-compliant invoices, purchase orders & vendor bills</p>
        </div>
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Invoiced", value: `${currencySymbol}${fmt(totalInvoiced)}`, icon: FileText, color: "text-blue-500" },
          { label: "Outstanding", value: `${currencySymbol}${fmt(totalOutstanding)}`, icon: IndianRupee, color: "text-orange-500" },
          { label: "Collected", value: `${currencySymbol}${fmt(totalPaid)}`, icon: Wallet, color: "text-green-500" },
          { label: "Overdue", value: overdueCount, icon: BarChart3, color: "text-red-500" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${s.color}`}><s.icon className="w-5 h-5" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="parties">Parties</TabsTrigger>
          <TabsTrigger value="gstr">GSTR Summary</TabsTrigger>
        </TabsList>

        {/* ── INVOICES TAB ── */}
        <TabsContent value="invoices" className="mt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search invoice number or party..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-muted-foreground" /></div>
              ) : filteredInvoices.length === 0 ? (
                <div className="text-center py-14 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No invoices yet. Create your first invoice.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Party</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono font-medium">{inv.invoice_number}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{typeLabel[inv.type] || inv.type}</TableCell>
                          <TableCell>{(inv.party as any)?.name || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="text-sm">{format(new Date(inv.invoice_date), "dd MMM yyyy")}</TableCell>
                          <TableCell className="font-semibold">{currencySymbol}{fmt(inv.grand_total)}</TableCell>
                          <TableCell className={inv.amount_due > 0 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                            {inv.amount_due > 0 ? `${currencySymbol}${fmt(inv.amount_due)}` : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={(statusColor[inv.status] || "secondary") as any} className="capitalize text-xs">
                              {inv.status.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setViewInvoice(inv)}><Eye className="w-3.5 h-3.5" /></Button>
                              {["sent","partially_paid","overdue"].includes(inv.status) && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => setPayDialog(inv)}>
                                  <Wallet className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              {inv.status === "draft" && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => updateStatus.mutateAsync({ id: inv.id, restaurantId, status: "sent" }).then(() => toast.success("Marked as Sent"))}>
                                  Send
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PARTIES TAB ── */}
        <TabsContent value="parties" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base">Clients & Vendors</CardTitle>
              <Button size="sm" onClick={() => openPartyDialog()}><Plus className="w-4 h-4 mr-1" /> Add Party</Button>
            </CardHeader>
            <CardContent className="p-0">
              {parties.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>No parties yet. Add your first client or vendor.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>GSTIN</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parties.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">{p.type}</Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.gstin || "—"}</TableCell>
                          <TableCell className="text-sm">{p.phone || "—"}</TableCell>
                          <TableCell className="text-sm">{p.city || "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openPartyDialog(p)}><Edit2 className="w-3.5 h-3.5" /></Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteParty.mutateAsync({ id: p.id, restaurantId }).then(() => toast.success("Deleted"))}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── GSTR SUMMARY TAB ── */}
        <TabsContent value="gstr" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">GSTR-1 Summary (Sales Invoices)</CardTitle></CardHeader>
            <CardContent>
              {invoices.filter(i => i.type === "sales").length === 0 ? (
                <p className="text-muted-foreground text-sm">No sales invoices found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Party / GSTIN</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Taxable Amt</TableHead>
                      <TableHead>CGST</TableHead>
                      <TableHead>SGST</TableHead>
                      <TableHead>IGST</TableHead>
                      <TableHead>Total Tax</TableHead>
                      <TableHead>Invoice Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.filter(i => i.type === "sales").map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoice_number}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{(inv.party as any)?.name || "—"}</div>
                          <div className="text-xs text-muted-foreground font-mono">{(inv.party as any)?.gstin || "Unregistered"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(inv.invoice_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{currencySymbol}{fmt(inv.taxable_amount)}</TableCell>
                        <TableCell>{currencySymbol}{fmt(inv.total_cgst)}</TableCell>
                        <TableCell>{currencySymbol}{fmt(inv.total_sgst)}</TableCell>
                        <TableCell>{currencySymbol}{fmt(inv.total_igst)}</TableCell>
                        <TableCell className="font-medium">{currencySymbol}{fmt(inv.total_tax)}</TableCell>
                        <TableCell className="font-bold">{currencySymbol}{fmt(inv.grand_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <tfoot>
                    <tr className="bg-muted/40 font-semibold text-sm">
                      <td colSpan={3} className="px-4 py-3">Total</td>
                      <td className="px-4 py-3">{currencySymbol}{fmt(invoices.filter(i=>i.type==="sales").reduce((s,i)=>s+i.taxable_amount,0))}</td>
                      <td className="px-4 py-3">{currencySymbol}{fmt(invoices.filter(i=>i.type==="sales").reduce((s,i)=>s+i.total_cgst,0))}</td>
                      <td className="px-4 py-3">{currencySymbol}{fmt(invoices.filter(i=>i.type==="sales").reduce((s,i)=>s+i.total_sgst,0))}</td>
                      <td className="px-4 py-3">{currencySymbol}{fmt(invoices.filter(i=>i.type==="sales").reduce((s,i)=>s+i.total_igst,0))}</td>
                      <td className="px-4 py-3">{currencySymbol}{fmt(invoices.filter(i=>i.type==="sales").reduce((s,i)=>s+i.total_tax,0))}</td>
                      <td className="px-4 py-3">{currencySymbol}{fmt(invoices.filter(i=>i.type==="sales").reduce((s,i)=>s+i.grand_total,0))}</td>
                    </tr>
                  </tfoot>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Create Invoice Dialog ── */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Invoice</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={invoiceForm.type} onValueChange={v => setInvoiceForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabel).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Party</Label>
                <Select value={invoiceForm.partyId} onValueChange={v => setInvoiceForm(f => ({ ...f, partyId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select party" /></SelectTrigger>
                  <SelectContent>
                    {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Supply Type</Label>
                <Select value={invoiceForm.supplyType} onValueChange={(v: any) => setInvoiceForm(f => ({ ...f, supplyType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intrastate">Intrastate (CGST+SGST)</SelectItem>
                    <SelectItem value="interstate">Interstate (IGST)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Invoice Date</Label>
                <Input type="date" className="mt-1" value={invoiceForm.invoiceDate} onChange={e => setInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="date" className="mt-1" value={invoiceForm.dueDate} onChange={e => setInvoiceForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Place of Supply</Label>
                <Select value={invoiceForm.placeOfSupply} onValueChange={v => setInvoiceForm(f => ({ ...f, placeOfSupply: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="State" /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items</Label>
                <Button size="sm" variant="outline" onClick={() => setLineItems(p => [...p, emptyItem()])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted text-muted-foreground">
                      <th className="p-2 text-left font-medium">Description</th>
                      <th className="p-2 text-left font-medium w-16">HSN</th>
                      <th className="p-2 text-left font-medium w-14">Qty</th>
                      <th className="p-2 text-left font-medium w-20">Rate</th>
                      <th className="p-2 text-left font-medium w-14">Disc%</th>
                      <th className="p-2 text-left font-medium w-14">GST%</th>
                      <th className="p-2 text-left font-medium w-20">Total</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, i) => {
                      const lineTotal = item.quantity * item.rate;
                      const disc = lineTotal * (item.discount_pct / 100);
                      const taxable = lineTotal - disc;
                      const gst = invoiceForm.supplyType === "intrastate"
                        ? taxable * (item.gst_rate / 100)
                        : taxable * (item.gst_rate / 100);
                      const total = taxable + gst;
                      return (
                        <tr key={i} className="border-b border-border">
                          <td className="p-1"><Input className="h-8 text-xs" value={item.description} onChange={e => updateLineItem(i, "description", e.target.value)} placeholder="Item description" /></td>
                          <td className="p-1"><Input className="h-8 text-xs w-16" value={item.hsn_sac} onChange={e => updateLineItem(i, "hsn_sac", e.target.value)} placeholder="HSN" /></td>
                          <td className="p-1"><Input type="number" min={0} className="h-8 text-xs w-14" value={item.quantity} onChange={e => updateLineItem(i, "quantity", Number(e.target.value))} /></td>
                          <td className="p-1"><Input type="number" min={0} className="h-8 text-xs w-20" value={item.rate} onChange={e => updateLineItem(i, "rate", Number(e.target.value))} /></td>
                          <td className="p-1"><Input type="number" min={0} max={100} className="h-8 text-xs w-14" value={item.discount_pct} onChange={e => updateLineItem(i, "discount_pct", Number(e.target.value))} /></td>
                          <td className="p-1">
                            <Select value={String(item.gst_rate)} onValueChange={v => updateLineItem(i, "gst_rate", Number(v))}>
                              <SelectTrigger className="h-8 text-xs w-14"><SelectValue /></SelectTrigger>
                              <SelectContent>{GST_RATES.map(r => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="p-1 text-right font-medium text-xs">{currencySymbol}{fmt(total)}</td>
                          <td className="p-1">
                            {lineItems.length > 1 && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400" onClick={() => setLineItems(p => p.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5" /></Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals box */}
              <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{currencySymbol}{fmt(totals.subtotal)}</span></div>
                {totals.totalDiscount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>−{currencySymbol}{fmt(totals.totalDiscount)}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Taxable</span><span>{currencySymbol}{fmt(totals.taxableAmount)}</span></div>
                {totals.totalCgst > 0 && <div className="flex justify-between text-muted-foreground"><span>CGST</span><span>{currencySymbol}{fmt(totals.totalCgst)}</span></div>}
                {totals.totalSgst > 0 && <div className="flex justify-between text-muted-foreground"><span>SGST</span><span>{currencySymbol}{fmt(totals.totalSgst)}</span></div>}
                {totals.totalIgst > 0 && <div className="flex justify-between text-muted-foreground"><span>IGST</span><span>{currencySymbol}{fmt(totals.totalIgst)}</span></div>}
                {totals.roundOff !== 0 && <div className="flex justify-between text-muted-foreground"><span>Round Off</span><span>{totals.roundOff > 0 ? "+" : ""}{currencySymbol}{fmt(totals.roundOff)}</span></div>}
                <div className="flex justify-between font-bold text-base border-t pt-1"><span>Grand Total</span><span>{currencySymbol}{fmt(totals.grandTotal)}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea className="mt-1 text-sm" rows={2} value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />
              </div>
              <div>
                <Label className="text-xs">Payment Terms</Label>
                <Textarea className="mt-1 text-sm" rows={2} value={invoiceForm.terms} onChange={e => setInvoiceForm(f => ({ ...f, terms: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} disabled={createInvoice.isPending}>
              {createInvoice.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Party Dialog ── */}
      <Dialog open={partyDialog} onOpenChange={setPartyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editParty ? "Edit Party" : "Add Party"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label className="text-xs">Name *</Label>
              <Input className="mt-1" value={partyForm.name} onChange={e => setPartyForm(f => ({ ...f, name: e.target.value }))} placeholder="ABC Pvt Ltd" />
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={partyForm.type} onValueChange={(v: any) => setPartyForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">GSTIN</Label>
              <Input className="mt-1 font-mono" value={partyForm.gstin} onChange={e => setPartyForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))} placeholder="22AAAAA0000A1Z5" />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input className="mt-1" value={partyForm.phone} onChange={e => setPartyForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" className="mt-1" value={partyForm.email} onChange={e => setPartyForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Address</Label>
              <Input className="mt-1" value={partyForm.address} onChange={e => setPartyForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">City</Label>
              <Input className="mt-1" value={partyForm.city} onChange={e => setPartyForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">State</Label>
              <Select value={partyForm.state} onValueChange={v => setPartyForm(f => ({ ...f, state: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select state" /></SelectTrigger>
                <SelectContent>{INDIAN_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPartyDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveParty} disabled={createParty.isPending || updateParty.isPending}>
              {(createParty.isPending || updateParty.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Payment Dialog ── */}
      <Dialog open={!!payDialog} onOpenChange={() => setPayDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {payDialog?.invoice_number}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted p-3 text-sm flex justify-between">
              <span>Outstanding</span>
              <span className="font-bold text-red-500">{currencySymbol}{fmt(payDialog?.amount_due || 0)}</span>
            </div>
            <div>
              <Label className="text-xs">Amount Received ({currencySymbol})</Label>
              <Input type="number" min={1} className="mt-1" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder={String(payDialog?.amount_due || "")} />
            </div>
            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={payForm.method} onValueChange={v => setPayForm(f => ({ ...f, method: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash","upi","bank_transfer","cheque","card","other"].map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_"," ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Reference / UTR (optional)</Label>
              <Input className="mt-1" value={payForm.reference} onChange={e => setPayForm(f => ({ ...f, reference: e.target.value }))} placeholder="UPI ref, cheque no, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayDialog(null)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={recordPayment.isPending}>
              {recordPayment.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── View Invoice Dialog ── */}
      <Dialog open={!!viewInvoice} onOpenChange={() => setViewInvoice(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {viewInvoice?.invoice_number}
              <Badge variant={(statusColor[viewInvoice?.status || "draft"] || "secondary") as any} className="capitalize">
                {viewInvoice?.status?.replace("_"," ")}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {viewInvoice && (
            <div className="space-y-3 text-sm py-2">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Type: </span>{typeLabel[viewInvoice.type]}</div>
                <div><span className="text-muted-foreground">Date: </span>{format(new Date(viewInvoice.invoice_date), "dd MMM yyyy")}</div>
                <div><span className="text-muted-foreground">Party: </span>{(viewInvoice.party as any)?.name || "—"}</div>
                {viewInvoice.due_date && <div><span className="text-muted-foreground">Due: </span>{format(new Date(viewInvoice.due_date), "dd MMM yyyy")}</div>}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="grid grid-cols-2 divide-x">
                  <div className="p-3"><p className="text-xs text-muted-foreground">Taxable Amount</p><p className="font-semibold">{currencySymbol}{fmt(viewInvoice.taxable_amount)}</p></div>
                  <div className="p-3"><p className="text-xs text-muted-foreground">Total Tax</p><p className="font-semibold">{currencySymbol}{fmt(viewInvoice.total_tax)}</p></div>
                  <div className="p-3"><p className="text-xs text-muted-foreground">Grand Total</p><p className="font-bold text-base">{currencySymbol}{fmt(viewInvoice.grand_total)}</p></div>
                  <div className="p-3"><p className="text-xs text-muted-foreground">Amount Due</p><p className={`font-bold text-base ${viewInvoice.amount_due > 0 ? "text-red-500" : "text-green-600"}`}>{currencySymbol}{fmt(viewInvoice.amount_due)}</p></div>
                </div>
              </div>
              {viewInvoice.notes && <p className="text-muted-foreground italic">Note: {viewInvoice.notes}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewInvoice(null)}>Close</Button>
            {viewInvoice && ["sent","partially_paid","overdue"].includes(viewInvoice.status) && (
              <Button onClick={() => { setPayDialog(viewInvoice); setViewInvoice(null); }}>
                <Wallet className="w-4 h-4 mr-1" /> Record Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
