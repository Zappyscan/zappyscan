import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Search, Eye, MoreHorizontal, Power, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

type Restaurant = Tables<"restaurants">;
type SubscriptionTier = "free" | "pro" | "enterprise";

interface TenantTableProps {
  restaurants: Restaurant[];
  onToggleActive: (id: string, currentValue: boolean) => void;
  onChangeTier: (id: string, tier: SubscriptionTier) => void;
  onToggleAds?: (id: string, currentValue: boolean) => void;
  onViewDetails?: (id: string) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  metrics?: Record<string, { tableCount: number; orderCount: number }>;
}

export function TenantTable({ 
  restaurants, 
  onToggleActive, 
  onChangeTier,
  onToggleAds,
  onViewDetails,
  onDelete,
  metrics
}: TenantTableProps) {
  const { impersonateRestaurant } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const filteredRestaurants = useMemo(() => {
    let filtered = restaurants;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.slug.toLowerCase().includes(query) ||
          r.email?.toLowerCase().includes(query)
      );
    }
    
    if (tierFilter !== "all") {
      filtered = filtered.filter((r) => r.subscription_tier === tierFilter);
    }
    
    return filtered;
  }, [restaurants, searchQuery, tierFilter]);


  const getStatusBadge = (isActive: boolean | null) => {
    return isActive ? (
      <Badge variant="outline" className="border-green-500 text-green-600">Active</Badge>
    ) : (
      <Badge variant="outline" className="border-red-500 text-red-600">Inactive</Badge>
    );
  };

  return (
    <Card className="border-0 shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>All Tenants</CardTitle>
            <CardDescription>
              {filteredRestaurants.length} of {restaurants.length} restaurants
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
              />
            </div>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {/* overflow-x-auto ensures the table scrolls horizontally on tablet/mobile
            instead of clipping. min-w forces the table to maintain readable column widths. */}
        <div className="rounded-lg border overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold min-w-[160px]">Restaurant</TableHead>
                {/* Slug hidden on small tablets; visible from lg up */}
                <TableHead className="font-semibold hidden lg:table-cell">Slug</TableHead>
                <TableHead className="font-semibold min-w-[120px]">Plan</TableHead>
                <TableHead className="font-semibold text-center w-16">Tables</TableHead>
                <TableHead className="font-semibold text-center w-16">Orders</TableHead>
                <TableHead className="font-semibold text-center w-16">Ads</TableHead>
                <TableHead className="font-semibold text-center w-20">Status</TableHead>
                {/* Created date hidden below xl */}
                <TableHead className="font-semibold hidden xl:table-cell">Created</TableHead>
                <TableHead className="font-semibold text-right w-12">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRestaurants.map((restaurant) => (
                <TableRow key={restaurant.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div>
                      <p className="font-medium leading-tight">{restaurant.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {restaurant.email || "No email"}
                      </p>
                      {/* Show slug inline on tablet when the Slug column is hidden */}
                      <code className="text-[10px] text-muted-foreground bg-muted px-1 rounded lg:hidden">
                        {restaurant.slug}
                      </code>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {restaurant.slug}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={restaurant.subscription_tier || "free"}
                      onValueChange={(v: SubscriptionTier) => onChangeTier(restaurant.id, v)}
                    >
                      <SelectTrigger className="w-[105px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="font-semibold text-center">
                    {metrics?.[restaurant.id]?.tableCount ?? 0}
                  </TableCell>
                  <TableCell className="font-semibold text-center">
                    {metrics?.[restaurant.id]?.orderCount ?? 0}
                  </TableCell>
                  {/* Ads — Switch only on tablet; badge shown on hover via title */}
                  <TableCell className="text-center">
                    {onToggleAds ? (
                      <Switch
                        checked={restaurant.ads_enabled ?? true}
                        onCheckedChange={() => onToggleAds(restaurant.id, restaurant.ads_enabled ?? true)}
                        title={restaurant.ads_enabled !== false ? "Ads enabled" : "Ads disabled"}
                      />
                    ) : (
                      <Badge variant="outline" className={`text-xs ${restaurant.ads_enabled !== false ? 'border-primary/50 text-primary' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                        {restaurant.ads_enabled !== false ? 'On' : 'Off'}
                      </Badge>
                    )}
                  </TableCell>
                  {/* Status — Switch + compact badge */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={restaurant.is_active ?? false}
                        onCheckedChange={() => onToggleActive(restaurant.id, restaurant.is_active ?? false)}
                      />
                      <span className={`text-[10px] font-medium ${restaurant.is_active ? 'text-green-600' : 'text-red-500'}`}>
                        {restaurant.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden xl:table-cell whitespace-nowrap">
                    {restaurant.created_at
                      ? format(new Date(restaurant.created_at), "MMM d, yyyy")
                      : "--"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onViewDetails && (
                          <DropdownMenuItem onClick={() => onViewDetails(restaurant.id)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            impersonateRestaurant(restaurant.id);
                            navigate("/admin");
                          }}
                          className="text-purple-600 font-semibold"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Impersonate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onToggleActive(restaurant.id, restaurant.is_active ?? false)}
                        >
                          <Power className="w-4 h-4 mr-2" />
                          {restaurant.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        {onDelete && (
                          <DropdownMenuItem
                            onClick={() => onDelete(restaurant.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRestaurants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No restaurants found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
