/**
 * Swiggy Restaurant Partner API — Order Webhook Receiver
 *
 * How to connect:
 * 1. Register at https://partner.swiggy.com
 * 2. Get your merchant_id and secret_key from Swiggy Partner Portal
 * 3. Enter those in Zappy → Online Orders → Integrations → Swiggy
 * 4. Copy the webhook URL from Zappy and paste it in Swiggy Partner Portal → Integrations
 * 5. Swiggy will POST new orders to this URL automatically
 *
 * Swiggy signs webhooks with:
 *   X-Swiggy-Signature: HMAC-SHA256(merchantId + ":" + rawBody, secretKey)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-swiggy-signature, x-merchant-id",
};

async function verifySwiggySignature(body: string, merchantId: string, signature: string, secret: string): Promise<boolean> {
  try {
    const message = `${merchantId}:${body}`;
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return expected === signature;
  } catch { return false; }
}

function parseSwiggyOrder(payload: any, restaurantId: string) {
  const ord = payload.order || payload;
  const items = (ord.items || ord.cart_items || [])
    .map((i: any) => `${i.quantity || i.qty || 1}x ${i.name || i.item_name}`)
    .join(", ");

  return {
    restaurant_id: restaurantId,
    platform: "swiggy",
    platform_order_id: String(ord.order_id || ord.swiggy_order_id || ""),
    customer_name: ord.customer_name || ord.user?.name || null,
    customer_phone: ord.customer_phone || ord.user?.phone || null,
    delivery_address: ord.delivery_address?.full_address || ord.delivery_address || null,
    items_summary: items || "See Swiggy Partner Portal",
    subtotal: parseFloat(ord.order_total || ord.total || "0"),
    platform_commission: parseFloat(ord.commission || ord.swiggy_charges || "0"),
    payment_method: (ord.payment_method || "").toLowerCase().includes("cod") ? "cod" : "online",
    notes: ord.special_instructions || ord.delivery_instructions || null,
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
  const signature = req.headers.get("x-swiggy-signature") || "";
  const restaurantId = req.headers.get("x-restaurant-id")
    || new URL(req.url).searchParams.get("restaurant_id");

  if (!restaurantId) {
    return new Response(JSON.stringify({ error: "Missing restaurant_id" }), {
      status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: settings } = await supabase
    .from("platform_api_settings")
    .select("api_key, webhook_secret, is_active")
    .eq("restaurant_id", restaurantId)
    .eq("platform", "swiggy")
    .maybeSingle();

  if (!settings?.is_active) {
    return new Response(JSON.stringify({ error: "Swiggy integration not active" }), {
      status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (settings.webhook_secret && settings.api_key && signature) {
    const valid = await verifySwiggySignature(rawBody, settings.api_key, signature, settings.webhook_secret);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }); }

  const { error } = await supabase.from("online_orders").insert(parseSwiggyOrder(payload, restaurantId));
  if (error) {
    console.error("Swiggy webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
  }

  await supabase.from("platform_api_settings")
    .update({ last_order_at: new Date().toISOString() })
    .eq("restaurant_id", restaurantId).eq("platform", "swiggy");

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
});
