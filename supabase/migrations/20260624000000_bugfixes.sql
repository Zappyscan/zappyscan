-- ============================================================
-- BUG FIX MIGRATION — 2026-06-24
-- ============================================================

-- -------------------------------------------------------
-- BUG 1: increment_scan_count was fully REVOKED
-- QR scan counter never increments when customers scan QRs
-- (customers are anon; function is SECURITY DEFINER so 
--  granting EXECUTE is safe — the body already validates the QR)
-- -------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.increment_scan_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_scan_count(uuid) TO authenticated;


-- -------------------------------------------------------
-- BUG 2: seat_occupancy UPDATE policy blocks anon customers
-- The original policy used a hardcoded placeholder UUID
-- (00000000-0000-0000-0000-000000000001) which never matches,
-- so anon customers could never update their own seat row.
-- Fix: allow anon users to update any seat_occupancy row.
-- (INSERT is already open; SELECT is already open; table has
--  no PII so open UPDATE for anon is acceptable here.)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Restaurant staff can update seat occupancy" ON public.seat_occupancy;

CREATE POLICY "Anyone can update seat occupancy"
ON public.seat_occupancy
FOR UPDATE
USING (true)
WITH CHECK (true);


-- -------------------------------------------------------
-- BUG 3: table_sessions SELECT for anon only allows
-- statuses: waiting, seated, ordering, served
-- Missing: preparing, dining, billing
-- CustomerMenu.tsx fetches all sessions where status != completed,
-- so 'preparing', 'dining', 'billing' sessions become invisible
-- to anon customers — their active session disappears mid-flow.
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Anon can view active table sessions" ON public.table_sessions;

CREATE POLICY "Anon can view active table sessions" ON public.table_sessions
FOR SELECT TO anon
USING (
  status != 'completed'
  AND is_restaurant_active(restaurant_id)
);


-- -------------------------------------------------------
-- BUG 4: Remove QR Flow debug console.logs from production
-- (done in code, not SQL — see CustomerMenu.tsx fixes below)
-- -------------------------------------------------------
