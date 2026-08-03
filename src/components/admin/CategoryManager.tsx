import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ImageIcon,
  Camera,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from "@/hooks/useCategories";

type CategoryWithSchedule = Category & {
  available_from?: string | null;
  available_until?: string | null;
};

interface CategoryManagerProps {
  restaurantId: string;
}

/** Tiny inline image uploader */
function CategoryImageUpload({
  categoryId,
  restaurantId,
  currentUrl,
  onUploaded,
}: {
  categoryId: string;
  restaurantId: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${restaurantId}/categories/${categoryId}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("menu-images")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(data.path);
      onUploaded(urlData.publicUrl + `?t=${Date.now()}`);
      toast({ title: "Image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="relative group shrink-0">
      <input type="file" ref={fileRef} onChange={handleFile} accept="image/jpeg,image/png,image/webp" className="hidden" />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="relative w-10 h-10 rounded-lg overflow-hidden border-2 border-dashed border-border hover:border-primary transition-all bg-muted/50 flex items-center justify-center"
        title="Upload category image"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        ) : currentUrl ? (
          <>
            <img src={currentUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-3 h-3 text-white" />
            </div>
          </>
        ) : (
          <ImageIcon className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

/** Format "HH:MM:SS" → "h:MM AM/PM" */
function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Schedule Dialog */
function ScheduleDialog({
  category,
  open,
  onOpenChange,
  onSave,
}: {
  category: CategoryWithSchedule | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (id: string, from: string | null, until: string | null) => Promise<void>;
}) {
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Sync state when dialog opens for a category
  const prevId = useRef<string | null>(null);
  if (category && category.id !== prevId.current) {
    prevId.current = category.id;
    setFrom(category.available_from || "");
    setUntil(category.available_until || "");
  }

  const handleSave = async () => {
    if (!category) return;
    if (from && !until) { toast({ title: "Please set an end time", variant: "destructive" }); return; }
    if (!from && until) { toast({ title: "Please set a start time", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await onSave(category.id, from || null, until || null);
      toast({
        title: from ? "Schedule saved" : "Schedule cleared",
        description: from
          ? `${category.name} will be available ${fmtTime(from)} – ${fmtTime(until)}`
          : `${category.name} is now available all day`,
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!category) return;
    setSaving(true);
    try {
      await onSave(category.id, null, null);
      toast({ title: "Schedule cleared", description: `${category.name} is now available all day` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Availability Hours
          </DialogTitle>
          <DialogDescription>
            Set the hours when <strong>{category?.name}</strong> items appear to customers.
            Leave both empty for all-day availability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Time pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Start time</label>
              <Input
                type="time"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">End time</label>
              <Input
                type="time"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          {/* Preview */}
          {from && until && (
            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <p className="text-sm font-semibold text-primary">
                {category?.name} available {fmtTime(from)} – {fmtTime(until)}
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Cross-midnight ranges are supported — e.g. set 22:00 → 02:00 for a late-night menu.
          </p>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save
            </Button>
            {(category?.available_from || category?.available_until) && (
              <Button variant="outline" onClick={handleClear} disabled={saving} className="text-destructive hover:text-destructive border-destructive/30">
                Remove
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const CategoryManager = ({ restaurantId }: CategoryManagerProps) => {
  const { data: categories = [], isLoading } = useCategories(restaurantId);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [scheduleTarget, setScheduleTarget] = useState<CategoryWithSchedule | null>(null);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast({ title: "Enter a name", variant: "destructive" });
      return;
    }
    try {
      await createCategory.mutateAsync({ restaurant_id: restaurantId, name, display_order: categories.length });
      setNewCategoryName("");
      toast({ title: "Category added" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Delete "${category.name}"? This will affect all items in this category.`)) return;
    try {
      await deleteCategory.mutateAsync({ id: category.id, restaurantId });
      toast({ title: "Category deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleImageUploaded = async (categoryId: string, url: string) => {
    try {
      await updateCategory.mutateAsync({ id: categoryId, updates: { image_url: url } });
    } catch (error: any) {
      toast({ title: "Error saving image", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveSchedule = async (categoryId: string, from: string | null, until: string | null) => {
    await updateCategory.mutateAsync({
      id: categoryId,
      updates: { available_from: from as any, available_until: until as any },
    });
  };

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <GripVertical className="w-5 h-5" />
            Categories ({categories.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click <Clock className="w-3 h-3 inline mx-0.5" /> to set hours when a category is available — items auto-hide outside that window.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="flex gap-2">
            <Input
              placeholder="New category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            />
            <Button onClick={handleAddCategory} disabled={createCategory.isPending} size="icon">
              {createCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {/* List */}
          <div className="space-y-2">
            {categories.map((category, index) => {
              const cat = category as CategoryWithSchedule;
              const hasSchedule = !!(cat.available_from && cat.available_until);

              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted/40 transition-colors"
                >
                  {/* Index */}
                  <span className="text-xs font-bold text-muted-foreground w-5 text-center shrink-0">
                    {index + 1}
                  </span>

                  {/* Image */}
                  <CategoryImageUpload
                    categoryId={cat.id}
                    restaurantId={restaurantId}
                    currentUrl={cat.image_url ?? null}
                    onUploaded={(url) => handleImageUploaded(cat.id, url)}
                  />

                  {/* Name + schedule badge */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{cat.name}</p>
                    {hasSchedule && (
                      <p className="text-[11px] text-primary flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {fmtTime(cat.available_from)} – {fmtTime(cat.available_until)}
                      </p>
                    )}
                  </div>

                  {/* Clock button */}
                  <Button
                    size="icon"
                    variant={hasSchedule ? "outline" : "ghost"}
                    className={`h-8 w-8 shrink-0 ${hasSchedule ? "text-primary border-primary/30 hover:border-primary/60" : ""}`}
                    title={hasSchedule ? "Edit schedule" : "Set availability hours"}
                    onClick={() => setScheduleTarget(cat)}
                  >
                    <Clock className="w-4 h-4" />
                  </Button>

                  {/* Delete */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleDelete(cat)}
                    disabled={deleteCategory.isPending}
                  >
                    {deleteCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </div>
              );
            })}

            {categories.length === 0 && (
              <p className="text-center py-6 text-muted-foreground text-sm">No categories yet. Add one above.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule dialog — rendered outside the card so it's never clipped */}
      <ScheduleDialog
        category={scheduleTarget}
        open={!!scheduleTarget}
        onOpenChange={(v) => { if (!v) setScheduleTarget(null); }}
        onSave={handleSaveSchedule}
      />
    </>
  );
};
