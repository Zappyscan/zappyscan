import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, AlertCircle, Copy, ExternalLink, Loader2,
  Eye, EyeOff, Zap, RefreshCw, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";

// ─── Platform metadata ────────────────────────────────────────────────────────

interface PlatformConfig {
  id: string;
  name: string;
  color: string;
  bg: string;
  border: string;
  logo: string;           // emoji placeholder — swap for real logo if available
  partnerUrl: string;
  docsUrl: string;
  functionSlug: string;   // Supabase Edge Function name
  fields: {
    key: string;
    label: string;
    placeholder: string;
    hint: string;
    secret?: boolean;
  }[];
  webhookSignatureHeader: string;
  setupSteps: string[];
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    id: "zomato",
    name: "Zomato",
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/20",
    border: "border-red-200 dark:border-red-800",
    logo: "🍽️",
    partnerUrl: "https://www.zomato.com/partner",
    docsUrl: "https://www.zomato.com/partner",
    functionSlug: "zomato-webhook",
    webhookSignatureHeader: "X-Zomato-Signature",
    fields: [
      { key: "api_key",        label: "Client ID",        placeholder: "Zomato client_id",     hint: "From Zomato Partner Portal → API Settings" },
      { key: "api_secret",     label: "Client Secret",    placeholder: "Zomato client_secret",  hint: "Keep this secret — never share publicly", secret: true },
      { key: "webhook_secret", label: "Webhook Secret",   placeholder: "Webhook signing secret", hint: "Zomato uses this to sign webhook POSTs", secret: true },
      { key: "restaurant_ref", label: "Zomato Restaurant ID", placeholder: "e.g. 12345678",    hint: "Your restaurant's Zomato res_id" },
    ],
    setupSteps: [
      "Go to zomato.com/partner and register your restaurant",
      "Navigate to Partner Portal → API Settings → Get Credentials",
      "Copy your Client ID and Client Secret and paste them here",
      "Copy the webhook URL below and paste it in Zomato Partner Portal → Webhook Settings",
      "Enable the integration with the toggle — new Zomato orders will appear automatically",
    ],
  },
  {
    id: "swiggy",
    name: "Swiggy",
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-orange-200 dark:border-orange-800",
    logo: "🛵",
    partnerUrl: "https://partner.swiggy.com",
    docsUrl: "https://partner.swiggy.com",
    functionSlug: "swiggy-webhook",
    webhookSignatureHeader: "X-Swiggy-Signature",
    fields: [
      { key: "api_key",        label: "Merchant ID",      placeholder: "Swiggy merchant_id",    hint: "From Swiggy Partner Portal → Account → Merchant Details" },
      { key: "api_secret",     label: "Secret Key",       placeholder: "Swiggy secret_key",     hint: "Keep secret — used for API authentication", secret: true },
      { key: "webhook_secret", label: "Webhook Secret",   placeholder: "Webhook signing key",    hint: "From Swiggy Partner Portal → Integrations → Webhook", secret: true },
      { key: "restaurant_ref", label: "Swiggy Store ID",  placeholder: "e.g. STORE_ABC123",     hint: "Your Swiggy store/outlet ID" },
    ],
    setupSteps: [
      "Go to partner.swiggy.com and sign in as a restaurant partner",
      "Navigate to Account Settings → API Integrations → Generate Keys",
      "Copy Merchant ID and Secret Key and paste them here",
      "Go to Integrations → Webhook Settings and paste the webhook URL below",
      "Toggle the integration on — Swiggy orders will flow in automatically",
    ],
  },
  {
    id: "uber_eats",
    name: "Uber Eats",
    color: "text-emerald-700",
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    border: "border-emerald-200 dark:border-emerald-800",
    logo: "🚗",
    partnerUrl: "https://developer.uber.com/docs/eats",
    docsUrl: "https://developer.uber.com/docs/eats/introduction",
    functionSlug: "ubereats-webhook",
    webhookSignatureHeader: "X-Uber-Signature",
    fields: [
      { key: "api_key",        label: "Client ID",        placeholder: "Uber Eats client_id",   hint: "From developer.uber.com → Your App → Credentials" },
      { key: "api_secret",     label: "Client Secret",    placeholder: "Uber Eats client_secret", hint: "Used for OAuth token generation and webhook verification", secret: true },
      { key: "restaurant_ref", label: "Store ID",         placeholder: "Uber Eats store UUID",  hint: "Your Uber Eats store UUID from the developer dashboard" },
    ],
    setupSteps: [
      "Register at developer.uber.com and create a new app with Eats API scope",
      "Get your Client ID and Client Secret from the app credentials page",
      "Find your Store ID in Uber Eats Manager → Restaurant → Store Details",
      "Paste the webhook URL below into developer.uber.com → Your App → Webhooks",
      "Enable the integration — Uber Eats will send a verification challenge automatically",
    ],
  },
  {
    id: "dunzo",
    name: "Dunzo",
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/20",
    border: "border-purple-200 dark:border-purple-800",
    logo: "📦",
    partnerUrl: "https://business.dunzo.com",
    docsUrl: "https://docs.dunzo.com/api",
    functionSlug: "zomato-webhook", // same pattern, platform field differentiates
    webhookSignatureHeader: "X-Dunzo-Signature",
    fields: [
      { key: "api_key",        label: "Client ID",        placeholder: "Dunzo client_id",       hint: "From Dunzo for Business → Developer Portal" },
      { key: "api_secret",     label: "Client Secret",    placeholder: "Dunzo client_secret",   hint: "Keep secret", secret: true },
      { key: "restaurant_ref", label: "Dunzo Store ID",   placeholder: "Dunzo store/outlet ID", hint: "Your outlet ID in Dunzo for Business dashboard" },
    ],
    setupSteps: [
      "Go to business.dunzo.com and register your restaurant",
      "Navigate to Developer Portal → API Keys → Generate New",
      "Enter your Client ID and Secret here",
      "Paste the webhook URL in Dunzo Partner Portal → Webhooks",
      "Enable integration to receive orders automatically",
    ],
  },
];

