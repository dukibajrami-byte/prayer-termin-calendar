REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, SELECT ON public.subscriptions FROM anon;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client inserts on subscriptions" ON public.subscriptions;
CREATE POLICY "No client inserts on subscriptions"
ON public.subscriptions FOR INSERT TO authenticated, anon
WITH CHECK (false);

DROP POLICY IF EXISTS "No client updates on subscriptions" ON public.subscriptions;
CREATE POLICY "No client updates on subscriptions"
ON public.subscriptions FOR UPDATE TO authenticated, anon
USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on subscriptions" ON public.subscriptions;
CREATE POLICY "No client deletes on subscriptions"
ON public.subscriptions FOR DELETE TO authenticated, anon
USING (false);