/**
 * Zomato Partner API — Order Webhook Receiver
 *
 * How to connect:
 * 1. Register at https://www.zomato.com/partner
 * 2. Get your client_id, client_secret, and restaurant_id from Zomato Partner Portal
 * 3. Enter those credentials in Zappy → Online Orders → Integrations → Zomato
 * 4. Copy the webhook URL from Zappy and paste it in Zomato Partner Portal → Webhook Settings
 * 5. Orders placed on Zomato will auto-appear in your Zappy Online Orders tab
 *
 * Zomato signs each webhook POST with:
 *   X-Zomato-Signature: HMAC-SHA256(rawBody, webhookSecret)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-zomato-signature, x-restaurant-id",
};

// ── HMAC-SHA256 verification ──────────────────────────────────────────────────
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const expected = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    // Constant-time comparison
    return expected === signature.toLowerCase();
  } catch {
    return false;
  }
}

// ── Parse Zomato order payload → our schema ───────────────────────────────────
function parseZomatoOrder(payload: any, restaurantId: string) {
  const order = payload.order || payload;
  const items = (order.order_items || order.items || [])
    .map((i: any) => `${i.quantity || 1}x ${i.name || i.item_name}`)
    .join(", ");

  return {
    restaurant_id: restaurantId,
    platform: "zomato",
    platform_order_id: String(order.order_id || order.id || ""),
    customer_name: order.customer?.name || order.delivery_details?.name || null,
    customer_phone: order.customer?.phone || order.delivery_details?.phone || null,
    delivery_address: order.delivery_address?.address_line1
      ? `${order.delivery_address.address_line1}, ${order.delivery_address.city || ""}`
      : null,
    items_summary: items || JSON.stringify(order.order_items || order.items || []),
    subtotal: parseFloat(order.total_amount || order.order_total || "0"),
    platform_commission: parseFloat(order.commission || order.platform_fee || "0"),
    payment_method: order.payment?.mode === "COD" ? "cod" : "online",
    notes: order.special_instructions || order.notes || null,
    status: "received",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("x-zomato-signature") || "";
  const restaurantId = req.headers.get("x-restaurant-id")
    || new URL(req.url).searchParams.get("restaurant_id");

  if (!restaurantId) {
    return new Response(JSON.stringify({ error: "Missing restaurant_id" }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Load the stored webhook secret for this restaurant
  const { data: settings } = await supabase
    .from("platform_api_settings")
    .select("webhook_secret, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("platform", "zomato")
    .maybeSingle();

  if (!settings?.is_active) {
    return new Response(JSON.stringify({ error: "Zomato integration not active for this restaurant" }), {
      status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Verify signature if a secret is configured
  if (settings.webhook_secret && signature) {
    const valid = await verifySignature(rawBody, signature, settings.webhook_secret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const orderData = parseZomatoOrder(payload, restaurantId);

  // Insert order
  const { error: insertError } = await supabase
    .from("online_orders")
    .insert(orderData);

  if (insertError) {
    console.error("Zomato webhook insert error:", insertError);
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Update stats
  await supabase
    .from("platform_api_settings")
    .update({ last_order_at: new Date().toISOString(), orders_received: (settings as any).orders_received + 1 })
    .eq("restaurant_id", restaurantId)
    .eq("platform", "zomato");

  return new Response(JSON.stringify({ success: true, message: "Order received" }), {
    status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
