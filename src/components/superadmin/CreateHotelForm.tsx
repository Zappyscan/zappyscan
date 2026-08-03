import { useState, useRef, useEffect } from 'react';
import {
  Loader2, Check, Copy, Building2, Key, Shield, Wand2, Upload, Palette,
  Settings, ImageIcon, X, CreditCard, Smartphone, Landmark, Link2,
  RefreshCw, CheckCircle2, ExternalLink, IndianRupee, CalendarDays, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/integrations/supabase/functions';

interface CreateHotelFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface Credentials {
  email: string;
  username: string;
  password: string;
  login_url: string;
}

const CUISINE_OPTIONS = [
  'South Indian', 'North Indian', 'Chinese', 'Continental', 'Multi-cuisine',
  'Café', 'Bakery', 'Fine Dining', 'QSR', 'Italian', 'Japanese', 'Mexican',
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Lora', label: 'Lora' },
];

const BUTTON_STYLES = [
  { value: 'rounded', label: 'Rounded', desc: 'Soft UI corners' },
  { value: 'sharp', label: 'Sharp', desc: 'Enterprise look' },
  { value: 'pill', label: 'Pill', desc: 'Modern SaaS' },
  { value: 'glass', label: 'Glass', desc: 'Premium frosted' },
];

// ── Pricing ──────────────────────────────────────────────────────────────────

const PLAN_PRICING = {
  pro:        { monthly: 1999,  annual: 19999,  save: 3989 },
  enterprise: { monthly: 4999,  annual: 49999,  save: 9989 },
};

const PLAN_FEATURES = {
  free:       ['Up to 5 tables', 'Basic menu', 'QR ordering', 'Email support'],
  pro:        ['Unlimited tables', 'Online orders', 'Analytics', 'PWA install', 'Priority support'],
  enterprise: ['Everything in Pro', 'Multi-branch', 'White-label', 'API access', 'Dedicated support'],
};

// ── Payment result type ───────────────────────────────────────────────────────

interface PaymentResult {
  subscription_id: string;
  payment_link: string;
  amount: number;
  billing_cycle: string;
  tier: string;
}

export function CreateHotelForm({ onSuccess, onCancel }: CreateHotelFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [credentialMode, setCredentialMode] = useState<'auto' | 'manual'>('auto');
  const [activeSection, setActiveSection] = useState('identity');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Payment state
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [autopayEnabled, setAutopayEnabled] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'nach' | 'link'>('upi');
  const [upiId, setUpiId] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [createdRestaurantId, setCreatedRestaurantId] = useState<string | null>(null);

  const [form, setForm] = useState({
    // Identity
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    description: '',
    tagline: '',
    established_year: '',
    // Cuisine & Operations
    cuisine_types: [] as string[],
    custom_cuisine: '',
    branch_count: '1',
    table_count: '10',
    avg_seating: '4',
    billing_mode: 'saas',
    kitchen_screens: false,
    printer_count: '1',
    // Branding
    logo_url: '',
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    accent_color: '#F59E0B',
    font_family: 'Inter',
    button_style: 'rounded',
    // Subscription
    subscription_tier: 'free' as 'free' | 'pro' | 'enterprise',
    // Credentials
    admin_email: '',
    admin_password: '',
    confirm_password: '',
  });

  const toggleCuisine = (cuisine: string) => {
    setForm(prev => ({
      ...prev,
      cuisine_types: prev.cuisine_types.includes(cuisine)
        ? prev.cuisine_types.filter(c => c !== cuisine)
        : [...prev.cuisine_types, cuisine],
    }));
  };

  const addCustomCuisine = () => {
    if (form.custom_cuisine.trim() && !form.cuisine_types.includes(form.custom_cuisine.trim())) {
      setForm(prev => ({
        ...prev,
        cuisine_types: [...prev.cuisine_types, prev.custom_cuisine.trim()],
        custom_cuisine: '',
      }));
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please upload an image.', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Too large', description: 'Max 2MB.', variant: 'destructive' });
      return;
    }
    // Local preview
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `temp-logos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('platform-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('platform-assets').getPublicUrl(path);
      setForm(prev => ({ ...prev, logo_url: pub.publicUrl }));
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.admin_email) {
      toast({ title: 'Missing Fields', description: 'Hotel name and admin email are required.', variant: 'destructive' });
      return;
    }
    if (credentialMode === 'manual') {
      if (!form.admin_password || form.admin_password.length < 8) {
        toast({ title: 'Weak Password', description: 'Password must be at least 8 characters.', variant: 'destructive' });
        return;
      }
      if (form.admin_password !== form.confirm_password) {
        toast({ title: 'Password Mismatch', description: 'Passwords do not match.', variant: 'destructive' });
        return;
      }
    }
    setIsSubmitting(true);
    try {
      // 1. Provision the hotel
      const body = {
        name: form.name,
        slug: form.slug,
        email: form.email,
        phone: form.phone,
        address: form.address,
        cuisine_type: form.cuisine_types.join(', '),
        branch_count: form.branch_count,
        admin_email: form.admin_email,
        admin_password: credentialMode === 'auto' ? '' : form.admin_password,
        logo_url: form.logo_url,
        theme_color: form.primary_color,
        subscription_tier: form.subscription_tier,
        description: form.description,
        tagline: form.tagline,
        secondary_color: form.secondary_color,
        accent_color: form.accent_color,
        font_family: form.font_family,
        button_style: form.button_style,
        table_count: form.table_count,
        avg_seating: form.avg_seating,
        billing_mode: form.billing_mode,
        kitchen_screens: form.kitchen_screens,
        printer_count: form.printer_count,
      };
      const response = await invokeFunction('create-tenant', { body });
      if (response.error) {
        const detail = response.data?.error || response.error.message;
        throw new Error(detail);
      }
      if (response.data?.error) throw new Error(response.data.error);

      const restaurantId = response.data?.restaurant_id as string | undefined;
      setCreatedRestaurantId(restaurantId ?? null);
      setCredentials(response.data.credentials);

      // 2. If paid tier, create Razorpay subscription
      if (form.subscription_tier !== 'free' && restaurantId) {
        try {
          const payResp = await invokeFunction('razorpay-subscription', {
            body: {
              action:          'create_subscription',
              restaurant_id:   restaurantId,
              tier:            form.subscription_tier,
              billing_cycle:   billingCycle,
              autopay_enabled: autopayEnabled,
              payment_method:  paymentMethod,
              upi_id:          upiId || undefined,
              billing_name:    billingName || form.name,
              billing_email:   billingEmail || form.admin_email,
              gst_number:      gstNumber || undefined,
              hotel_name:      form.name,
            },
          });
          if (payResp.data && !payResp.data.error) {
            setPaymentResult(payResp.data as PaymentResult);
            toast({
              title: 'Hotel Created + Payment Link Ready!',
              description: `Share the Razorpay link with ${form.name} to complete autopay setup.`,
            });
          } else {
            // Hotel created but payment setup failed — warn but don't block
            toast({
              title: 'Hotel Created',
              description: `Payment link could not be generated: ${payResp.data?.error || 'Razorpay error'}. You can set it up later.`,
              variant: 'destructive',
            });
          }
        } catch (payErr: any) {
          toast({
            title: 'Hotel Created — Payment Setup Skipped',
            description: `Razorpay: ${payErr.message}. Configure API keys in Edge Function secrets.`,
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: 'Hotel Created!', description: `${form.name} has been provisioned successfully.` });
      }

      onSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyAll = () => {
    if (!credentials) return;
    const text = `Email: ${credentials.email}\nUsername: ${credentials.username}\nPassword: ${credentials.password}\nLogin: ${credentials.login_url}`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Credentials copied to clipboard.' });
  };

  if (credentials) {
    return (
      <div className="space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Key className="w-5 h-5" />
              Admin Credentials Created
            </CardTitle>
            <CardDescription>Share these credentials with the hotel admin. They won't be shown again.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-background rounded-lg border">
              <div><span className="text-xs text-muted-foreground">Email</span><p className="font-mono text-sm">{credentials.email}</p></div>
              <div><span className="text-xs text-muted-foreground">Username</span><p className="font-mono text-sm">{credentials.username}</p></div>
              <div><span className="text-xs text-muted-foreground">Password</span><p className="font-mono text-sm">{credentials.password}</p></div>
              <div><span className="text-xs text-muted-foreground">Login URL</span><p className="font-mono text-sm">{credentials.login_url}</p></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={copyAll} variant="outline"><Copy className="w-4 h-4 mr-2" />Copy All</Button>
              <Button onClick={onCancel}>Done</Button>
            </div>
          </CardContent>
        </Card>

        {/* Payment link card */}
        {paymentResult && (
          <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" /> Razorpay Subscription Created
              </CardTitle>
              <CardDescription>
                Share this payment link with the hotel owner to complete their{' '}
                {autopayEnabled ? 'autopay mandate' : 'first payment'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Plan summary */}
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 rounded-full text-emerald-700 dark:text-emerald-300 font-semibold">
                  {paymentResult.tier.charAt(0).toUpperCase() + paymentResult.tier.slice(1)} Plan
                </span>
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 rounded-full text-emerald-700 dark:text-emerald-300">
                  ₹{paymentResult.amount.toLocaleString()} / {paymentResult.billing_cycle}
                </span>
                {autopayEnabled && (
                  <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 rounded-full text-blue-700 dark:text-blue-300 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Autopay enabled
                  </span>
                )}
              </div>

              {/* Payment link */}
              <div className="flex items-center gap-2 p-3 bg-white dark:bg-zinc-900 rounded-xl border">
                <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-mono truncate flex-1">{paymentResult.payment_link}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 rounded-lg"
                  onClick={() => { navigator.clipboard.writeText(paymentResult.payment_link); toast({ title: 'Link copied!' }); }}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  className="shrink-0 rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => window.open(paymentResult.payment_link, '_blank')}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                The hotel owner will be charged automatically every {paymentResult.billing_cycle === 'annual' ? 'year' : 'month'} after completing the payment mandate.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />Create New Hotel</CardTitle>
        <CardDescription>Fill in the details to provision a new tenant with admin credentials.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={activeSection} onValueChange={setActiveSection}>
          <div className="overflow-x-auto pb-1">
          <TabsList className="grid grid-cols-5 w-full min-w-[560px]">
            <TabsTrigger value="identity"    className="gap-1.5 text-xs"><Building2    className="w-3.5 h-3.5" />Identity</TabsTrigger>
            <TabsTrigger value="operations"  className="gap-1.5 text-xs"><Settings     className="w-3.5 h-3.5" />Operations</TabsTrigger>
            <TabsTrigger value="branding"    className="gap-1.5 text-xs"><Palette      className="w-3.5 h-3.5" />Branding</TabsTrigger>
            <TabsTrigger value="credentials" className="gap-1.5 text-xs"><Key         className="w-3.5 h-3.5" />Credentials</TabsTrigger>
            <TabsTrigger value="payment"     className="gap-1.5 text-xs">
              <CreditCard className="w-3.5 h-3.5" />Payment
              {form.subscription_tier !== 'free' && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              )}
            </TabsTrigger>
          </TabsList>
          </div>

          {/* Section A: Identity */}
          <TabsContent value="identity" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Hotel Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })} placeholder="Grand Palace" />
              </div>
              <div className="space-y-2">
                <Label>Slug / URL</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="grand-palace" />
              </div>
              <div className="space-y-2">
                <Label>Subscription</Label>
                <Select value={form.subscription_tier} onValueChange={(v: any) => setForm({ ...form, subscription_tier: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 9876543210" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@hotel.com" />
              </div>
              <div className="space-y-2">
                <Label>Established Year</Label>
                <Input value={form.established_year} onChange={(e) => setForm({ ...form, established_year: e.target.value })} placeholder="2020" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="123 Main St" />
              </div>
              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Taste the tradition" />
              </div>
              <div className="space-y-2 md:col-span-3">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of the restaurant..." rows={2} />
              </div>
            </div>

            {/* Cuisine Multi-Select */}
            <div className="space-y-2">
              <Label>Cuisine Types</Label>
              <div className="flex flex-wrap gap-2">
                {CUISINE_OPTIONS.map(c => (
                  <Badge
                    key={c}
                    variant={form.cuisine_types.includes(c) ? 'default' : 'outline'}
                    className="cursor-pointer transition-all hover:shadow-sm"
                    onClick={() => toggleCuisine(c)}
                  >
                    {c}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={form.custom_cuisine}
                  onChange={(e) => setForm({ ...form, custom_cuisine: e.target.value })}
                  placeholder="Add custom cuisine..."
                  className="max-w-xs"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomCuisine())}
                />
                <Button type="button" size="sm" variant="outline" onClick={addCustomCuisine}>Add</Button>
              </div>
            </div>
          </TabsContent>

          {/* Section B: Operations */}
          <TabsContent value="operations" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Branch Count</Label>
                <Input type="number" value={form.branch_count} onChange={(e) => setForm({ ...form, branch_count: e.target.value })} min="1" />
              </div>
              <div className="space-y-2">
                <Label>Table Count</Label>
                <Input type="number" value={form.table_count} onChange={(e) => setForm({ ...form, table_count: e.target.value })} min="1" />
              </div>
              <div className="space-y-2">
                <Label>Avg Seating Capacity</Label>
                <Input type="number" value={form.avg_seating} onChange={(e) => setForm({ ...form, avg_seating: e.target.value })} min="1" />
              </div>
              <div className="space-y-2">
                <Label>Billing Mode</Label>
                <Select value={form.billing_mode} onValueChange={(v) => setForm({ ...form, billing_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pos">POS</SelectItem>
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Printer Count</Label>
                <Input type="number" value={form.printer_count} onChange={(e) => setForm({ ...form, printer_count: e.target.value })} min="0" />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Switch checked={form.kitchen_screens} onCheckedChange={(v) => setForm({ ...form, kitchen_screens: v })} />
                <div>
                  <p className="text-sm font-medium">Kitchen Display</p>
                  <p className="text-xs text-muted-foreground">Enable KDS screens</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Section C: Branding */}
          <TabsContent value="branding" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Logo Upload */}
              <div className="space-y-3">
                <Label>Restaurant Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden bg-muted/30">
                    {logoPreview || form.logo_url ? (
                      <img src={logoPreview || form.logo_url} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                      {uploadingLogo ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
                      Upload Logo
                    </Button>
                    {form.logo_url && (
                      <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => { setForm(prev => ({ ...prev, logo_url: '' })); setLogoPreview(null); }}>
                        <X className="w-3 h-3 mr-1" /> Remove
                      </Button>
                    )}
                    <p className="text-xs text-muted-foreground">PNG/SVG, max 2MB, 1:1 ratio</p>
                  </div>
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
              </div>

              {/* Logo URL fallback */}
              <div className="space-y-2">
                <Label>Or Logo URL</Label>
                <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Primary Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="h-10 w-14 p-1" />
                  <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Secondary Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="h-10 w-14 p-1" />
                  <Input value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Accent Color</Label>
                <div className="flex gap-2">
                  <Input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="h-10 w-14 p-1" />
                  <Input value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} className="flex-1" />
                </div>
              </div>
            </div>

            {/* Font & Button Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Font Family</Label>
                <Select value={form.font_family} onValueChange={(v) => setForm({ ...form, font_family: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Button Style</Label>
                <div className="grid grid-cols-2 gap-2">
                  {BUTTON_STYLES.map(bs => (
                    <div
                      key={bs.value}
                      onClick={() => setForm({ ...form, button_style: bs.value })}
                      className={`cursor-pointer p-2.5 rounded-lg border-2 text-center transition-all ${
                        form.button_style === bs.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <p className="text-sm font-medium">{bs.label}</p>
                      <p className="text-[10px] text-muted-foreground">{bs.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Section D: Credentials */}
          <TabsContent value="credentials" className="space-y-4 pt-4" id="credentials-tab">
            <Tabs value={credentialMode} onValueChange={(v) => setCredentialMode(v as 'auto' | 'manual')}>
              <TabsList className="mb-4">
                <TabsTrigger value="auto" className="gap-2"><Wand2 className="w-4 h-4" />Auto-Generate</TabsTrigger>
                <TabsTrigger value="manual" className="gap-2"><Shield className="w-4 h-4" />Set Manually</TabsTrigger>
              </TabsList>

              <TabsContent value="auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Admin Email *</Label>
                    <Input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} placeholder="admin@hotel.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Username (auto)</Label>
                    <Input value={form.slug ? `${form.slug.replace(/-/g, '')}_admin` : ''} disabled className="bg-muted" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">A secure 12-character password will be auto-generated and shown after creation.</p>
              </TabsContent>

              <TabsContent value="manual">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Admin Email *</Label>
                    <Input type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} placeholder="admin@hotel.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Username (auto)</Label>
                    <Input value={form.slug ? `${form.slug.replace(/-/g, '')}_admin` : ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password * (min 8 chars)</Label>
                    <Input type="password" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} placeholder="Min 8 characters" />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password *</Label>
                    <Input type="password" value={form.confirm_password} onChange={(e) => setForm({ ...form, confirm_password: e.target.value })} placeholder="Confirm password" />
                    {form.confirm_password && form.admin_password !== form.confirm_password && (
                      <p className="text-xs text-destructive">Passwords don't match</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Section E: Payment */}
          <TabsContent value="payment" className="space-y-5 pt-4">
            {form.subscription_tier === 'free' ? (
              /* Free plan — no payment needed */
              <div className="text-center py-10">
                <IndianRupee className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-semibold text-lg">No Payment Required</p>
                <p className="text-sm text-muted-foreground mt-1">Free plan has no cost. Upgrade the plan in Identity tab to set up billing.</p>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-lg mx-auto">
                  {(PLAN_FEATURES.free).map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{f}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {/* Plan pricing card */}
                <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-primary/10 p-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Selected Plan</p>
                      <h3 className="text-xl font-black capitalize">{form.subscription_tier}</h3>
                      <ul className="mt-2 space-y-1">
                        {PLAN_FEATURES[form.subscription_tier as keyof typeof PLAN_FEATURES]?.map(f => (
                          <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0" />{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black">
                        ₹{billingCycle === 'annual'
                          ? (PLAN_PRICING[form.subscription_tier as keyof typeof PLAN_PRICING]?.annual ?? 0).toLocaleString()
                          : (PLAN_PRICING[form.subscription_tier as keyof typeof PLAN_PRICING]?.monthly ?? 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">/{billingCycle === 'annual' ? 'year' : 'month'} + GST</p>
                      {billingCycle === 'annual' && (
                        <Badge className="mt-1 bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                          Save ₹{(PLAN_PRICING[form.subscription_tier as keyof typeof PLAN_PRICING]?.save ?? 0).toLocaleString()}/yr
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Billing cycle */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2"><CalendarDays className="w-4 h-4" />Billing Cycle</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['monthly', 'annual'] as const).map(cycle => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => setBillingCycle(cycle)}
                        className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                          billingCycle === cycle
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40'
                        }`}
                      >
                        {cycle === 'annual' && (
                          <span className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 bg-emerald-500 text-white rounded-full">
                            POPULAR
                          </span>
                        )}
                        <p className="font-semibold capitalize">{cycle}</p>
                        <p className="text-2xl font-black mt-1">
                          ₹{cycle === 'annual'
                            ? (PLAN_PRICING[form.subscription_tier as keyof typeof PLAN_PRICING]?.annual ?? 0).toLocaleString()
                            : (PLAN_PRICING[form.subscription_tier as keyof typeof PLAN_PRICING]?.monthly ?? 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cycle === 'annual' ? 'per year' : 'per month'}
                          {cycle === 'annual' && ` — Save ₹${(PLAN_PRICING[form.subscription_tier as keyof typeof PLAN_PRICING]?.save ?? 0).toLocaleString()}`}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Autopay toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-semibold">Enable Autopay</p>
                      <p className="text-xs text-muted-foreground">
                        Automatically charge the hotel each billing cycle. The owner sets up a UPI or card mandate.
                      </p>
                    </div>
                  </div>
                  <Switch checked={autopayEnabled} onCheckedChange={setAutopayEnabled} />
                </div>

                {/* Payment method */}
                {autopayEnabled && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Payment Method</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { value: 'upi',  label: 'UPI Autopay',      desc: 'Recommended — set up UPI mandate',    icon: Smartphone },
                        { value: 'card', label: 'Card Autopay',     desc: 'Credit/Debit card recurring billing',  icon: CreditCard },
                        { value: 'nach', label: 'Bank Mandate',     desc: 'NACH — direct bank debit mandate',     icon: Landmark   },
                        { value: 'link', label: 'Send Invoice Link', desc: 'Manual payment each cycle, no mandate', icon: Link2    },
                      ].map(m => {
                        const Icon = m.icon;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setPaymentMethod(m.value as typeof paymentMethod)}
                            className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                              paymentMethod === m.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${paymentMethod === m.value ? 'text-primary' : 'text-muted-foreground'}`} />
                            <div>
                              <p className="text-sm font-semibold">{m.label}</p>
                              <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                            </div>
                            {m.value === 'upi' && (
                              <Badge className="ml-auto text-[9px] bg-blue-100 text-blue-700 border-blue-200 shrink-0">India #1</Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* UPI ID field */}
                    {paymentMethod === 'upi' && (
                      <div className="space-y-1.5 mt-2">
                        <Label className="text-xs font-semibold">Hotel Owner's UPI ID (optional)</Label>
                        <Input
                          placeholder="owner@upi or 9876543210@paytm"
                          value={upiId}
                          onChange={e => setUpiId(e.target.value)}
                          className="rounded-xl"
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Pre-fills the UPI mandate setup. Owner can also enter it on the payment page.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Billing contact */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Billing Contact</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Billing Name</Label>
                      <Input
                        placeholder={form.name || 'Hotel / Business Name'}
                        value={billingName}
                        onChange={e => setBillingName(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Billing Email</Label>
                      <Input
                        type="email"
                        placeholder={form.admin_email || 'billing@hotel.com'}
                        value={billingEmail}
                        onChange={e => setBillingEmail(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">GST Number (optional)</Label>
                      <Input
                        placeholder="22AAAAA0000A1Z5"
                        value={gstNumber}
                        onChange={e => setGstNumber(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                {/* Info box */}
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
                  <p className="font-semibold text-blue-700 dark:text-blue-400 mb-1">How payment setup works</p>
                  When you click "Create Hotel", we provision the hotel and generate a <strong>Razorpay payment link</strong>.
                  Share this link with the hotel owner — they'll approve the {autopayEnabled ? 'autopay mandate' : 'payment'} on their
                  device. No money is charged until they complete the setup.
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : form.subscription_tier !== 'free'
                ? <CreditCard className="w-4 h-4" />
                : <Check className="w-4 h-4" />}
            {form.subscription_tier !== 'free'
              ? isSubmitting ? 'Creating & Setting Up Payment…' : 'Create Hotel + Generate Payment Link'
              : 'Create Hotel & Admin'}
          </Button>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          {form.subscription_tier !== 'free' && activeSection !== 'payment' && (
            <Button variant="ghost" size="sm" className="text-xs ml-auto" onClick={() => setActiveSection('payment')}>
              Review Payment Setup →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
