CREATE OR REPLACE FUNCTION public.is_calendar_member(_calendar_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_members
    WHERE calendar_id = _calendar_id AND user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Users can view calendars they are members of" ON public.calendars;

CREATE POLICY "Users can view calendars they are members of"
ON public.calendars
FOR SELECT
TO authenticated
USING (public.is_calendar_member(id, auth.uid()));