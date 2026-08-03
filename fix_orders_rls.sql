-- ============================================================
-- Fix: Allow restaurant staff (waiters, admins) to create orders
-- without requiring an active table_session (waiter-assisted orders)
-- Run this in Supabase SQL Editor
-- ============================================================

-- The existing "Anyone can create orders" policy blocks waiter-placed orders
-- because it requires an active table_session when table_id is set.
-- Waiters place orders directly without the customer QR session flow.
-- Solution: Add a separate policy for authenticated staff.

DROP POLICY IF EXISTS "Restaurant staff can create orders" ON public.orders;

CREATE POLICY "Restaurant staff can create orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  restaurant_id IN (
    SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Also ensure staff can update and select their restaurant's orders
DROP POLICY IF EXISTS "Restaurant staff can manage orders" ON public.orders;

CREATE POLICY "Restaurant staff can manage orders"
ON public.orders
FOR ALL
TO authenticated
USING (
  restaurant_id IN (
    SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- Same for order_items
DROP POLICY IF EXISTS "Restaurant staff can manage order_items" ON public.order_items;

CREATE POLICY "Restaurant staff can manage order_items"
ON public.order_items
FOR ALL
TO authenticated
USING (
  restaurant_id IN (
    SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  restaurant_id IN (
    SELECT restaurant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

DO $$ BEGIN RAISE NOTICE 'Orders RLS fix applied — waiters can now place orders!'; END $$;
