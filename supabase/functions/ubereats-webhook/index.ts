/**
 * Uber Eats Orders API — Order Webhook Receiver
 *
 * How to connect:
 * 1. Go to https://developer.uber.com/docs/eats/introduction
 * 2. Create an app and get client_id + client_secret
 * 3. Register your store on Uber Eats and get your store_id
 * 4. Enter credentials in Zappy → Online Orders → Integrations → Uber Eats
 * 5. Copy the webhook URL and register it at developer.uber.com → Webhooks
 *
 * Uber Eats signs webhooks with:
 *   X-Uber-Signature: HMAC-SHA256(rawBody, clientSecret)
 *
 * Uber Eats Webhook event types: orders.notification, orders.scheduled.notification
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-uber-signature",
};

async function verifyUberSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
    return expected === signature.toLowerCase();
  } catch { return false; }
}

function parseUberEatsOrder(payload: any, restaurantId: string) {
  // Uber Eats webhook payload structure
  const order = payload.order || payload.data?.order || payload;
  const items = (order.cart?.items || order.items || [])
    .map((i: any) => {
      const qty = i.quantity || i.selected_item_count || 1;
      const name = i.title || i.name;
      return `${qty}x ${name}`;
    })
    .join(", ");

  const subtotal = parseFloat(
    order.payment?.subtotal?.amount ||
    order.cart?.checkout_price?.unit_price?.amount ||
    order.price || "0"
  ) / 100; // Uber Eats uses cents

  const commission = parseFloat(order.payment?.service_fee?.amount || "0") / 100;

  return {
    restaurant_id: restaurantId,
    platform: "uber_eats",
    platform_order_id: order.id || order.display_id || "",
    customer_name: order.eater?.first_name
      ? `${order.eater.first_name} ${order.eater.last_name || ""}`.trim()
      : null,
    customer_phone: order.eater?.phone || null,
    delivery_address: order.delivery?.location?.address?.street_address
      ? `${order.delivery.location.address.street_address}, ${order.delivery.location.address.city || ""}`
      : null,
    items_summary: items || "See Uber Eats Partner Portal",
    subtotal,
    platform_commission: commission,
    payment_method: "online", // Uber Eats is always prepaid
    notes: order.special_instructions || order.eater?.special_instructions || null,
    status: "received",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-uber-signature") || "";
  const restaurantId = new URL(req.url).searchParams.get("restaurant_id");

  if (!restaurantId) {
    return new Response(JSON.stringify({ error: "Missing restaurant_id" }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: settings } = await supabase
    .from("platform_api_settings")
    .select("api_secret, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("platform", "uber_eats")
    .maybeSingle();

  if (!settings?.is_active) {
    return new Response(JSON.stringify({ error: "Uber Eats integration not active" }), {
      status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (settings.api_secret && signature) {
    const valid = await verifyUberSignature(rawBody, signature, settings.api_secret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }); }

  // Handle webhook verification challenge (Uber Eats sends a challenge to verify the endpoint)
  if (payload.challenge) {
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Only process order events
  const eventType = payload.event_type || payload.type || "";
  if (!eventType.includes("order")) {
    return new Response(JSON.stringify({ message: "Event ignored" }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  const { error } = await supabase.from("online_orders").insert(parseUberEatsOrder(payload, restaurantId));
  if (error) {
    console.error("Uber Eats webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  await supabase.from("platform_api_settings")
    .update({ last_order_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId).eq("platform", "uber_eats");

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
});
