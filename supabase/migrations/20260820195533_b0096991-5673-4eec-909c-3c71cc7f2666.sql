CREATE TABLE public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  environment text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No client access to stripe_webhook_events" ON public.stripe_webhook_events FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);