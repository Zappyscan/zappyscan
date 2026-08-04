import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceParty {
  id: string;
  restaurant_id: string;
  name: string;
  type: "client" | "vendor" | "both";
  gstin: string | null;
  pan: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id?: string;
  description: string;
  hsn_sac: string;
  quantity: number;
  unit: string;
  rate: number;
  discount_pct: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total: number;
  sort_order: number;
}

export interface Invoice {
  id: string;
  restaurant_id: string;
  party_id: string | null;
  invoice_number: string;
  type: "sales" | "purchase" | "credit_note" | "debit_note" | "proforma" | "quotation";
  status: "draft" | "sent" | "paid" | "partially_paid" | "overdue" | "cancelled";
  invoice_date: string;
  due_date: string | null;
  supply_type: "intrastate" | "interstate";
  place_of_supply: string | null;
  subtotal: number;
  total_discount: number;
  taxable_amount: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_tax: number;
  round_off: number;
  grand_total: number;
  amount_paid: number;
  amount_due: number;
  notes: string | null;
  terms: string | null;
  created_at: string;
  party?: InvoiceParty;
  items?: InvoiceItem[];
}

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  method: string;
  reference: string | null;
  notes: string | null;
}

// ─── Parties ──────────────────────────────────────────────────────────────────

export function useInvoiceParties(restaurantId?: string) {
  return useQuery({
    queryKey: ["invoice_parties", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_parties")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("name");
      if (error) throw error;
      return (data || []) as InvoiceParty[];
    },
    enabled: !!restaurantId,
  });
}

export function useCreateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<InvoiceParty, "id" | "created_at">) => {
      const { error } = await supabase.from("invoice_parties").insert(payload);
      if (error) throw error;
      return payload.restaurant_id;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["invoice_parties", rid] }),
  });
}

export function useUpdateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId, updates }: { id: string; restaurantId: string; updates: Partial<InvoiceParty> }) => {
      const { error } = await supabase.from("invoice_parties").update(updates).eq("id", id);
      if (error) throw error;
      return restaurantId;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["invoice_parties", rid] }),
  });
}

