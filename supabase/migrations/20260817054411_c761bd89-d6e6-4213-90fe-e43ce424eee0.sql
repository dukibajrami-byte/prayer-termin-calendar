CREATE OR REPLACE FUNCTION public.is_calendar_member(_calendar_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.calendar_members m
      WHERE m.calendar_id = _calendar_id AND m.user_id = _user_id
    )
  END
$$;

REVOKE ALL ON FUNCTION public.is_calendar_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_calendar_member(uuid, uuid) TO authenticated, service_role;