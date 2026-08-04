import type { Database } from "@/integrations/supabase/types";

type SubscriptionTier = Database["public"]["Enums"]["subscription_tier"];

export type FeatureKey =
  // ── Starter (free) ────────────────────────────────────────────────────────
  | "dashboard" | "menu" | "orders" | "kitchen" | "billing" | "settings" | "reviews"
  // ── Professional (pro) ────────────────────────────────────────────────────
  | "tables" | "qr-manager" | "waiters" | "staff" | "payroll" | "invoice" | "inventory" | "reports"
  | "users" | "preview" | "coupons" | "ads" | "offers" | "exports" | "research" | "promotions"
  // ── Growth / Enterprise ───────────────────────────────────────────────────
  | "online-orders" | "analytics" | "marketing" | "branding" | "multi-outlet";

/** Human-readable labels for sidebar display */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  // Starter
  dashboard: "Dashboard",
  menu: "Menu",
  orders: "Orders",
  kitchen: "Kitchen",
  billing: "Billing",
  settings: "Settings",
  reviews: "Customer Reviews",
  // Professional
  tables: "Tables",
  "qr-manager": "QR Manager",
  waiters: "Waiters",
  staff: "Staff",
  payroll: "Payroll",
  invoice: "Invoice",
  inventory: "Inventory",
  reports: "Reports",
  users: "Users",
  preview: "Preview Site",
  coupons: "Coupons",
  ads: "Ads",
  offers: "Offers",
  exports: "Exports",
  research: "Research",
  promotions: "Promotions",
  // Growth / Enterprise
  "online-orders": "Online Orders",
  analytics: "Analytics",
  marketing: "Marketing",
  branding: "Branding",
  "multi-outlet": "Multi-Outlet",
};

export const FEATURE_TIERS: Record<FeatureKey, SubscriptionTier> = {
  // ── Starter (free) — core POS billing features ───────────────────────────
  dashboard:       "free",
  menu:            "free",
  orders:          "free",
  kitchen:         "free",
  billing:         "free",
  settings:        "free",
  reviews:         "free",

  // ── Professional (pro) — full restaurant management ──────────────────────
  tables:          "pro",
  "qr-manager":    "pro",
  waiters:         "pro",
  staff:           "pro",
  payroll:         "pro",
  invoice:         "pro",
  inventory:       "pro",
  reports:         "pro",
  users:           "pro",
  preview:         "pro",
  coupons:         "pro",
  ads:             "pro",
  offers:          "pro",
  exports:         "pro",
  research:        "pro",
  promotions:      "pro",

  // ── Growth / Enterprise — online & multi-branch ──────────────────────────
  "online-orders": "enterprise",
  analytics:       "enterprise",
  marketing:       "enterprise",
  branding:        "enterprise",
  "multi-outlet":  "enterprise",
};

/** Features that the Super Admin can toggle per restaurant */
export const TOGGLEABLE_FEATURES: FeatureKey[] = [
  "coupons", "promotions", "inventory", "exports",
  "branding", "multi-outlet",
];

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  pro: 1,
  enterprise: 2,
};

/** Maps DB tier values → plan names shown in the UI */
const TIER_LABELS: Record<SubscriptionTier, string> = {
  free:       "Starter",
  pro:        "Professional",
  enterprise: "Growth",
};

export type FeatureToggles = Record<string, boolean>;

export type LockReason =
  | { type: "plan"; requiredTier: SubscriptionTier; requiredLabel: string }
  | { type: "ads_toggle" }
  | { type: "disabled_by_admin" }
  | null;

export function useFeatureGate(
  subscriptionTier: SubscriptionTier | null | undefined,
  adsEnabled: boolean | null | undefined,
  featureToggles?: FeatureToggles | null
) {
  const currentTier: SubscriptionTier = subscriptionTier || "free";
  const adsToggle = adsEnabled ?? true;
  const toggles = featureToggles || {};

  const canAccess = (feature: FeatureKey): boolean => {
    const requiredTier = FEATURE_TIERS[feature];
    if (!requiredTier) return true;

    // Check super-admin toggle first
    if (toggles[feature] === false) return false;

    if (TIER_RANK[currentTier] < TIER_RANK[requiredTier]) return false;

    if ((feature === "ads" || feature === "offers" || feature === "promotions") && !adsToggle) return false;

    return true;
  };

  const isLocked = (feature: FeatureKey): LockReason => {
    const requiredTier = FEATURE_TIERS[feature];
    if (!requiredTier) return null;

    // Check super-admin toggle first
    if (toggles[feature] === false) {
      return { type: "disabled_by_admin" };
    }

    if (TIER_RANK[currentTier] < TIER_RANK[requiredTier]) {
      return {
        type: "plan",
        requiredTier,
        requiredLabel: TIER_LABELS[requiredTier],
      };
    }

    if ((feature === "ads" || feature === "offers" || feature === "promotions") && !adsToggle) {
      return { type: "ads_toggle" };
    }

    return null;
  };

  return { canAccess, isLocked, currentTier, TIER_LABELS };
}
