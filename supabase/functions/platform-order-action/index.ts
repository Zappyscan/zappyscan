/**
 * platform-order-action — Bidirectional order management
 *
 * Handles: accept, reject, status_update, cancel
 * for Zomato, Swiggy, Uber Eats, Dunzo
 *
 * Called from the Zappy admin panel when staff tap Accept/Reject/Update buttons.
 * Makes the actual REST call to the delivery platform's API, then logs the result.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ── OAuth token helpers ───────────────────────────────────────────────────────

/** Get/refresh a cached OAuth2 bearer token for Zomato */
async function getZomatoToken(apiKey: string, apiSecret: string, cachedToken?: any): Promise<string> {
  if (cachedToken?.access_token && cachedToken.expires_at > Date.now() + 60_000) {
    return cachedToken.access_token;
  }
  const res = await fetch("https://api.zomato.com/partner/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: apiKey,
      client_secret: apiSecret,
    }),
  });
  if (!res.ok) throw new Error(`Zomato token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

/** Swiggy uses static API key — no token exchange needed */
function getSwiggyHeaders(apiKey: string, apiSecret: string) {
  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
    "X-API-Secret": apiSecret,
  };
}

/** Uber Eats OAuth2 token */
async function getUberToken(clientId: string, clientSecret: string, cachedToken?: any): Promise<string> {
  if (cachedToken?.access_token && cachedToken.expires_at > Date.now() + 60_000) {
    return cachedToken.access_token;
  }
  const res = await fetch("https://login.uber.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "eats.order",
    }),
  });
  if (!res.ok) throw new Error(`Uber Eats token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// ── Platform-specific action callers ─────────────────────────────────────────

type ActionPayload = {
  action: "accept" | "reject" | "status_update" | "cancel";
  platform_order_id: string;
  prep_time?: number;
  reject_reason?: string;
  new_status?: string;
  restaurant_ref?: string;
};

async function callZomato(settings: any, payload: ActionPayload) {
  const token = await getZomatoToken(settings.api_key, settings.api_secret, settings.extra_config?.token);
  const base = "https://api.zomato.com/partner/v2";
  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  switch (payload.action) {
    case "accept":
      return fetch(`${base}/orders/${payload.platform_order_id}/accept`, {
        method: "POST", headers,
        body: JSON.stringify({ restaurant_preparation_time: payload.prep_time || 25 }),
      });
    case "reject":
      return fetch(`${base}/orders/${payload.platform_order_id}/reject`, {
        method: "POST", headers,
        body: JSON.stringify({ reason: payload.reject_reason || "store_closed" }),
      });
    case "status_update":
      return fetch(`${base}/orders/${payload.platform_order_id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status: payload.new_status }),
      });
    case "cancel":
      return fetch(`${base}/orders/${payload.platform_order_id}/cancel`, {
        method: "POST", headers,
        body: JSON.stringify({ reason: "RESTAURANT_CANCELLED" }),
      });
  }
}

async function callSwiggy(settings: any, payload: ActionPayload) {
  const base = "https://api.partner.swiggy.com/merchant/v1";
  const headers = getSwiggyHeaders(settings.api_key, settings.api_secret);

  switch (payload.action) {
    case "accept":
      return fetch(`${base}/orders/${payload.platform_order_id}/accept`, {
        method: "POST", headers,
        body: JSON.stringify({ prep_time: payload.prep_time || 20 }),
      });
    case "reject":
      return fetch(`${base}/orders/${payload.platform_order_id}/reject`, {
        method: "POST", headers,
        body: JSON.stringify({
          reason_code: payload.reject_reason === "item_unavailable"
            ? "ITEM_NOT_AVAILABLE"
            : payload.reject_reason === "too_busy" ? "STORE_BUSY" : "STORE_CLOSED",
        }),
      });
    case "status_update":
      return fetch(`${base}/orders/${payload.platform_order_id}/status`, {
        method: "PUT", headers,
        body: JSON.stringify({ status: payload.new_status?.toUpperCase() }),
      });
    case "cancel":
      return fetch(`${base}/orders/${payload.platform_order_id}/cancel`, {
        method: "POST", headers,
        body: JSON.stringify({ reason_code: "MERCHANT_CANCELLED" }),
      });
  }
}

async function callUberEats(settings: any, payload: ActionPayload) {
  const token = await getUberToken(settings.api_key, settings.api_secret, settings.extra_config?.token);
  const base = "https://api.uber.com/v1/eats";
  const headers = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };

  switch (payload.action) {
    case "accept":
      return fetch(`${base}/orders/${payload.platform_order_id}/accept_pos_order`, {
        method: "POST", headers,
        body: JSON.stringify({ reason: "accepted" }),
      });
    case "reject":
      return fetch(`${base}/orders/${payload.platform_order_id}/deny_pos_order`, {
        method: "POST", headers,
        body: JSON.stringify({
          reason: payload.reject_reason === "item_unavailable"
            ? "ITEM_UNAVAILABLE"
            : payload.reject_reason === "too_busy" ? "STORE_CLOSED" : "STORE_CLOSED",
        }),
      });
    case "status_update":
      return fetch(`${base}/orders/${payload.platform_order_id}`, {
        method: "PATCH", headers,
        body: JSON.stringify({ status: payload.new_status }),
      });
    case "cancel":
      return fetch(`${base}/orders/${payload.platform_order_id}/cancel`, {
        method: "POST", headers,
        body: JSON.stringify({ reason: "RESTAURANT_CANCELLED" }),
      });
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const { online_order_id, restaurant_id, action, prep_time, reject_reason, new_status } = body;

  if (!online_order_id || !restaurant_id || !action) {
    return json({ error: "Missing required fields: online_order_id, restaurant_id, action" }, 400);
  }

  // Load the online order
  const { data: order } = await supabase
    .from("online_orders")
    .select("*")
    .eq("id", online_order_id)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, 404);

  // Load platform settings
  const { data: settings } = await supabase
    .from("platform_api_settings")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("platform", order.platform)
    .maybeSingle();

  if (!settings?.is_active) {
    return json({ error: `${order.platform} integration not active` }, 403);
  }

  const actionPayload: ActionPayload = {
    action,
    platform_order_id: order.platform_order_id,
    prep_time,
    reject_reason,
    new_status,
    restaurant_ref: settings.restaurant_ref,
  };

  let platformResponse: Response | undefined;
  let success = false;
  let errorMessage: string | null = null;
  let responseBody: any = null;

  try {
    switch (order.platform) {
      case "zomato":    platformResponse = await callZomato(settings, actionPayload);    break;
      case "swiggy":    platformResponse = await callSwiggy(settings, actionPayload);    break;
      case "uber_eats": platformResponse = await callUberEats(settings, actionPayload);  break;
      default:
        // For platforms without live API (dunzo, direct, other) — just update local status
        success = true;
        break;
    }

    if (platformResponse) {
      responseBody = await platformResponse.json().catch(() => ({}));
      success = platformResponse.ok;
      if (!success) errorMessage = responseBody?.message || responseBody?.error || `HTTP ${platformResponse.status}`;
    }
  } catch (err: any) {
    errorMessage = err.message;
    success = false;
  }

  // Log the action
  await supabase.from("platform_order_actions").insert({
    online_order_id,
    restaurant_id,
    platform: order.platform,
    action,
    payload: actionPayload,
    response: responseBody,
    success,
    error_message: errorMessage,
  });

  if (success) {
    // Update local order state
    const updates: Record<string, any> = {};

    if (action === "accept") {
      updates.status = "accepted";
      updates.platform_accepted = true;
      updates.prep_time_minutes = prep_time || 25;
    } else if (action === "reject") {
      updates.status = "cancelled";
      updates.platform_accepted = false;
      updates.reject_reason = reject_reason || "store_closed";
    } else if (action === "status_update" && new_status) {
      updates.status = new_status;
    } else if (action === "cancel") {
      updates.status = "cancelled";
    }

    await supabase.from("online_orders").update(updates).eq("id", online_order_id);
  }

  return json({
    success,
    action,
    platform: order.platform,
    order_id: online_order_id,
    error: errorMessage,
    platform_response: responseBody,
  });
});
