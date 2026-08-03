import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/integrations/supabase/functions";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  RefreshCw, Loader2, CheckCircle2, XCircle, ToggleLeft, ToggleRight,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Platform = "zomato" | "swiggy" | "uber_eats" | "dunzo";

const PLATFORMS: { id: Platform; label: string; color: string }[] = [
  { id: "zomato",    label: "Zomato",    color: "text-red-600" },
  { id: "swiggy",   label: "Swiggy",    color: "text-orange-600" },
  { id: "uber_eats",label: "Uber Eats", color: "text-emerald-700" },
  { id: "dunzo",    label: "Dunzo",     color: "text-purple-600" },
];

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category_id: string;
  is_available: boolean;
  image_url: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface Override {
  menu_item_id: string;
  is_available: boolean;
}

interface SyncLog {
  id: string;
  platform: string;
  items_synced: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export function MenuSyncPanel({ restaurantId }: { restaurantId: string }) {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("zomato");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [platformSettings, setPlatformSettings] = useState<Record<Platform, boolean>>({
    zomato: false, swiggy: false, uber_eats: false, dunzo: false,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [
      { data: cats },
      { data: menuItems },
      { data: overrideRows },
      { data: logs },
      { data: settings },
    ] = await Promise.all([
      supabase.from("categories").select("id, name").eq("restaurant_id", restaurantId).order("display_order"),
      supabase.from("menu_items").select("id, name, price, category_id, is_available, image_url").eq("restaurant_id", restaurantId).order("name"),
      supabase.from("platform_item_overrides" as any).select("menu_item_id, is_available, platform").eq("restaurant_id", restaurantId),
      supabase.from("platform_menu_sync_log" as any).select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false }).limit(10),
      supabase.from("platform_api_settings" as any).select("platform, is_active").eq("restaurant_id", restaurantId),
    ]);

    setCategories(cats || []);
    setItems((menuItems as MenuItem[]) || []);

    const ov: Record<string, boolean> = {};
    for (const row of (overrideRows as any[] || [])) {
      if (row.platform === selectedPlatform) ov[row.menu_item_id] = row.is_available;
    }
    setOverrides(ov);
    setSyncLogs((logs as SyncLog[]) || []);

    const ps: Record<string, boolean> = {};
    for (const s of (settings as any[] || [])) ps[s.platform] = s.is_active;
    setPlatformSettings(ps as any);

    setLoading(false);
  }, [restaurantId, selectedPlatform]);

  useEffect(() => { load(); }, [load]);

  // ── Full menu sync ────────────────────────────────────────────────────────
  const handleSyncMenu = async () => {
    if (!platformSettings[selectedPlatform]) {
      toast({ title: "Platform not connected", description: `Configure ${selectedPlatform} credentials in API Integrations tab first.`, variant: "destructive" });
      return;
    }
    setSyncing(true);
    const { data, error } = await invokeFunction("platform-menu-sync", {
      body: { restaurant_id: restaurantId, platform: selectedPlatform, action: "sync_menu" },
    });
    setSyncing(false);
    if (error || data?.error) {
      toast({ title: "Sync failed", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "Menu synced!", description: `${data?.items_synced || 0} items pushed to ${PLATFORMS.find(p => p.id === selectedPlatform)?.label}.` });
      load();
    }
  };

  // ── Toggle single item ────────────────────────────────────────────────────
  const handleToggleItem = async (itemId: string, available: boolean) => {
    setTogglingItem(itemId);
    setOverrides(prev => ({ ...prev, [itemId]: available }));

    const { data, error } = await invokeFunction("platform-menu-sync", {
      body: {
        restaurant_id: restaurantId,
        platform: selectedPlatform,
        action: "toggle_item",
        item_id: itemId,
        is_available: available,
      },
    });
    setTogglingItem(null);

    if (error || data?.error) {
      // Revert optimistic update
      setOverrides(prev => ({ ...prev, [itemId]: !available }));
      toast({ title: "Failed", description: data?.error || error?.message, variant: "destructive" });
    } else {
      const label = PLATFORMS.find(p => p.id === selectedPlatform)?.label;
      toast({
        title: available ? `Item enabled on ${label}` : `Item disabled on ${label}`,
        description: available ? "Customers can now order this item." : "Item hidden from customers on this platform.",
      });
    }
  };

  const isConnected = platformSettings[selectedPlatform];
  const lastSync = syncLogs.find(l => l.platform === selectedPlatform);

  return (
    <div className="space-y-5">
      {/* Platform selector + sync button */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={selectedPlatform} onValueChange={v => setSelectedPlatform(v as Platform)}>
          <SelectTrigger className="w-40 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => (
              <SelectItem key={p.id} value={p.id}>
                <span className={p.color}>{p.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isConnected ? (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
            <AlertCircle className="w-3 h-3" /> Not configured
          </Badge>
        )}

        {lastSync && (
          <span className="text-xs text-muted-foreground">
            Last sync: {formatDistanceToNow(new Date(lastSync.created_at), { addSuffix: true })}
            {lastSync.success ? " ✅" : " ❌"}
          </span>
        )}

        <Button
          className="ml-auto rounded-xl gap-2"
          onClick={handleSyncMenu}
          disabled={syncing || loading || !isConnected}
          title={!isConnected ? "Configure API credentials first" : "Push all menu items to this platform"}
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync All to {PLATFORMS.find(p => p.id === selectedPlatform)?.label}
        </Button>
      </div>

      {!isConnected && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
          Configure your {PLATFORMS.find(p => p.id === selectedPlatform)?.label} API credentials in the <strong>API Integrations</strong> tab before syncing.
        </div>
      )}

      {/* Item list */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => {
            const catItems = items.filter(i => i.category_id === cat.id);
            if (!catItems.length) return null;
            return (
              <div key={cat.id}>
                <p className="text-xs font-bold uppercase text-muted-foreground px-1 mb-1.5 mt-3">{cat.name}</p>
                <div className="space-y-1.5">
                  {catItems.map(item => {
                    const platformAvailable = overrides[item.id] !== undefined ? overrides[item.id] : item.is_available;
                    const isToggling = togglingItem === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                          platformAvailable
                            ? "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                            : "bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 opacity-60"
                        }`}
                      >
                        {/* Name + price */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${!platformAvailable ? "line-through text-muted-foreground" : ""}`}>
                            {item.name}
                          </p>
                          <p className="text-xs text-muted-foreground">₹{Number(item.price).toLocaleString()}</p>
                        </div>

                        {/* Zappy status */}
                        {!item.is_available && (
                          <Badge variant="outline" className="text-xs shrink-0">Off in Zappy</Badge>
                        )}

                        {/* Platform toggle */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {platformAvailable ? "On platform" : "Hidden"}
                          </span>
                          {isToggling ? (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={platformAvailable}
                              onCheckedChange={v => handleToggleItem(item.id, v)}
                              disabled={!isConnected}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sync log */}
      {syncLogs.filter(l => l.platform === selectedPlatform).length > 0 && (
        <Card className="border rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sync History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {syncLogs.filter(l => l.platform === selectedPlatform).slice(0, 5).map(log => (
              <div key={log.id} className="flex items-center gap-3 text-xs">
                {log.success
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                </span>
                <span>{log.items_synced} items</span>
                {log.error_message && (
                  <span className="text-destructive truncate">{log.error_message}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
