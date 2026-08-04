/**
 * razorpay-webhook — Processes Razorpay subscription lifecycle events.
 *
 * Required env vars:
 *   RAZORPAY_WEBHOOK_SECRET — Set in Supabase → Project Settings → Edge Functions → Secrets
 *                             (copy from Razorpay Dashboard → Webhooks → Secret)
 *   SUPABASE_URL            — Auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — Auto-injected
 *
 * Events handled:
 *   subscription.activated  → status = 'active', set activated_at
 *   subscription.charged    → save razorpay_payment_id, update next_billing_at
 *   subscription.halted     → status = 'halted'
 *   subscription.cancelled  → status = 'cancelled'
 *   subscription.completed  → status = 'expired'
 *
 * Register this URL in Razorpay Dashboard → Webhooks:
 *   https://<project>.supabase.co/functions/v1/razorpay-webhook
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET            = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// ── HMAC-SHA256 signature verification ───────────────────────────────────────

async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // Skip verification in dev if secret not set
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    return expected === signature;
  } catch {
    return false;
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const rawBody  = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  const valid = await verifySignature(rawBody, signature);
  if (!valid) {
    console.error("Razorpay webhook: invalid signature");
    return json({ error: "Invalid signature" }, 400);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const eventName  = event?.event as string;         // e.g. "subscription.activated"
  const payload    = event?.payload;
  const sub        = payload?.subscription?.entity;
  const payment    = payload?.payment?.entity;

  if (!sub?.id) {
    // Not a subscription event we care about — acknowledge and exit
    return json({ received: true });
  }

  const razorpay_subscription_id: string = sub.id;
  const now = new Date().toISOString();

  // ── Look up our subscription_payments row ─────────────────────────────────
  const { data: sp, error: spErr } = await supabase
    .from("subscription_payments")
    .select("id, restaurant_id, status")
    .eq("razorpay_subscription_id", razorpay_subscription_id)
    .maybeSingle();

  if (spErr || !sp) {
    console.warn("razorpay-webhook: subscription not found:", razorpay_subscription_id);
    return json({ received: true }); // Ack anyway to avoid retries
  }

  const restaurantId = sp.restaurant_id;

  // ── Handle each event type ────────────────────────────────────────────────

  if (eventName === "subscription.activated") {
    // Payment mandate registered — subscription is live
    await supabase
      .from("subscription_payments")
      .update({ status: "active", activated_at: now, updated_at: now })
      .eq("id", sp.id);

    // Mark the restaurant as active subscriber
    await supabase
      .from("restaurants")
      .update({ subscription_status: "active" } as any)
      .eq("id", restaurantId);

    console.log(`[activated] restaurant=${restaurantId}`);
  }

  else if (eventName === "subscription.charged") {
    // A billing cycle was charged — update payment ref + next billing date
    const nextBillingAt = sub.current_end
      ? new Date(sub.current_end * 1000).toISOString()
      : null;

    const updates: any = { status: "active", updated_at: now };
    if (payment?.id)       updates.razorpay_payment_id = payment.id;
    if (nextBillingAt)     updates.next_billing_at     = nextBillingAt;
    if (!sp.status || sp.status !== "active") updates.activated_at = now;

    await supabase
      .from("subscription_payments")
      .update(updates)
      .eq("id", sp.id);

    console.log(`[charged] restaurant=${restaurantId} payment=${payment?.id}`);
  }

  else if (eventName === "subscription.halted") {
    // Mandate expired or payment failed repeatedly
    await supabase
      .from("subscription_payments")
      .update({ status: "halted", updated_at: now })
      .eq("id", sp.id);

    console.log(`[halted] restaurant=${restaurantId}`);
  }

  else if (eventName === "subscription.cancelled") {
    await supabase
      .from("subscription_payments")
      .update({ status: "cancelled", updated_at: now })
      .eq("id", sp.id);

    console.log(`[cancelled] restaurant=${restaurantId}`);
  }

  else if (eventName === "subscription.completed") {
    // All billing cycles exhausted
    await supabase
      .from("subscription_payments")
      .update({ status: "expired", updated_at: now })
      .eq("id", sp.id);

    console.log(`[completed/expired] restaurant=${restaurantId}`);
  }

  else {
    console.log(`[unhandled event] ${eventName}`);
  }

  return json({ received: true });
});