export function useDeleteParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId }: { id: string; restaurantId: string }) => {
      const { error } = await supabase.from("invoice_parties").delete().eq("id", id);
      if (error) throw error;
      return restaurantId;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["invoice_parties", rid] }),
  });
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export function useInvoices(restaurantId?: string) {
  return useQuery({
    queryKey: ["invoices", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, party:invoice_parties(id,name,gstin,type)")
        .eq("restaurant_id", restaurantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Invoice[];
    },
    enabled: !!restaurantId,
  });
}

export function useInvoiceDetail(invoiceId?: string) {
  return useQuery({
    queryKey: ["invoice_detail", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, party:invoice_parties(*), items:invoice_items(*)")
        .eq("id", invoiceId!)
        .maybeSingle();
      if (error) throw error;
      return data as Invoice | null;
    },
    enabled: !!invoiceId,
  });
}

/** Calculate line-item totals given items and supply type */
export function calcInvoiceTotals(items: InvoiceItem[], supplyType: "intrastate" | "interstate") {
  let subtotal = 0, totalDiscount = 0, taxableAmount = 0;
  let totalCgst = 0, totalSgst = 0, totalIgst = 0;

  const computed = items.map((item, i) => {
    const lineTotal = item.quantity * item.rate;
    const discAmt = lineTotal * (item.discount_pct / 100);
    const taxable = lineTotal - discAmt;
    const gstRate = item.gst_rate;
    let cgst = 0, sgst = 0, igst = 0;
    if (supplyType === "intrastate") {
      cgst = taxable * (gstRate / 2 / 100);
      sgst = cgst;
    } else {
      igst = taxable * (gstRate / 100);
    }
    const total = taxable + cgst + sgst + igst;
    subtotal += lineTotal;
    totalDiscount += discAmt;
    taxableAmount += taxable;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;
    return {
      ...item,
      sort_order: i,
      taxable_amount: parseFloat(taxable.toFixed(2)),
      cgst_rate: supplyType === "intrastate" ? gstRate / 2 : 0,
      sgst_rate: supplyType === "intrastate" ? gstRate / 2 : 0,
      igst_rate: supplyType === "interstate" ? gstRate : 0,
      cgst_amount: parseFloat(cgst.toFixed(2)),
      sgst_amount: parseFloat(sgst.toFixed(2)),
      igst_amount: parseFloat(igst.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
    };
  });

  const totalTax = totalCgst + totalSgst + totalIgst;
  const rawGrand = taxableAmount + totalTax;
  const roundOff = parseFloat((Math.round(rawGrand) - rawGrand).toFixed(2));
  const grandTotal = rawGrand + roundOff;

  return {
    items: computed,
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalDiscount: parseFloat(totalDiscount.toFixed(2)),
    taxableAmount: parseFloat(taxableAmount.toFixed(2)),
    totalCgst: parseFloat(totalCgst.toFixed(2)),
    totalSgst: parseFloat(totalSgst.toFixed(2)),
    totalIgst: parseFloat(totalIgst.toFixed(2)),
    totalTax: parseFloat(totalTax.toFixed(2)),
    roundOff,
    grandTotal: parseFloat(grandTotal.toFixed(2)),
  };
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      restaurantId, partyId, type, supplyType, invoiceDate, dueDate,
      placeOfSupply, items, notes, terms,
    }: {
      restaurantId: string;
      partyId: string | null;
      type: string;
      supplyType: "intrastate" | "interstate";
      invoiceDate: string;
      dueDate: string | null;
      placeOfSupply: string;
      items: InvoiceItem[];
      notes: string;
      terms: string;
    }) => {
      // Generate invoice number
      const prefix = type === "sales" ? "INV" : type === "purchase" ? "PO" : type === "credit_note" ? "CN" : type === "debit_note" ? "DN" : "QT";
      const invoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`;
      const totals = calcInvoiceTotals(items, supplyType);

      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          restaurant_id: restaurantId,
          party_id: partyId || null,
          invoice_number: invoiceNumber,
          type,
          status: "draft",
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          supply_type: supplyType,
          place_of_supply: placeOfSupply || null,
          subtotal: totals.subtotal,
          total_discount: totals.totalDiscount,
          taxable_amount: totals.taxableAmount,
          total_cgst: totals.totalCgst,
          total_sgst: totals.totalSgst,
          total_igst: totals.totalIgst,
          total_tax: totals.totalTax,
          round_off: totals.roundOff,
          grand_total: totals.grandTotal,
          amount_paid: 0,
          amount_due: totals.grandTotal,
          notes: notes || null,
          terms: terms || null,
        })
        .select("id")
        .single();
      if (invErr) throw invErr;

      // Insert items
      if (totals.items.length > 0) {
        const { error: itemErr } = await supabase.from("invoice_items").insert(
          totals.items.map((item) => ({ ...item, invoice_id: inv.id, id: undefined }))
        );
        if (itemErr) throw itemErr;
      }

      return { restaurantId, invoiceId: inv.id };
    },
    onSuccess: ({ restaurantId }) => qc.invalidateQueries({ queryKey: ["invoices", restaurantId] }),
  });
}

export function useUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restaurantId, status }: { id: string; restaurantId: string; status: string }) => {
      const { error } = await supabase.from("invoices").update({ status }).eq("id", id);
      if (error) throw error;
      return restaurantId;
    },
    onSuccess: (rid) => qc.invalidateQueries({ queryKey: ["invoices", rid] }),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      invoiceId, restaurantId, amount, method, reference, grandTotal, currentPaid,
    }: {
      invoiceId: string; restaurantId: string; amount: number;
      method: string; reference: string; grandTotal: number; currentPaid: number;
    }) => {
      const { error: payErr } = await supabase.from("invoice_payments").insert({
        invoice_id: invoiceId, restaurant_id: restaurantId,
        amount, method, reference: reference || null, payment_date: format(new Date(), "yyyy-MM-dd"),
      });
      if (payErr) throw payErr;

      const newPaid = currentPaid + amount;
      const newDue = grandTotal - newPaid;
      const newStatus = newDue <= 0 ? "paid" : "partially_paid";
      await supabase.from("invoices").update({ amount_paid: newPaid, amount_due: Math.max(0, newDue), status: newStatus }).eq("id", invoiceId);
      return restaurantId;
    },
    onSuccess: (rid) => {
      qc.invalidateQueries({ queryKey: ["invoices", rid] });
      qc.invalidateQueries({ queryKey: ["invoice_detail"] });
    },
  });
}