// ─── Supabase project ref extraction ─────────────────────────────────────────
function getSupabaseProjectRef(): string {
  const url = (supabase as any).supabaseUrl || "";
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  return match?.[1] || "YOUR_PROJECT_REF";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlatformIntegrations({ restaurantId }: { restaurantId: string }) {
  const { toast } = useToast();
  const projectRef = getSupabaseProjectRef();

  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [openPlatforms, setOpenPlatforms] = useState<Record<string, boolean>>({});

  // ── Load saved settings ──────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("platform_api_settings" as any)
      .select("*")
      .eq("restaurant_id", restaurantId);
    const map: Record<string, any> = {};
    const fv: Record<string, Record<string, string>> = {};
    for (const row of (data as any[]) || []) {
      map[row.platform] = row;
      fv[row.platform] = {
        api_key:        row.api_key || "",
        api_secret:     row.api_secret || "",
        webhook_secret: row.webhook_secret || "",
        restaurant_ref: row.restaurant_ref || "",
      };
    }
    setSettings(map);
    setFormValues(fv);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => { load(); }, [load]);

  // ── Save settings ────────────────────────────────────────────────────────
  const handleSave = async (platformId: string) => {
    setSaving(platformId);
    const fv = formValues[platformId] || {};
    const upsertData = {
      restaurant_id:  restaurantId,
      platform:       platformId,
      api_key:        fv.api_key || null,
      api_secret:     fv.api_secret || null,
      webhook_secret: fv.webhook_secret || null,
      restaurant_ref: fv.restaurant_ref || null,
      is_active:      settings[platformId]?.is_active ?? false,
    };
    const { error } = await supabase
      .from("platform_api_settings" as any)
      .upsert(upsertData, { onConflict: "restaurant_id,platform" });
    setSaving(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved!", description: `${PLATFORM_CONFIGS.find(p => p.id === platformId)?.name} credentials saved.` });
      load();
    }
  };

  // ── Toggle active ────────────────────────────────────────────────────────
  const handleToggle = async (platformId: string, active: boolean) => {
    const { error } = await supabase
      .from("platform_api_settings" as any)
      .upsert({ restaurant_id: restaurantId, platform: platformId, is_active: active }, { onConflict: "restaurant_id,platform" });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSettings(prev => ({ ...prev, [platformId]: { ...prev[platformId], is_active: active } }));
      toast({
        title: active ? "Integration enabled!" : "Integration disabled",
        description: active
          ? `${PLATFORM_CONFIGS.find(p => p.id === platformId)?.name} orders will now flow in automatically.`
          : `${PLATFORM_CONFIGS.find(p => p.id === platformId)?.name} integration paused.`,
      });
    }
  };

  const webhookUrl = (slug: string) =>
    `https://${projectRef}.supabase.co/functions/v1/${slug}?restaurant_id=${restaurantId}`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard.` });
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <p className="font-semibold mb-1">How platform integration works</p>
          <p>Each platform (Zomato, Swiggy, Uber Eats) sends order notifications to your unique <strong>webhook URL</strong> below. You enter the API credentials from your restaurant's partner account on each platform, then paste your webhook URL in their partner portal. New orders appear in Zappy automatically — no manual entry needed.</p>
        </div>
      </div>

      {/* Platform cards */}
      {PLATFORM_CONFIGS.map(platform => {
        const saved = settings[platform.id];
        const isActive = saved?.is_active ?? false;
        const hasCreds = saved?.api_key || saved?.api_secret;
        const fv = formValues[platform.id] || {};
        const isOpen = openPlatforms[platform.id] ?? false;
        const wUrl = webhookUrl(platform.functionSlug);

        return (
          <Collapsible
            key={platform.id}
            open={isOpen}
            onOpenChange={open => setOpenPlatforms(prev => ({ ...prev, [platform.id]: open }))}
          >
            <Card className={`border rounded-2xl transition-shadow ${isOpen ? "shadow-md" : "shadow-sm"}`}>
              {/* Card header / toggle row */}
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {/* Logo + name */}
                  <div className={`w-11 h-11 rounded-xl ${platform.bg} ${platform.border} border flex items-center justify-center text-2xl shrink-0`}>
                    {platform.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className={`text-base font-bold ${platform.color}`}>{platform.name}</CardTitle>
                      {isActive && hasCreds && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Connected
                        </Badge>
                      )}
                      {hasCreds && !isActive && (
                        <Badge variant="outline" className="text-xs">Paused</Badge>
                      )}
                      {!hasCreds && (
                        <Badge variant="secondary" className="text-xs">Not configured</Badge>
                      )}
                    </div>
                    {saved?.last_order_at && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last order: {new Date(saved.last_order_at).toLocaleString()} · {saved.orders_received || 0} total received
                      </p>
                    )}
                  </div>
                  {/* Active toggle */}
                  <Switch
                    checked={isActive}
                    onCheckedChange={v => handleToggle(platform.id, v)}
                    disabled={!hasCreds}
                    title={!hasCreds ? "Save credentials first" : (isActive ? "Disable" : "Enable")}
                    className="shrink-0"
                  />
                  {/* Expand/collapse */}
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="rounded-xl shrink-0 text-xs gap-1">
                      {isOpen ? "Close" : "Configure"}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>

              <CollapsibleContent>
                <CardContent className="pt-0 space-y-5 border-t">
                  <div className="pt-4 space-y-5">
                    {/* Setup steps */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Setup Guide</p>
                      <ol className="space-y-1.5">
                        {platform.setupSteps.map((step, i) => (
                          <li key={i} className="flex gap-2.5 text-sm">
                            <span className={`w-5 h-5 rounded-full ${platform.bg} ${platform.color} flex items-center justify-center text-xs font-bold shrink-0 mt-0.5`}>
                              {i + 1}
                            </span>
                            <span className="text-muted-foreground">{step}</span>
                          </li>
                        ))}
                      </ol>
                      <a
                        href={platform.partnerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${platform.color} hover:underline mt-1`}
                      >
                        Open {platform.name} Partner Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {/* Webhook URL */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Your Webhook URL — paste this in {platform.name} Partner Portal</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={wUrl}
                          className="rounded-xl font-mono text-xs bg-muted"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="shrink-0 rounded-xl"
                          onClick={() => copyToClipboard(wUrl, "Webhook URL")}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Signature header: <code className="bg-muted px-1 rounded">{platform.webhookSignatureHeader}</code>
                      </p>
                    </div>

                    {/* Credentials */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">API Credentials</p>
                      {platform.fields.map(field => (
                        <div key={field.key} className="space-y-1.5">
                          <Label className="text-xs font-semibold">{field.label}</Label>
                          <div className="relative flex gap-2">
                            <Input
                              type={field.secret && !showSecrets[`${platform.id}_${field.key}`] ? "password" : "text"}
                              placeholder={field.placeholder}
                              value={fv[field.key] || ""}
                              onChange={e => setFormValues(prev => ({
                                ...prev,
                                [platform.id]: { ...prev[platform.id], [field.key]: e.target.value },
                              }))}
                              className="rounded-xl font-mono text-sm"
                            />
                            {field.secret && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="shrink-0 rounded-xl"
                                onClick={() => setShowSecrets(prev => ({
                                  ...prev,
                                  [`${platform.id}_${field.key}`]: !prev[`${platform.id}_${field.key}`],
                                }))}
                              >
                                {showSecrets[`${platform.id}_${field.key}`]
                                  ? <EyeOff className="w-4 h-4" />
                                  : <Eye className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{field.hint}</p>
                        </div>
                      ))}
                    </div>

                    {/* Save button */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        className="rounded-xl flex-1"
                        onClick={() => handleSave(platform.id)}
                        disabled={saving === platform.id}
                      >
                        {saving === platform.id
                          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                          : <><Zap className="w-4 h-4 mr-2" /> Save {platform.name} Credentials</>}
                      </Button>
                      {hasCreds && (
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-xl shrink-0"
                          onClick={load}
                          title="Reload saved values"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        );
      })}
    </div>
  );
}
