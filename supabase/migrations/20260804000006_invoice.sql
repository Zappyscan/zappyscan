-- ============================================================
-- ZAPPY INVOICE MODULE
-- GST-compliant invoicing, purchase orders, party management
-- ============================================================

-- 1. Parties (clients / vendors / suppliers)
CREATE TABLE IF NOT EXISTS public.invoice_parties (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'client' CHECK (type IN ('client','vendor','both')),
  gstin         TEXT,
  pan           TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  city          TEXT,
  state         TEXT,
  pincode       TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Invoices / Purchase Orders / Credit & Debit Notes
CREATE TABLE IF NOT EXISTS public.invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  party_id       UUID REFERENCES public.invoice_parties(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'sales'
                   CHECK (type IN ('sales','purchase','credit_note','debit_note','proforma','quotation')),
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','sent','paid','partially_paid','overdue','cancelled')),
  invoice_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date       DATE,
  supply_type    TEXT NOT NULL DEFAULT 'intrastate' CHECK (supply_type IN ('intrastate','interstate')),
  place_of_supply TEXT,
  subtotal       NUMERIC NOT NULL DEFAULT 0,
  total_discount NUMERIC NOT NULL DEFAULT 0,
  taxable_amount NUMERIC NOT NULL DEFAULT 0,
  total_cgst     NUMERIC NOT NULL DEFAULT 0,
  total_sgst     NUMERIC NOT NULL DEFAULT 0,
  total_igst     NUMERIC NOT NULL DEFAULT 0,
  total_tax      NUMERIC NOT NULL DEFAULT 0,
  round_off      NUMERIC NOT NULL DEFAULT 0,
  grand_total    NUMERIC NOT NULL DEFAULT 0,
  amount_paid    NUMERIC NOT NULL DEFAULT 0,
  amount_due     NUMERIC NOT NULL DEFAULT 0,
  notes          TEXT,
  terms          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (restaurant_id, invoice_number)
);

-- 3. Invoice line items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  hsn_sac         TEXT,
  quantity        NUMERIC NOT NULL DEFAULT 1,
  unit            TEXT DEFAULT 'pcs',
  rate            NUMERIC NOT NULL DEFAULT 0,
  discount_pct    NUMERIC NOT NULL DEFAULT 0,
  taxable_amount  NUMERIC NOT NULL DEFAULT 0,
  gst_rate        NUMERIC NOT NULL DEFAULT 18,   -- 0, 5, 12, 18, 28
  cgst_rate       NUMERIC NOT NULL DEFAULT 9,
  sgst_rate       NUMERIC NOT NULL DEFAULT 9,
  igst_rate       NUMERIC NOT NULL DEFAULT 0,
  cgst_amount     NUMERIC NOT NULL DEFAULT 0,
  sgst_amount     NUMERIC NOT NULL DEFAULT 0,
  igst_amount     NUMERIC NOT NULL DEFAULT 0,
  total           NUMERIC NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Payments received against invoices
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  restaurant_id  UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  amount         NUMERIC NOT NULL CHECK (amount > 0),
  payment_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  method         TEXT DEFAULT 'cash' CHECK (method IN ('cash','upi','bank_transfer','cheque','card','other')),
  reference      TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auto-increment invoice number helper ─────────────────────
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1001;

-- ── Enable RLS ───────────────────────────────────────────────
ALTER TABLE public.invoice_parties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments  ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies ─────────────────────────────────────────────
CREATE POLICY "invoice_parties_access" ON public.invoice_parties
  FOR ALL USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "invoices_access" ON public.invoices
  FOR ALL USING (restaurant_id = get_user_restaurant_id(auth.uid()));

CREATE POLICY "invoice_items_access" ON public.invoice_items
  FOR ALL USING (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE restaurant_id = get_user_restaurant_id(auth.uid())
    )
  );

CREATE POLICY "invoice_payments_access" ON public.invoice_payments
  FOR ALL USING (restaurant_id = get_user_restaurant_id(auth.uid()));

-- ── updated_at triggers ───────────────────────────────────────
CREATE TRIGGER set_updated_at_invoice_parties
  BEFORE UPDATE ON public.invoice_parties
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_invoices
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
