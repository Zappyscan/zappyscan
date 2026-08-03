import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, ShoppingCart, X } from "lucide-react";
import type { AddonGroup, AddonOption } from "@/hooks/useAddons";
import type { MenuItem } from "@/hooks/useMenuItems";
import type { SelectedAddon } from "@/stores/cartStore";

interface AddOnSuggestSheetProps {
  item: MenuItem | null;
  addonGroups: AddonGroup[];
  currencySymbol?: string;
  onConfirm: (item: MenuItem, addons: SelectedAddon[]) => void;
  onSkip: (item: MenuItem) => void;
  onClose: () => void;
}

export function AddOnSuggestSheet({
  item,
  addonGroups,
  currencySymbol = "₹",
  onConfirm,
  onSkip,
  onClose,
}: AddOnSuggestSheetProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Reset selections when item changes
  useEffect(() => {
    setSelected({});
  }, [item?.id]);

  if (!item) return null;

  const availableGroups = addonGroups.filter(
    (g) => (g.options || []).some((o) => o.is_available !== false)
  );

  const toggle = (option: AddonOption) => {
    setSelected((prev) => ({ ...prev, [option.id]: !prev[option.id] }));
  };

  const selectedAddons: SelectedAddon[] = availableGroups
    .flatMap((g) => g.options || [])
    .filter((o) => selected[o.id])
    .map((o) => ({ optionId: o.id, name: o.name, price: Number(o.price || 0) }));

  const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const basePrice = Number(item.price || 0);

  const handleConfirm = () => {
    onConfirm(item, selectedAddons);
    onClose();
  };

  const handleSkip = () => {
    onSkip(item);
    onClose();
  };

  return (
    <Sheet open={!!item} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0"
      >
        <SheetHeader className="px-4 pt-4 pb-3 border-b sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-base font-black leading-tight truncate">
                {item.name}
              </SheetTitle>
              <p className="text-sm text-primary font-bold mt-0.5">
                {currencySymbol}{basePrice.toFixed(0)}
                {addonsTotal > 0 && (
                  <span className="text-muted-foreground font-normal ml-1">
                    + {currencySymbol}{addonsTotal.toFixed(0)} add-ons
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 text-muted-foreground hover:text-foreground p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-left mt-1">
            ✨ Customise your order — add extras below
          </p>
        </SheetHeader>

        <div className="px-4 py-3 space-y-5">
          {availableGroups.map((group) => {
            const opts = (group.options || []).filter((o) => o.is_available !== false);
            if (!opts.length) return null;
            const groupSelected = opts.filter((o) => selected[o.id]).length;
            return (
              <div key={group.id}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-black">{group.name}</p>
                  <div className="flex items-center gap-1.5">
                    {group.min_select > 0 && (
                      <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 font-bold px-1.5 py-0.5 rounded-full">
                        Required · {group.min_select}
                      </span>
                    )}
                    {group.max_select > 0 && group.max_select < opts.length && (
                      <span className="text-[10px] bg-muted text-muted-foreground font-semibold px-1.5 py-0.5 rounded-full">
                        Max {group.max_select}
                      </span>
                    )}
                    {groupSelected > 0 && (
                      <span className="text-[10px] bg-primary/10 text-primary font-black px-1.5 py-0.5 rounded-full">
                        {groupSelected} selected
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {opts.map((option) => {
                    const isSelected = !!selected[option.id];
                    const atMax =
                      group.max_select > 0 &&
                      groupSelected >= group.max_select &&
                      !isSelected;
                    return (
                      <button
                        key={option.id}
                        disabled={atMax}
                        onClick={() => toggle(option)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : atMax
                            ? "border-border bg-muted/30 opacity-50 cursor-not-allowed"
                            : "border-border bg-card hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={cn(
                              "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors",
                              isSelected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/40"
                            )}
                          >
                            {isSelected && (
                              <svg
                                viewBox="0 0 10 8"
                                fill="none"
                                className="w-3 h-3"
                              >
                                <path
                                  d="M1 4l2.5 2.5L9 1"
                                  stroke="white"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-semibold">{option.name}</span>
                        </div>
                        {Number(option.price) > 0 ? (
                          <span
                            className={cn(
                              "text-sm font-black shrink-0",
                              isSelected ? "text-primary" : "text-muted-foreground"
                            )}
                          >
                            +{currencySymbol}{Number(option.price).toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600 font-bold shrink-0">
                            Free
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 bg-background border-t px-4 py-3 flex gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-xl flex-[0_0_auto] px-4 text-sm font-semibold text-muted-foreground"
            onClick={handleSkip}
          >
            Skip
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl font-black gap-2 text-sm"
            onClick={handleConfirm}
          >
            <ShoppingCart className="w-4 h-4" />
            Add to Cart
            {addonsTotal > 0 && (
              <span className="opacity-80">
                · {currencySymbol}{(basePrice + addonsTotal).toFixed(0)}
              </span>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
