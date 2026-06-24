import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

export function ImpersonationBanner() {
  const { role, impersonateRestaurant } = useAuth();
  const [restaurantName, setRestaurantName] = useState<string>('');
  const [impId, setImpId] = useState<string | null>(() => localStorage.getItem('impersonated_restaurant_id'));

  // Re-sync when any useAuth instance calls impersonateRestaurant
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.id ?? null;
      setImpId(id);
    };
    window.addEventListener('zappy:impersonation-change', handler);
    return () => window.removeEventListener('zappy:impersonation-change', handler);
  }, []);

  useEffect(() => {
    if (role === 'super_admin' && impId) {
      supabase
        .from('restaurants')
        .select('name')
        .eq('id', impId)
        .maybeSingle()
        .then(({ data }) => {
          setRestaurantName(data?.name || 'Loading...');
        });
    } else {
      setRestaurantName('');
    }
  }, [role, impId]);

  const handleStop = () => {
    impersonateRestaurant(null);
    window.location.href = '/super-admin';
  };

  if (role !== 'super_admin' || !impId) return null;

  return (
    <div className="bg-purple-600 text-white px-4 py-2 flex items-center justify-between text-xs font-semibold sticky top-0 z-[100] shadow-md">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 animate-pulse" />
        <span>
          Impersonating: <strong className="underline">{restaurantName || 'Loading...'}</strong> (Super Admin Mode)
        </span>
      </div>
      <Button 
        onClick={handleStop}
        size="sm"
        variant="secondary"
        className="h-7 px-3 bg-white text-purple-700 hover:bg-purple-50 font-bold rounded-full border-0"
      >
        Exit Impersonation
      </Button>
    </div>
  );
}
