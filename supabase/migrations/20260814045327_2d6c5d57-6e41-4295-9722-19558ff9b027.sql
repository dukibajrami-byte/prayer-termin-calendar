CREATE TABLE IF NOT EXISTS public.premium_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'developer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT ON public.premium_grants TO authenticated;
GRANT ALL ON public.premium_grants TO service_role;

ALTER TABLE public.premium_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own premium grant" ON public.premium_grants;
CREATE POLICY "Users can view their own premium grant"
ON public.premium_grants FOR SELECT TO authenticated
USING (auth.uid() = user_id);

INSERT INTO public.premium_grants (user_id, reason)
SELECT id, 'developer' FROM auth.users
WHERE email IN ('duki.bajrami@gmail.com', 'duki.bajrami2@gmail.com')
ON CONFLICT (user_id) DO NOTHING;