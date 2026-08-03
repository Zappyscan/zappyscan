/**
 * razorpay-subscription — Create / manage Razorpay subscription plans & subscriptions
 *
 * Actions:
 *   create_subscription — Create a Razorpay plan (if needed) + subscription, return payment_link
 *   cancel_subscription — Cancel an existing Razorpay subscription
 *   get_status          — Fetch current status of a subscription from Razorpay
 *
 * Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
 *   RAZORPAY_KEY_ID      — Your Razorpay API Key ID
 *   RAZORPAY_KEY_SECRET  — Your Razorpay API Key Secret
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const SUPABASE_URL             = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RAZORPAY_KEY_ID          = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const RAZORPAY_KEY_SECRET      = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── Pricing table (INR, in paise for Razorpay) ───────────────────────────────
// Amount is in paise (1 INR = 100 paise)
const PRICING: Record<string, Record<string, number>> = {
  pro: {
    monthly: 199900,   // ₹1,999/month
    annual:  1999900,  // ₹19,999/year
  },
  enterprise: {
    monthly: 499900,   // ₹4,999/month
    annual:  4999900,  // ₹49,999/year
  },
};

// Display amounts in INR
const PRICING_INR: Record<string, Record<string, number>> = {
  pro:        { monthly: 1999,  annual: 19999 },
  enterprise: { monthly: 4999,  annual: 49999 },
};

// ── Razorpay API helper ───────────────────────────────────────────────────────

async function rzpRequest(path: string, method: string, body?: object) {
  const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || `Razorpay error: ${res.status}`);
  return data;
}

// ── Create or fetch a Razorpay plan ──────────────────────────────────────────

async function ensurePlan(tier: string, cycle: string, supabase: any): Promise<string> {
  const planKey = `${tier}_${cycle}`;
  const amount  = PRICING[tier]?.[cycle];
  if (!amount) throw new Error(`Unknown tier/cycle: ${tier}/${cycle}`);

  // Check if we've cached the plan_id in subscription_payments metadata
  // Use a dedicated config approach: try fetching a known plan from Razorpay
  // by listing and matching notes.plan_key
  const list = await rzpRequest(`/plans?count=50`, "GET");
  const existing = (list.items || []).find(
    (p: any) => p.notes?.plan_key === planKey
  );
  if (existing) return existing.id;

  // Create new plan
  const periodMap: Record<string, string> = { monthly: "monthly", annual: "yearly" };
  const plan = await rzpRequest("/plans", "POST", {
    period:   periodMap[cycle],
    interval: 1,
    item: {
      name:        `Zappy ${tier.charAt(0).toUpperCase() + tier.slice(1)} — ${cycle.charAt(0).toUpperCase() + cycle.slice(1)}`,
      amount,
      currency:    "INR",
      description: `Zappy Restaurant OS — ${tier} plan, billed ${cycle}`,
    },
    notes: { plan_key: planKey },
  });
  return plan.id;
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return json({ error: "Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Edge Function secrets." }, 500);
  }

  // ── create_subscription ──────────────────────────────────────────────────
  if (action === "create_subscription") {
    const {
      restaurant_id,
      tier = "pro",
      billing_cycle = "monthly",
      autopay_enabled = true,
      payment_method = "upi",
      upi_id,
      billing_name,
      billing_email,
      gst_number,
      hotel_name,
    } = body;

    if (!restaurant_id) return json({ error: "restaurant_id required" }, 400);
    if (!PRICING[tier])  return json({ error: `Unsupported tier: ${tier}` }, 400);

    try {
      // 1. Get or create the Razorpay plan
      const planId = await ensurePlan(tier, billing_cycle, supabase);

      // 2. Total count: monthly = 12 cycles before needing renewal, annual = 1
      const totalCount = billing_cycle === "annual" ? 1 : 12;

      // 3. Build subscription payload
      const subPayload: any = {
        plan_id:         planId,
        total_count:     totalCount,
        quantity:        1,
        customer_notify: 1,
        notes: {
          restaurant_id,
          hotel_name:    hotel_name || "",
          tier,
          billing_cycle,
          autopay:       String(autopay_enabled),
        },
      };

      // UPI Autopay — request e-mandate
      if (autopay_enabled && payment_method === "upi" && upi_id) {
        subPayload.payment_method = {
          emandate: {
            auth_type: "netbanking",  // Razorpay routes to UPI autopay for UPI VPA
          },
        };
      }

      // 4. Create subscription
      const sub = await rzpRequest("/subscriptions", "POST", subPayload);
      const paymentLink = sub.short_url;

      // 5. Persist in subscription_payments table
      const amountInr = (PRICING_INR[tier]?.[billing_cycle] ?? 0);
      const { error: dbErr } = await supabase.from("subscription_payments").upsert({
        restaurant_id,
        razorpay_subscription_id: sub.id,
        razorpay_plan_id:         planId,
        billing_cycle,
        tier,
        amount:           amountInr,
        autopay_enabled,
        payment_method,
        upi_id:           upi_id || null,
        billing_name:     billing_name || null,
        billing_email:    billing_email || null,
        gst_number:       gst_number || null,
        status:           "pending",
        payment_link:     paymentLink,
      }, { onConflict: "restaurant_id" });

      if (dbErr) console.error("DB insert error:", dbErr);

      // 6. Also update restaurant's subscription_tier
      await supabase.from("restaurants").update({
        subscription_tier: tier,
        subscription_ends_at: billing_cycle === "annual"
          ? new Date(Date.now() + 365 * 86400 * 1000).toISOString()
          : new Date(Date.now() + 30  * 86400 * 1000).toISOString(),
      }).eq("id", restaurant_id);

      return json({
        subscription_id: sub.id,
        payment_link:    paymentLink,
        plan_id:         planId,
        status:          sub.status,
        amount:          amountInr,
        currency:        "INR",
        billing_cycle,
        tier,
      });

    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
  }

  // ── cancel_subscription ──────────────────────────────────────────────────
  if (action === "cancel_subscription") {
    const { restaurant_id, cancel_at_cycle_end = true } = body;
    if (!restaurant_id) return json({ error: "restaurant_id required" }, 400);

    const { data: sp } = await supabase
      .from("subscription_payments")
      .select("razorpay_subscription_id")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (!sp?.razorpay_subscription_id) return json({ error: "No active subscription found" }, 404);

    try {
      await rzpRequest(
        `/subscriptions/${sp.razorpay_subscription_id}/cancel`,
        "POST",
        { cancel_at_cycle_end }
      );
      await supabase.from("subscription_payments")
        .update({ status: "cancelled" })
        .eq("restaurant_id", restaurant_id);

      return json({ success: true, message: "Subscription cancelled" });
    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
  }

  // ── get_status ───────────────────────────────────────────────────────────
  if (action === "get_status") {
    const { restaurant_id } = body;
    if (!restaurant_id) return json({ error: "restaurant_id required" }, 400);

    const { data: sp } = await supabase
      .from("subscription_payments")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (!sp?.razorpay_subscription_id) return json({ status: "none", data: sp });

    try {
      const rzpSub = await rzpRequest(`/subscriptions/${sp.razorpay_subscription_id}`, "GET");

      // Sync status back
      if (rzpSub.status === "active" && sp.status !== "active") {
        await supabase.from("subscription_payments")
          .update({ status: "active", activated_at: new Date().toISOString() })
          .eq("restaurant_id", restaurant_id);
      }

      return json({ status: rzpSub.status, razorpay: rzpSub, local: sp });
    } catch (err: any) {
      return json({ error: err.message }, 500);
    }
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
