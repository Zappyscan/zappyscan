/**
 * platform-menu-sync — Push Zappy menu to delivery platforms
 *
 * Actions:
 *   sync_menu       — Upload full menu (categories + items) to a platform
 *   toggle_item     — Mark a single item available/unavailable on a platform
 *   get_menu        — Fetch platform's current menu (to compare)
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

// ── Token helpers (reuse same logic as order-action) ─────────────────────────

async function getZomatoToken(apiKey: string, apiSecret: string): Promise<string> {
  const res = await fetch("https://api.zomato.com/partner/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: apiKey, client_secret: apiSecret }),
  });
  if (!res.ok) throw new Error(`Zomato token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function getUberToken(clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://login.uber.com/oauth/v2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: "eats.store eats.store.menu.write" }),
  });
  if (!res.ok) throw new Error(`Uber Eats token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

// ── Menu formatters ───────────────────────────────────────────────────────────

function buildZomatoMenu(categories: any[], items: any[], overrides: Record<string, boolean>) {
  return {
    menu_categories: categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      display_order: cat.display_order || 0,
      menu_items: items
        .filter(i => i.category_id === cat.id)
        .map(i => ({
          id: i.id,
          name: i.name,
          description: i.description || "",
          price: Math.round((i.price || 0) * 100), // paise
          is_available: overrides[i.id] !== false,
          food_type: i.is_vegetarian ? "VEG" : "NON_VEG",
          image_url: i.image_url || null,
        })),
    })),
  };
}

function buildSwiggyMenu(categories: any[], items: any[], overrides: Record<string, boolean>) {
  return {
    categories: categories.map(cat => ({
      external_id: cat.id,
      name: cat.name,
      items: items
        .filter(i => i.category_id === cat.id)
        .map(i => ({
          external_id: i.id,
          name: i.name,
          description: i.description || "",
          price: i.price || 0,
          in_stock: overrides[i.id] !== false,
          veg: i.is_vegetarian ?? true,
          image_url: i.image_url || null,
        })),
    })),
  };
}

function buildUberEatsMenu(categories: any[], items: any[], overrides: Record<string, boolean>) {
  return {
    menus: [{
      id: "main_menu",
      title: { translations: { en: "Menu" } },
      service_availability: [{ time_periods: [{ start_time: "00:00", end_time: "23:59", day_of_week: ["mon","tue","wed","thu","fri","sat","sun"] }] }],
      category_ids: categories.map(c => c.id),
    }],
    categories: categories.map(cat => ({
      id: cat.id,
      title: { translations: { en: cat.name } },
      entities: items.filter(i => i.category_id === cat.id).map(i => ({ id: i.id, type: "ITEM" })),
    })),
    items: items.map(i => ({
      id: i.id,
      external_data: i.id,
      title: { translations: { en: i.name } },
      description: { translations: { en: i.description || "" } },
      price_info: { price: Math.round((i.price || 0) * 100) }, // cents
      quantity_info: { quantity: { min_permitted: 1, max_permitted: 100 } },
      suspension_info: overrides[i.id] === false
        ? { suspension: { suspend: true, reason: "UNAVAILABLE" } }
        : null,
    })),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const { restaurant_id, platform, action, item_id, is_available } = body;

  if (!restaurant_id || !platform || !action) {
    return json({ error: "Missing required: restaurant_id, platform, action" }, 400);
  }

  // Load settings
  const { data: settings } = await supabase
    .from("platform_api_settings")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("platform", platform)
    .maybeSingle();

  if (!settings?.api_key) return json({ error: "Platform not configured" }, 400);

  // ── toggle_item: mark single item available/unavailable ─────────────────
  if (action === "toggle_item") {
    await supabase.from("platform_item_overrides").upsert({
      restaurant_id, menu_item_id: item_id, platform, is_available,
    }, { onConflict: "restaurant_id,menu_item_id,platform" });

    let platformRes: Response | undefined;
    let success = false;

    try {
      if (platform === "zomato") {
        const token = await getZomatoToken(settings.api_key, settings.api_secret);
        platformRes = await fetch(`https://api.zomato.com/partner/v2/menu/items/${item_id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ is_available }),
        });
      } else if (platform === "swiggy") {
        platformRes = await fetch(`https://api.partner.swiggy.com/merchant/v1/menu/item/${item_id}/availability`, {
          method: "PATCH",
          headers: { "X-API-Key": settings.api_key, "X-API-Secret": settings.api_secret, "Content-Type": "application/json" },
          body: JSON.stringify({ in_stock: is_available }),
        });
      } else if (platform === "uber_eats") {
        const token = await getUberToken(settings.api_key, settings.api_secret);
        platformRes = await fetch(`https://api.uber.com/v1/eats/stores/${settings.restaurant_ref}/menus/items/${item_id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            suspension_info: is_available
              ? { suspension: { suspend: false } }
              : { suspension: { suspend: true, reason: "UNAVAILABLE" } },
          }),
        });
      } else {
        success = true; // local only for unsupported platforms
      }
      success = platformRes?.ok ?? success;
    } catch (e: any) {
      return json({ success: false, error: e.message });
    }

    return json({ success, item_id, platform, is_available });
  }

  // ── sync_menu: push full menu ─────────────────────────────────────────────
  if (action === "sync_menu") {
    // Load Zappy menu
    const [{ data: categories }, { data: items }, { data: overrideRows }] = await Promise.all([
      supabase.from("categories").select("*").eq("restaurant_id", restaurant_id).order("display_order"),
      supabase.from("menu_items").select("*").eq("restaurant_id", restaurant_id).eq("is_available", true),
      supabase.from("platform_item_overrides").select("menu_item_id, is_available").eq("restaurant_id", restaurant_id).eq("platform", platform),
    ]);

    const overrides: Record<string, boolean> = {};
    for (const row of overrideRows || []) overrides[row.menu_item_id] = row.is_available;

    let menuPayload: any;
    let endpoint: string;
    let headers: Record<string, string>;
    let success = false;
    let errorMessage: string | null = null;

    try {
      if (platform === "zomato") {
        const token = await getZomatoToken(settings.api_key, settings.api_secret);
        menuPayload = buildZomatoMenu(categories || [], items || [], overrides);
        endpoint = `https://api.zomato.com/partner/v2/menu`;
        headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      } else if (platform === "swiggy") {
        menuPayload = buildSwiggyMenu(categories || [], items || [], overrides);
        endpoint = `https://api.partner.swiggy.com/merchant/v1/menu`;
        headers = { "X-API-Key": settings.api_key, "X-API-Secret": settings.api_secret, "Content-Type": "application/json" };
      } else if (platform === "uber_eats") {
        const token = await getUberToken(settings.api_key, settings.api_secret);
        menuPayload = buildUberEatsMenu(categories || [], items || [], overrides);
        endpoint = `https://api.uber.com/v2/eats/stores/${settings.restaurant_ref}/menus`;
        headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
      } else {
        return json({ success: true, message: "No API for this platform" });
      }

      const res = await fetch(endpoint, { method: "PUT", headers, body: JSON.stringify(menuPayload) });
      success = res.ok;
      if (!success) errorMessage = `HTTP ${res.status}: ${await res.text()}`;
    } catch (e: any) {
      errorMessage = e.message;
    }

    // Log sync
    await supabase.from("platform_menu_sync_log").insert({
      restaurant_id, platform,
      items_synced: (items || []).length,
      success,
      error_message: errorMessage,
    });

    return json({ success, platform, items_synced: (items || []).length, error: errorMessage });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
