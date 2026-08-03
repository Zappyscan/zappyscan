import { useRef } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface KOTItem {
  name: string;
  quantity: number;
  notes?: string;
}

export interface KOTData {
  orderId: string;
  platform: string;
  platformOrderId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  items: KOTItem[];
  notes?: string;
  prepTime?: number;
  createdAt: string;
  restaurantName?: string;
}

interface KOTPrintProps {
  data: KOTData;
  onClose: () => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  zomato: "ZOMATO",
  swiggy: "SWIGGY",
  uber_eats: "UBER EATS",
  dunzo: "DUNZO",
  direct: "DIRECT DELIVERY",
  other: "OTHER",
};

/** Parse items_summary string or array into KOTItem[] */
export function parseItemsSummary(summary: string): KOTItem[] {
  if (!summary) return [];
  // Try to parse "2x Butter Chicken, 3x Garlic Naan" format
  return summary.split(",").map(part => {
    part = part.trim();
    const match = part.match(/^(\d+)x\s+(.+)$/i);
    if (match) {
      return { name: match[2].trim(), quantity: parseInt(match[1]) };
    }
    return { name: part, quantity: 1 };
  }).filter(i => i.name);
}

export function KOTPrint({ data, onClose }: KOTPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printRef.current?.innerHTML;
    if (!printContent) return;

    const win = window.open("", "_blank", "width=400,height=600");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>KOT - ${data.orderId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; }
          .kot-root { padding: 8px; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .platform-badge { font-size: 16px; font-weight: 900; letter-spacing: 2px; margin-bottom: 4px; }
          .restaurant-name { font-size: 14px; font-weight: bold; }
          .order-id { font-size: 11px; color: #333; margin-top: 4px; }
          .section { margin: 8px 0; }
          .section-title { font-weight: bold; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #000; margin-bottom: 4px; padding-bottom: 2px; }
          .item-row { display: flex; justify-content: space-between; margin: 3px 0; }
          .item-qty { font-weight: bold; font-size: 14px; min-width: 24px; }
          .item-name { flex: 1; padding: 0 6px; }
          .footer { border-top: 2px dashed #000; padding-top: 8px; margin-top: 8px; text-align: center; font-size: 10px; color: #555; }
          .prep-time { font-size: 18px; font-weight: 900; text-align: center; border: 3px solid #000; padding: 4px; margin: 8px 0; }
          .customer { font-size: 11px; }
          .notes { font-style: italic; font-size: 11px; background: #f0f0f0; padding: 4px; margin-top: 4px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="kot-root">${printContent}</div>
        <script>window.onload = () => { window.print(); window.close(); }<\/script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const platformLabel = PLATFORM_LABELS[data.platform] || data.platform.toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
        {/* Preview header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-lg">KOT Preview</h3>
          <div className="flex gap-2">
            <Button size="sm" className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print KOT
            </Button>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable preview */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <div
            ref={printRef}
            className="font-mono text-sm border-2 border-dashed border-zinc-300 rounded-xl p-4 bg-white space-y-3"
            style={{ fontFamily: "'Courier New', monospace" }}
          >
            {/* Header */}
            <div className="text-center border-b-2 border-dashed border-zinc-400 pb-3">
              <div className="text-xl font-black tracking-widest">{platformLabel}</div>
              {data.restaurantName && (
                <div className="font-bold text-sm mt-1">{data.restaurantName}</div>
              )}
              <div className="text-xs text-zinc-500 mt-1">
                KOT #{data.orderId.slice(-6).toUpperCase()}
              </div>
              {data.platformOrderId && (
                <div className="text-xs text-zinc-500">Ref: {data.platformOrderId}</div>
              )}
              <div className="text-xs text-zinc-500">{format(new Date(data.createdAt), "dd MMM yyyy, h:mm a")}</div>
            </div>

            {/* Prep time */}
            {data.prepTime && (
              <div className="text-center border-2 border-black rounded-lg py-1 font-black text-2xl">
                ⏱ {data.prepTime} MIN
              </div>
            )}

            {/* Customer */}
            {(data.customerName || data.deliveryAddress) && (
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-[10px] uppercase border-b border-zinc-300 pb-1 mb-1">Delivery To</div>
                {data.customerName && <div className="font-semibold">{data.customerName}</div>}
                {data.customerPhone && <div className="text-zinc-600">{data.customerPhone}</div>}
                {data.deliveryAddress && <div className="text-zinc-600 text-[10px]">{data.deliveryAddress}</div>}
              </div>
            )}

            {/* Items */}
            <div>
              <div className="font-bold text-[10px] uppercase border-b border-zinc-300 pb-1 mb-2">Order Items</div>
              <div className="space-y-2">
                {data.items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="font-black text-lg leading-none w-7 shrink-0">{item.quantity}</span>
                    <span className="font-semibold text-sm leading-tight">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {data.notes && (
              <div className="text-[10px] italic bg-zinc-100 rounded p-2">
                <span className="font-bold not-italic">Note: </span>{data.notes}
              </div>
            )}

            {/* Footer */}
            <div className="text-center border-t-2 border-dashed border-zinc-400 pt-3 text-[10px] text-zinc-500">
              Powered by Zappy Restaurant OS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
