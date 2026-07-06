import { useState, useEffect, useRef } from "react";
import { Bell, Mail, X, ShoppingBag, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AnimatedHotelName, type LetterAnimation, type AnimationSpeed } from "@/components/branding/AnimatedHotelName";
import { MascotIcon, type MascotType } from "@/components/branding/MascotIcon";
import { cn } from "@/lib/utils";

interface BrandingConfig {
  animation_enabled?: boolean;
  letter_animation?: LetterAnimation;
  mascot?: MascotType;
  mascot_image_url?: string;
  animation_speed?: AnimationSpeed;
  glow_color_sync?: boolean;
}

interface AdminHeaderProps {
  restaurantName?: string;
  primaryColor?: string;
  branding?: BrandingConfig;
  logoUrl?: string | null;
  restaurantId?: string;
}

interface Notification {
  id: string;
  message: string;
  time: Date;
  read: boolean;
  type: "order" | "info";
}

export function AdminHeader({
  restaurantName = "Restaurant Name",
  primaryColor,
  branding,
  logoUrl,
  restaurantId,
}: AdminHeaderProps) {
  const { user } = useAuth();
  const animEnabled = branding?.animation_enabled ?? false;
  const emailPrefix = user?.email?.split('@')[0] || "";
  const displayName = user?.user_metadata?.full_name || emailPrefix || "Admin";
  const avatarUrl = user?.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || 'admin'}`;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Subscribe to new orders via Supabase realtime
  useEffect(() => {
    if (!restaurantId) return;

    const channel = supabase
      .channel(`header-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        (payload: any) => {
          const order = payload.new;
          setNotifications(prev => [
            {
              id: order.id,
              message: `New order #${order.order_number || order.id.slice(0, 6).toUpperCase()} — Table ${order.table_number || '?'}`,
              time: new Date(),
              read: false,
              type: "order",
            },
            ...prev.slice(0, 19), // keep last 20
          ]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-card border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          {animEnabled && branding?.mascot && branding.mascot !== "none" && (
            <MascotIcon mascot={branding.mascot} size={36} primaryColor={primaryColor} customImageUrl={branding?.mascot_image_url} />
          )}
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={restaurantName}
              className="w-10 h-10 rounded-xl object-cover border-2 border-primary/20 shadow-sm"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary text-lg">
              {restaurantName.charAt(0)}
            </div>
          )}
          <div>
            {animEnabled ? (
              <AnimatedHotelName
                name={restaurantName}
                animation={branding?.letter_animation || "bounce"}
                speed={branding?.animation_speed || "normal"}
                primaryColor={branding?.glow_color_sync ? primaryColor : undefined}
                className="text-xl font-bold text-foreground"
              />
            ) : (
              <h1 className="text-xl font-bold text-foreground">{restaurantName}</h1>
            )}
            <p className="text-sm text-muted-foreground">Manage your restaurant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <div className="relative" ref={panelRef}>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-xl"
              onClick={() => { setOpen(o => !o); if (!open) markAllRead(); }}
              aria-label="Notifications"
            >
              <Bell className={cn("w-5 h-5", unreadCount > 0 && "text-primary")} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white animate-bounce">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>

            {open && (
              <div className="absolute right-0 top-12 w-80 rounded-2xl border bg-card shadow-xl z-50 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                  <span className="font-semibold text-sm">Notifications</span>
                  <div className="flex items-center gap-1">
                    {notifications.length > 0 && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
                        Clear all
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* List */}
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                      <Bell className="w-8 h-8 opacity-30" />
                      <p className="text-xs">No notifications yet</p>
                      <p className="text-[10px] opacity-60">New orders will appear here in real-time</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 border-b last:border-0 hover:bg-muted/40 transition-colors",
                          !n.read && "bg-primary/5"
                        )}
                      >
                        <div className={cn(
                          "mt-0.5 p-1.5 rounded-lg shrink-0",
                          n.type === "order" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-500"
                        )}>
                          <ShoppingBag className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium leading-snug">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {n.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {user?.email && (
            <Badge variant="secondary" className="hidden sm:flex items-center gap-1 text-xs">
              <Mail className="w-3 h-3" />
              {user.email}
            </Badge>
          )}
          {user?.email && (
            <Badge variant="secondary" className="flex sm:hidden items-center gap-1 text-xs">
              <Mail className="w-3 h-3" />
              {emailPrefix}
            </Badge>
          )}
          <Avatar className="w-9 h-9 ml-2">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
