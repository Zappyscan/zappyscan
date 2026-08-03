import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  Loader2,
  ImageIcon,
  Camera,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  type Category,
} from "@/hooks/useCategories";

// Extended type for schedule fields not yet in generated types
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
      toast({ title: "Image uploaded successfully" });
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
        className="relative w-12 h-12 rounded-lg overflow-hidden border-2 border-dashed border-border hover:border-primary transition-all bg-muted/55 hover:bg-primary/5 flex items-center justify-center"
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

/** Inline time-schedule editor for a single category */
function CategoryScheduleEditor({
  category,
  onSave,
  onClose,
}: {
  category: CategoryWithSchedule;
  onSave: (from: string | null, until: string | null) => Promise<void>;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(category.available_from || "");
  const [until, setUntil] = useState(category.available_until || "");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (from && !until) {
      toast({ title: "Set an end time too", variant: "destructive" });
      return;
    }
    if (!from && until) {
      toast({ title: "Set a start time too", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave(from || null, until || null);
      toast({ title: "Schedule saved", description: from ? `${category.name} available ${from}–${until}` : `${category.name} always available` });
      onClose();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onSave(null, null);
      toast({ title: "Schedule cleared", description: `${category.name} is now always available` });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 mb-1 ml-8 p-3 rounded-xl bg-muted/60 border border-border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Set availability window for <span className="text-foreground">{category.name}</span>
      </p>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground mb-1 block">From</label>
          <Input
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <span className="text-muted-foreground mt-4 shrink-0">→</span>
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground mb-1 block">Until</label>
          <Input
            type="time"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Leave both empty to make this category available all day.
        Cross-midnight ranges are supported (e.g. 22:00 → 02:00).
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs">
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Save
        </Button>
        {(category.available_from || category.available_until) && (
          <Button size="sm" variant="outline" onClick={handleClear} disabled={saving} className="h-8 text-xs text-destructive hover:text-destructive">
            Always available (clear)
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs ml-auto">
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** Format a TIME string "HH:MM:SS" → "H:MM AM/PM" */
function fmtTime(t: string | null | undefined): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const CategoryManager = ({ restaurantId }: CategoryManagerProps) => {
  const { data: categories = [], isLoading } = useCategories(restaurantId);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();

  const [newCategoryName, setNewCategoryName] = useState("");
  const [expandedSchedule, setExpandedSchedule] = useState<string | null>(null);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast({ title: "Enter a name", description: "Category name is required.", variant: "destructive" });
      return;
    }
    try {
      await createCategory.mutateAsync({ restaurant_id: restaurantId, name, display_order: categories.length });
      setNewCategoryName("");
      toast({ title: "Category added", description: `"${name}" has been created.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create category.", variant: "destructive" });
    }
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This will affect all menu items in this category.`)) return;
    try {
      await deleteCategory.mutateAsync({ id: category.id, restaurantId });
      toast({ title: "Category deleted", description: `"${category.name}" has been removed.` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete category.", variant: "destructive" });
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
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <GripVertical className="w-5 h-5" />
          Categories ({categories.length})
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload a photo per category, and optionally set a <strong>time window</strong> — items in that category will only be available during those hours.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new category */}
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

        {/* Category list */}
        <div className="space-y-1">
          {categories.map((category, index) => {
            const cat = category as CategoryWithSchedule;
            const hasSchedule = !!(cat.available_from && cat.available_until);
            const isOpen = expandedSchedule === cat.id;

            return (
              <div key={cat.id}>
                {/* Main row */}
                <div className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <Badge variant="outline" className="w-6 h-6 flex items-center justify-center p-0 shrink-0">
                    {index + 1}
                  </Badge>

                  <CategoryImageUpload
                    categoryId={cat.id}
                    restaurantId={restaurantId}
                    currentUrl={cat.image_url ?? null}
                    onUploaded={(url) => handleImageUploaded(cat.id, url)}
                  />

                  <span className="flex-1 font-medium">{cat.name}</span>

                  {/* Schedule badge */}
                  {hasSchedule && !isOpen && (
                    <Badge variant="secondary" className="text-[11px] gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {fmtTime(cat.available_from)} – {fmtTime(cat.available_until)}
                    </Badge>
                  )}

                  {/* Clock / schedule toggle */}
                  <Button
                    size="icon"
                    variant={isOpen ? "default" : hasSchedule ? "outline" : "ghost"}
                    className={`h-8 w-8 shrink-0 ${hasSchedule && !isOpen ? "text-primary border-primary/40" : ""}`}
                    title={hasSchedule ? "Edit schedule" : "Set availability time"}
                    onClick={() => setExpandedSchedule(isOpen ? null : cat.id)}
                  >
                    {isOpen ? <X className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </Button>

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

                {/* Inline schedule editor */}
                {isOpen && (
                  <CategoryScheduleEditor
                    category={cat}
                    onSave={(from, until) => handleSaveSchedule(cat.id, from, until)}
                    onClose={() => setExpandedSchedule(null)}
                  />
                )}
              </div>
            );
          })}

          {categories.length === 0 && (
            <p className="text-center py-4 text-muted-foreground text-sm">No categories yet. Add one above.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
