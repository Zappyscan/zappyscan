import { useState } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";

interface InstallBannerProps {
  /** "customer" = bottom banner in menu; "admin" = subtle top bar */
  variant?: "customer" | "admin";
}

/**
 * Shows an "Add to Home Screen / Install" prompt.
 * - On Android Chrome: triggers the native beforeinstallprompt
 * - On iOS Safari: shows manual share-sheet instructions
 * - Hides itself once dismissed or installed
 */
export function InstallBanner({ variant = "customer" }: InstallBannerProps) {
  const { isInstallable, isInstalled, promptInstall, dismiss } = usePWAInstall();
  const [iosTip, setIosTip] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem("pwa_banner_dismissed") === "1";
  });

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as any).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  // Show iOS tip if on iOS Safari and not already installed
  const showIOSTip = isIOS && isSafari && !isInstalled && !dismissed;
  const showAndroid = isInstallable && !isInstalled && !dismissed;

  const handleDismiss = () => {
    sessionStorage.setItem("pwa_banner_dismissed", "1");
    setDismissed(true);
    dismiss();
    setIosTip(false);
  };

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result === "unavailable" && isIOS) {
      setIosTip(true);
    }
  };

  if (!showAndroid && !showIOSTip) return null;

  // ── Admin variant: slim top bar ─────────────────────────────────────
  if (variant === "admin") {
    return (
      <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 shrink-0" />
          <span className="font-medium">
            {showAndroid ? "Install Zappy as an app for quick access" : "Tap Share → Add to Home Screen in Safari"}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showAndroid && (
            <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleInstall}>
              Install
            </Button>
          )}
          <button onClick={handleDismiss} className="opacity-80 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Customer variant: bottom card ───────────────────────────────────
  return (
    <>
      {/* iOS share-sheet tip overlay */}
      {iosTip && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={() => setIosTip(false)}>
          <div
            className="w-full bg-white dark:bg-zinc-900 rounded-t-3xl p-6 pb-10 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto mb-2" />
            <h3 className="text-lg font-bold text-center">Add to Home Screen</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">1</div>
                <p>Tap the <Share className="inline w-4 h-4 text-blue-500 align-text-bottom mx-0.5" /> <strong>Share</strong> icon at the bottom of Safari</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">2</div>
                <p>Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">3</div>
                <p>Tap <strong>"Add"</strong> in the top-right corner</p>
              </div>
            </div>
            <Button className="w-full rounded-2xl" onClick={() => setIosTip(false)}>Got it!</Button>
          </div>
        </div>
      )}

      {/* Bottom install banner */}
      <div className="fixed bottom-20 left-3 right-3 z-40 pointer-events-none">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl p-4 flex items-center gap-3 pointer-events-auto">
          {/* App icon */}
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <Download className="w-6 h-6 text-white" />
          </div>
          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Install Zappy</p>
            <p className="text-xs text-muted-foreground truncate">
              {isIOS
                ? "Add to Home Screen from Share menu"
                : "Install as app — works offline"}
            </p>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" className="rounded-xl text-xs h-8 bg-emerald-600 hover:bg-emerald-700" onClick={handleInstall}>
              {isIOS ? "How?" : "Install"}
            </Button>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
