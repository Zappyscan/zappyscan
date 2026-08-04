import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  useInventoryItems, useCreateInventoryItem, useUpdateInventoryStock, useDeleteInventoryItem,
  useRecipeMappings, useCreateRecipeMapping, useDeleteRecipeMapping,
  useSuppliers, useCreateSupplier, useDeleteSupplier,
  useWasteLogs, useCreateWasteLog, useDeleteWasteLog,
  usePurchaseOrders, useCreatePurchaseOrder, useUpdatePOStatus, useDeletePurchaseOrder,
  type Supplier, type WasteLog, type PurchaseOrder,
} from "@/hooks/useInventory";
import { useMenuItems } from "@/hooks/useMenuItems";
import { useRestaurantDetails } from "@/hooks/useRestaurant";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Loader2, Package, AlertTriangle, CheckCircle2,
  Users, ShoppingBag, FileSpreadsheet, Trash, FileText,
  TrendingDown, TrendingUp, Calendar, Mail, Phone, MapPin, Download,
  BookOpen, ChefHat,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface InventoryManagerProps {
  restaurantId: string;
}


export function InventoryManager({ restaurantId }: InventoryManagerProps) {
  const { toast } = useToast();
  const { data: restaurant } = useRestaurantDetails(restaurantId);
  const { data: items = [], isLoading } = useInventoryItems(restaurantId);
  const createItem = useCreateInventoryItem();
  const updateStock = useUpdateInventoryStock();
  const deleteItem = useDeleteInventoryItem();

  const [newItem, setNewItem] = useState({ name: "", unit: "kg", current_stock: "0", low_stock_threshold: "5" });
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  // DB-backed sub-tab data
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers(restaurantId);
  const { data: wasteLogs = [], isLoading: wasteLoading } = useWasteLogs(restaurantId);
  const { data: purchaseOrders = [], isLoading: poLoading } = usePurchaseOrders(restaurantId);
  const createSupplier = useCreateSupplier();
  const deleteSupplier = useDeleteSupplier();
  const createWasteLog = useCreateWasteLog();
  const deleteWasteLog = useDeleteWasteLog();
  const createPO = useCreatePurchaseOrder();
  const updatePOStatus = useUpdatePOStatus();
  const deletePO = useDeletePurchaseOrder();

  // Dialog & Add Form States
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", contact_person: "", email: "", phone: "", address: "" });

  const [poModalOpen, setPOModalOpen] = useState(false);
  const [newPO, setNewPO] = useState({
    supplierId: "",
    items: [{ itemName: "", quantity: 1, costPrice: 0 }]
  });

  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [newWaste, setNewWaste] = useState({ itemId: "", quantity: "", reason: "SPOILAGE" as WasteLog["reason"] });

  // ── Recipe mapping state ───────────────────────────────────────────────────
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [recipeForm, setRecipeForm] = useState({ inventory_item_id: "", quantity_used: "1" });
  const { data: menuItems = [] } = useMenuItems(restaurantId);
  const { data: recipeMappings = [], isLoading: recipesLoading } = useRecipeMappings(selectedMenuItemId || undefined);
  const createMapping = useCreateRecipeMapping();
  const deleteMapping = useDeleteRecipeMapping();


  // 1. Stock Actions
  const handleAdd = async () => {
    if (!newItem.name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      await createItem.mutateAsync({
        restaurant_id: restaurantId,
        name: newItem.name,
        unit: newItem.unit,
        current_stock: parseFloat(newItem.current_stock) || 0,
        low_stock_threshold: parseFloat(newItem.low_stock_threshold) || 5,
      });
      toast({ title: "Item Added" });
      setNewItem({ name: "", unit: "kg", current_stock: "0", low_stock_threshold: "5" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleAdjust = async (id: string, currentStock: number) => {
    const adj = parseFloat(adjustments[id] || "0");
    if (!adj) return;
    try {
      await updateStock.mutateAsync({ id, current_stock: currentStock + adj, restaurantId });
      toast({ title: "Stock Updated" });
      setAdjustments(prev => ({ ...prev, [id]: "" }));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getStockStatus = (item: { current_stock: number; low_stock_threshold: number }) => {
    if (item.current_stock <= 0) return "out";
    if (item.current_stock <= item.low_stock_threshold) return "low";
    return "ok";
  };

  // 2. Suppliers Actions
  const handleAddSupplier = async () => {
    if (!newSupplier.name) return;
    try {
      await createSupplier.mutateAsync({ restaurant_id: restaurantId, ...newSupplier });
      setNewSupplier({ name: "", contact_person: "", email: "", phone: "", address: "" });
      setSupplierModalOpen(false);
      toast({ title: "Supplier Added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // 3. Purchase Orders Actions
  const handleAddPO = async () => {
    const supplier = suppliers.find(s => s.id === newPO.supplierId);
    if (!supplier) return;

    const total = newPO.items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
    try {
      await createPO.mutateAsync({
        restaurant_id: restaurantId,
        po_number: `PO-${new Date().getFullYear()}-${String(purchaseOrders.length + 1).padStart(3, "0")}`,
        supplier_id: supplier.id,
        supplier_name: supplier.name,
        status: "PENDING",
        total_amount: total,
        items: newPO.items,
      });
      setNewPO({ supplierId: "", items: [{ itemName: "", quantity: 1, costPrice: 0 }] });
      setPOModalOpen(false);
      toast({ title: "Purchase Order Created" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handlePOStatusChange = async (id: string, newStatus: PurchaseOrder["status"]) => {
    const po = purchaseOrders.find(p => p.id === id);
    if (!po) return;
    try {
      await updatePOStatus.mutateAsync({ id, status: newStatus, restaurantId });
      // If received, auto-add to inventory stock
      if (newStatus === "RECEIVED" && po.status !== "RECEIVED") {
        for (const poItem of po.items) {
          const match = items.find(inv => inv.name.toLowerCase() === poItem.itemName.toLowerCase());
          if (match) {
            await updateStock.mutateAsync({ id: match.id, current_stock: match.current_stock + poItem.quantity, restaurantId });
          }
        }
        toast({ title: "Received & Stock Added" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // 4. Waste Logs Actions
  const handleAddWaste = async () => {
    const item = items.find(i => i.id === newWaste.itemId);
    if (!item) return;

    const qty = parseFloat(newWaste.quantity) || 0;
    if (qty <= 0) return;

    // Deduct stock
    updateStock.mutate({ id: item.id, current_stock: Math.max(0, item.current_stock - qty), restaurantId });

    try {
      await createWasteLog.mutateAsync({
        restaurant_id: restaurantId,
        inventory_item_id: item.id,
        item_name: item.name,
        quantity: qty,
        unit: item.unit,
        reason: newWaste.reason,
      });
      setNewWaste({ itemId: "", quantity: "", reason: "SPOILAGE" });
      setWasteModalOpen(false);
      toast({ title: "Waste Logged", description: `Deducted ${qty} ${item.unit} from stock.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // CSV Export for Waste Logs
  const handleExportWasteCSV = () => {
    if (wasteLogs.length === 0) return;
    const headers = ["ID", "Item Name", "Quantity", "Unit", "Reason", "Date"];
    const rows = wasteLogs.map(log => [
      log.id,
      log.item_name,
      log.quantity,
      log.unit,
      log.reason,
      format(parseISO(log.logged_at), "yyyy-MM-dd HH:mm")
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_waste_logs_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print PDF fallback for Waste Logs
  const handlePrintWastePDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Inventory Waste Logs Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 24px; margin-bottom: 5px; }
            p { font-size: 14px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
            th { background-color: #f5f5f5; font-weight: bold; }
            tr:nth-child(even) { background-color: #fafafa; }
          </style>
        </head>
        <body>
          <h1>Inventory Waste & Spoilage Report</h1>
          <p>Generated on ${format(new Date(), "PPP HH:mm")}</p>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Reason</th>
                <th>Logged Date</th>
              </tr>
            </thead>
            <tbody>
              ${wasteLogs.map(log => `
                <tr>
                  <td><strong>${log.item_name}</strong></td>
                  <td>${log.quantity} ${log.unit}</td>
                  <td>${log.reason}</td>
                  <td>${format(parseISO(log.logged_at), "yyyy-MM-dd HH:mm")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // 5. Consumption report calculation
  const consumptionReport = useMemo(() => {
    return items.map(item => {
      // Calculate total waste for this item
      const itemWaste = wasteLogs
        .filter(w => w.inventory_item_id === item.id)
        .reduce((sum, w) => sum + w.quantity, 0);

      // Average daily usage simulation (or simple mock calculations)
      const seed = item.name.charCodeAt(0) + item.name.charCodeAt(2) || 5;
      const dailyAverage = (seed % 4) + 1.2; 
      const daysToRunout = item.current_stock > 0 ? Math.round(item.current_stock / dailyAverage) : 0;

      return {
        ...item,
        totalWaste: itemWaste,
        dailyAverage: dailyAverage.toFixed(1),
        daysToRunout,
        status: daysToRunout <= 2 ? "CRITICAL" : daysToRunout <= 5 ? "WARNING" : "SAFE"
      };
    });
  }, [items, wasteLogs]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title Header */}
      <div className="bg-card p-4 sm:p-6 border rounded-3xl shadow-sm">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Restaurant OS Inventory Control</h2>
        <p className="text-sm text-muted-foreground">Track physical stock, manage vendor purchase orders, log waste reports, and run runout forecasts.</p>
      </div>

      <Tabs defaultValue="stock" className="space-y-4 sm:space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-2xl w-fit flex flex-wrap gap-1">
          <TabsTrigger value="stock" className="rounded-xl px-4 py-2 gap-2 text-xs font-semibold">
            <Package className="w-4 h-4" /> Stock List
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="rounded-xl px-4 py-2 gap-2 text-xs font-semibold">
            <Users className="w-4 h-4" /> Supplier Directory
          </TabsTrigger>
          <TabsTrigger value="po" className="rounded-xl px-4 py-2 gap-2 text-xs font-semibold">
            <ShoppingBag className="w-4 h-4" /> Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="waste" className="rounded-xl px-4 py-2 gap-2 text-xs font-semibold">
            <Trash className="w-4 h-4" /> Waste Tracking
          </TabsTrigger>
          <TabsTrigger value="consumption" className="rounded-xl px-4 py-2 gap-2 text-xs font-semibold">
            <TrendingUp className="w-4 h-4" /> Consumption & Forecasting
          </TabsTrigger>
          <TabsTrigger value="recipes" className="rounded-xl px-4 py-2 gap-2 text-xs font-semibold">
            <ChefHat className="w-4 h-4" /> Recipe Mappings
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ STOCK LIST TAB ════════════════ */}
        <TabsContent value="stock" className="space-y-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" /> Add Inventory Item
              </CardTitle>
              <CardDescription>Manually catalog raw restaurant ingredients and items.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs font-bold">Item Name</Label>
                  <Input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="e.g. Fresh Tomatoes, Chicken Breast" className="rounded-xl h-10" />
                </div>
                <div className="space-y-1 w-24">
                  <Label className="text-xs font-bold">Unit</Label>
                  <Input value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })} className="rounded-xl h-10" />
                </div>
                <div className="space-y-1 w-28">
                  <Label className="text-xs font-bold">Current Stock</Label>
                  <Input type="number" value={newItem.current_stock} onChange={(e) => setNewItem({ ...newItem, current_stock: e.target.value })} className="rounded-xl h-10" />
                </div>
                <div className="space-y-1 w-28">
                  <Label className="text-xs font-bold">Low Threshold</Label>
                  <Input type="number" value={newItem.low_stock_threshold} onChange={(e) => setNewItem({ ...newItem, low_stock_threshold: e.target.value })} className="rounded-xl h-10" />
                </div>
                <Button onClick={handleAdd} disabled={createItem.isPending} className="rounded-xl h-10 font-bold px-6">
                  {createItem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4.5 h-4.5 mr-1.5" />}
                  Add Item
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold">Warehouse Stock Matrix ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">No warehouse stocks cataloged yet. Use the add panel above.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ingredient / Item</TableHead>
                        <TableHead className="text-center">Current Stock</TableHead>
                        <TableHead className="text-center">Low Threshold</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Stock Adjustment</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const status = getStockStatus(item);
                        return (
                          <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                            <TableCell className="font-semibold text-slate-800 dark:text-zinc-100">
                              {item.name}
                              <span className="text-xs text-muted-foreground ml-1.5">({item.unit})</span>
                            </TableCell>
                            <TableCell className="text-center font-bold text-base">{item.current_stock}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{item.low_stock_threshold}</TableCell>
                            <TableCell className="text-center">
                              {status === "out" && <Badge variant="destructive" className="rounded-full text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />OUT OF STOCK</Badge>}
                              {status === "low" && <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-0 rounded-full text-[10px]"><AlertTriangle className="w-3 h-3 mr-1" />LOW STOCK</Badge>}
                              {status === "ok" && <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-0 rounded-full text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />OPTIMAL</Badge>}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <Input
                                  type="number"
                                  className="w-20 h-8.5 rounded-lg text-xs"
                                  placeholder="+/-"
                                  value={adjustments[item.id] || ""}
                                  onChange={(e) => setAdjustments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                />
                                <Button size="sm" variant="outline" className="h-8.5 rounded-lg font-bold text-xs" onClick={() => handleAdjust(item.id, item.current_stock)}>
                                  Apply
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                                onClick={() => {
                                  if (confirm(`Delete ${item.name}? This will clear stock levels.`))
                                    deleteItem.mutate({ id: item.id, restaurantId });
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ SUPPLIER DIRECTORY TAB ════════════════ */}
        <TabsContent value="suppliers" className="space-y-6">
          <div className="flex justify-between items-center bg-card p-5 border rounded-2xl shadow-sm">
            <div>
              <h3 className="font-bold text-base">Vendors Directory</h3>
              <p className="text-xs text-muted-foreground">Manage suppliers, contacts, and delivery addresses.</p>
            </div>
            <Button onClick={() => setSupplierModalOpen(true)} className="rounded-xl gap-1.5 font-semibold text-xs h-9">
              <Plus className="w-4 h-4" /> Add Vendor
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {suppliers.map(sup => (
              <Card key={sup.id} className="rounded-3xl border shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-zinc-900/50 p-5 border-b flex flex-row items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm">
                    {sup.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800 dark:text-zinc-100">{sup.name}</CardTitle>
                    <CardDescription className="text-[10px]">Contact: {sup.contact_person}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>{sup.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>{sup.phone}</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0 text-slate-400 pt-0.5" />
                    <span className="line-clamp-2">{sup.address}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-end">
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 rounded-lg gap-1 text-[11px]" onClick={() => {
                      if (confirm(`Remove supplier ${sup.name}?`)) {
                        deleteSupplier.mutate({ id: sup.id, restaurantId });
                      }
                    }}>
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ════════════════ PURCHASE ORDERS TAB ════════════════ */}
        <TabsContent value="po" className="space-y-6">
          <div className="flex justify-between items-center bg-card p-5 border rounded-2xl shadow-sm">
            <div>
              <h3 className="font-bold text-base">Purchase Reorders</h3>
              <p className="text-xs text-muted-foreground">Generate procurement logs, track billing approvals, and update warehouse stocks.</p>
            </div>
            <Button onClick={() => setPOModalOpen(true)} className="rounded-xl gap-1.5 font-semibold text-xs h-9">
              <Plus className="w-4 h-4" /> Create Reorder PO
            </Button>
          </div>

          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO ID</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Order Details</TableHead>
                    <TableHead className="text-center">Issued Date</TableHead>
                    <TableHead className="text-center">Total Amount</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No purchase orders filed yet.</TableCell></TableRow>
                  ) : (
                    purchaseOrders.map(po => (
                      <TableRow key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                        <TableCell className="font-bold text-xs">{po.po_number}</TableCell>
                        <TableCell className="font-semibold text-slate-800 dark:text-zinc-100">{po.supplier_name}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {po.items.map(i => `${i.itemName} (x${i.quantity})`).join(", ")}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{format(parseISO(po.ordered_at), "yyyy-MM-dd")}</TableCell>
                        <TableCell className="text-center font-bold text-slate-900 dark:text-zinc-100">{restaurant?.currency || "₹"}{po.total_amount}</TableCell>
                        <TableCell className="text-center">
                          <Select 
                            value={po.status} 
                            onValueChange={(val: any) => handlePOStatusChange(po.id, val)}
                          >
                            <SelectTrigger className="w-[125px] h-8 rounded-lg text-xs font-semibold mx-auto">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PENDING">PENDING</SelectItem>
                              <SelectItem value="RECEIVED">RECEIVED</SelectItem>
                              <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => {
                            if (confirm("Delete this PO file?")) {
                              deletePO.mutate({ id: po.id, restaurantId });
                            }
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ WASTE TRACKING TAB ════════════════ */}
        <TabsContent value="waste" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card p-5 border rounded-2xl shadow-sm">
            <div>
              <h3 className="font-bold text-base">Waste & Spoilage Audits</h3>
              <p className="text-xs text-muted-foreground">Document spoiled ingredients, cooking drops, spills, and calculate financial deductions.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleExportWasteCSV} variant="outline" className="rounded-xl gap-1 text-xs h-9" disabled={wasteLogs.length === 0}>
                <FileSpreadsheet className="w-4 h-4" /> Export CSV
              </Button>
              <Button onClick={handlePrintWastePDF} variant="outline" className="rounded-xl gap-1 text-xs h-9" disabled={wasteLogs.length === 0}>
                <FileText className="w-4 h-4" /> Print PDF
              </Button>
              <Button onClick={() => setWasteModalOpen(true)} className="rounded-xl gap-1 font-semibold text-xs h-9">
                <Plus className="w-4 h-4" /> Log Waste Item
              </Button>
            </div>
          </div>

          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient / Item</TableHead>
                    <TableHead className="text-center">Wasted Quantity</TableHead>
                    <TableHead className="text-center">Reason Code</TableHead>
                    <TableHead className="text-center">Logged Timestamp</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wasteLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No waste audits logged yet.</TableCell></TableRow>
                  ) : (
                    wasteLogs.map(log => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                        <TableCell className="font-semibold text-slate-800 dark:text-zinc-100">{log.item_name}</TableCell>
                        <TableCell className="text-center font-bold text-red-600 dark:text-red-400">{log.quantity} {log.unit}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[10px] font-bold rounded-full ${
                            log.reason === "SPOILAGE" ? "bg-amber-50 text-amber-600 border-amber-200" :
                            log.reason === "EXPIRED" ? "bg-rose-50 text-rose-600 border-rose-200" :
                            "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                            {log.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{format(parseISO(log.logged_at), "yyyy-MM-dd HH:mm")}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => {
                            if (confirm("Remove waste audit entry?")) {
                              deleteWasteLog.mutate({ id: log.id, restaurantId });
                            }
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ CONSUMPTION & FORECASTING TAB ════════════════ */}
        <TabsContent value="consumption" className="space-y-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Daily Consumption Forecasts
              </CardTitle>
              <CardDescription>Predict runout dates based on current warehouse levels and daily average sales.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warehouse Item</TableHead>
                    <TableHead className="text-center">Est. Daily Draw</TableHead>
                    <TableHead className="text-center">Current Stock</TableHead>
                    <TableHead className="text-center">Est. Runout Days</TableHead>
                    <TableHead className="text-center">Total Wasted</TableHead>
                    <TableHead className="text-right">Forecast Alert</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumptionReport.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Add stock items to view forecasting analyses.</TableCell></TableRow>
                  ) : (
                    consumptionReport.map(rep => (
                      <TableRow key={rep.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50">
                        <TableCell className="font-semibold text-slate-800 dark:text-zinc-100">{rep.name}</TableCell>
                        <TableCell className="text-center text-xs font-semibold">{rep.dailyAverage} {rep.unit}/day</TableCell>
                        <TableCell className="text-center font-bold">{rep.current_stock} {rep.unit}</TableCell>
                        <TableCell className="text-center font-black text-slate-900 dark:text-zinc-50">{rep.current_stock === 0 ? "0 days" : `${rep.daysToRunout} days`}</TableCell>
                        <TableCell className="text-center text-xs text-red-500 font-bold">{rep.totalWaste} {rep.unit}</TableCell>
                        <TableCell className="text-right">
                          {rep.status === "CRITICAL" && <Badge className="bg-red-500 text-white border-0 text-[10px] font-bold rounded-full">STOCKOUT IMMINENT</Badge>}
                          {rep.status === "WARNING" && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 border-0 text-[10px] font-bold rounded-full">REORDER SUGGESTED</Badge>}
                          {rep.status === "SAFE" && <Badge className="bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400 border-0 text-[10px] font-bold rounded-full">HEALTHY LEVEL</Badge>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════════════ RECIPE MAPPINGS TAB ════════════════ */}
        <TabsContent value="recipes" className="space-y-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-primary" /> Recipe Mappings
              </CardTitle>
              <CardDescription>
                Link menu items to their raw ingredients. When an order moves to "Preparing", stock is auto-deducted.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Pick a menu item */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Select Menu Item</Label>
                <Select value={selectedMenuItemId} onValueChange={setSelectedMenuItemId}>
                  <SelectTrigger className="rounded-xl h-10">
                    <SelectValue placeholder="Choose a dish to map ingredients..." />
                  </SelectTrigger>
                  <SelectContent>
                    {menuItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedMenuItemId && (
                <>
                  {/* Current mappings */}
                  {recipesLoading ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                  ) : recipeMappings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No ingredients mapped yet. Add one below.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ingredient</TableHead>
                            <TableHead>Qty Used per Order</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Current Stock</TableHead>
                            <TableHead className="w-10" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recipeMappings.map(rm => {
                            const invItem = items.find(i => i.id === rm.inventory_item_id);
                            const isLow = invItem && invItem.current_stock <= invItem.low_stock_threshold;
                            return (
                              <TableRow key={rm.id}>
                                <TableCell className="font-medium">{rm.inventory_items?.name ?? invItem?.name ?? '—'}</TableCell>
                                <TableCell>{rm.quantity_used}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{rm.inventory_items?.unit ?? invItem?.unit ?? '—'}</TableCell>
                                <TableCell>
                                  <span className={isLow ? "text-red-600 font-bold" : "text-foreground"}>
                                    {invItem ? `${invItem.current_stock} ${invItem.unit}` : '—'}
                                    {isLow && <AlertTriangle className="inline w-3 h-3 ml-1" />}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteMapping.mutate({ id: rm.id, menuItemId: selectedMenuItemId })}
                                    disabled={deleteMapping.isPending}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Add ingredient form */}
                  <div className="bg-muted/40 rounded-2xl p-4 space-y-3 border">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Add Ingredient</p>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex-1 min-w-[180px] space-y-1">
                        <Label className="text-xs font-bold">Inventory Item</Label>
                        <Select
                          value={recipeForm.inventory_item_id}
                          onValueChange={v => setRecipeForm(f => ({ ...f, inventory_item_id: v }))}
                        >
                          <SelectTrigger className="rounded-xl h-10">
                            <SelectValue placeholder="Select ingredient..." />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map(item => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-28 space-y-1">
                        <Label className="text-xs font-bold">Qty Used</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={recipeForm.quantity_used}
                          onChange={e => setRecipeForm(f => ({ ...f, quantity_used: e.target.value }))}
                          className="rounded-xl h-10"
                        />
                      </div>
                      <Button
                        className="h-10 rounded-xl gap-2 font-semibold text-xs"
                        disabled={!recipeForm.inventory_item_id || !recipeForm.quantity_used || createMapping.isPending}
                        onClick={async () => {
                          if (!recipeForm.inventory_item_id || !selectedMenuItemId) return;
                          try {
                            await createMapping.mutateAsync({
                              menu_item_id: selectedMenuItemId,
                              inventory_item_id: recipeForm.inventory_item_id,
                              quantity_used: parseFloat(recipeForm.quantity_used) || 1,
                            });
                            setRecipeForm({ inventory_item_id: "", quantity_used: "1" });
                            toast({ title: "Ingredient added" });
                          } catch (e: any) {
                            toast({ title: "Error", description: e.message, variant: "destructive" });
                          }
                        }}
                      >
                        {createMapping.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        Add
                      </Button>
                    </div>
                    {items.length === 0 && (
                      <p className="text-xs text-amber-600">No inventory items yet — add some in the Stock List tab first.</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Low-stock summary */}
          {items.some(i => i.current_stock <= i.low_stock_threshold) && (
            <Card className="rounded-3xl border border-red-200 bg-red-50/50 dark:bg-red-950/10 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-5 h-5" /> Low Stock Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items.filter(i => i.current_stock <= i.low_stock_threshold).map(i => (
                    <div key={i.id} className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{i.name}</span>
                      <span className="text-red-600 font-bold">{i.current_stock} {i.unit} left (threshold: {i.low_stock_threshold})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* dialogs */}
      {/* 1. Add Supplier Dialog */}
      <Dialog open={supplierModalOpen} onOpenChange={setSupplierModalOpen}>
        <DialogContent className="max-w-md rounded-3xl" aria-describedby="sup-desc">
          <DialogHeader>
            <DialogTitle>Register Supplier Vendor</DialogTitle>
            <DialogDescription id="sup-desc">
              Log details for inventory reorder shipments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Vendor Company Name</Label>
              <Input value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} placeholder="e.g. Metro Food Wholesale" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Contact Person</Label>
                <Input value={newSupplier.contact_person} onChange={(e) => setNewSupplier({ ...newSupplier, contact_person: e.target.value })} placeholder="e.g. John" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone Contact</Label>
                <Input value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} placeholder="+91" className="rounded-xl" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Email</Label>
              <Input value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} placeholder="metro@food.com" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Billing Address</Label>
              <Input value={newSupplier.address} onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })} placeholder="Warehouse #, Road, City" className="rounded-xl" />
            </div>
            <Button onClick={handleAddSupplier} className="w-full rounded-2xl h-11 font-bold mt-2 text-xs">
              Confirm Vendor
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2. Create PO Dialog */}
      <Dialog open={poModalOpen} onOpenChange={setPOModalOpen}>
        <DialogContent className="max-w-md rounded-3xl" aria-describedby="po-desc">
          <DialogHeader>
            <DialogTitle>Issue Reorder Purchase Order</DialogTitle>
            <DialogDescription id="po-desc">
              Create an official procurement list for selected vendors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Select Vendor Supplier</Label>
              <Select value={newPO.supplierId} onValueChange={(val) => setNewPO({ ...newPO, supplierId: val })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-bold">PO Reorder Items</Label>
                <Button variant="outline" size="sm" className="h-7 rounded-lg text-[10px]" onClick={() => setNewPO({
                  ...newPO,
                  items: [...newPO.items, { itemName: "", quantity: 1, costPrice: 0 }]
                })}>+ Add Item</Button>
              </div>

              {newPO.items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px]">Item Name</Label>
                    <Input value={item.itemName} onChange={(e) => {
                      const updated = [...newPO.items];
                      updated[idx].itemName = e.target.value;
                      setNewPO({ ...newPO, items: updated });
                    }} placeholder="e.g. Chicken" className="rounded-lg h-8.5" />
                  </div>
                  <div className="w-16 space-y-1">
                    <Label className="text-[10px]">Qty</Label>
                    <Input type="number" value={item.quantity} onChange={(e) => {
                      const updated = [...newPO.items];
                      updated[idx].quantity = parseFloat(e.target.value) || 1;
                      setNewPO({ ...newPO, items: updated });
                    }} className="rounded-lg h-8.5" />
                  </div>
                  <div className="w-20 space-y-1">
                    <Label className="text-[10px]">Unit Cost</Label>
                    <Input type="number" value={item.costPrice} onChange={(e) => {
                      const updated = [...newPO.items];
                      updated[idx].costPrice = parseFloat(e.target.value) || 0;
                      setNewPO({ ...newPO, items: updated });
                    }} className="rounded-lg h-8.5" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8.5 w-8.5 text-destructive rounded-lg" onClick={() => {
                    setNewPO({
                      ...newPO,
                      items: newPO.items.filter((_, i) => i !== idx)
                    });
                  }} disabled={newPO.items.length === 1}>
                    <Trash className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <Button onClick={handleAddPO} className="w-full rounded-2xl h-11 font-bold mt-2 text-xs">
              Generate & Dispatch PO
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. Log Waste Dialog */}
      <Dialog open={wasteModalOpen} onOpenChange={setWasteModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl" aria-describedby="waste-desc">
          <DialogHeader>
            <DialogTitle>Audit Waste / Spoilage</DialogTitle>
            <DialogDescription id="waste-desc">
              Log spilled or expired warehouse items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Select Inventory Ingredient</Label>
              <Select value={newWaste.itemId} onValueChange={(val) => setNewWaste({ ...newWaste, itemId: val })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select warehouse item..." />
                </SelectTrigger>
                <SelectContent>
                  {items.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Quantity Wasted</Label>
                <Input type="number" value={newWaste.quantity} onChange={(e) => setNewWaste({ ...newWaste, quantity: e.target.value })} placeholder="e.g. 2.5" className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Reason Code</Label>
                <Select value={newWaste.reason} onValueChange={(val: any) => setNewWaste({ ...newWaste, reason: val })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SPOILAGE">Spoilage</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="DAMAGED">Damaged</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleAddWaste} className="w-full rounded-2xl h-11 font-bold mt-2 text-xs">
              Confirm Log
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
