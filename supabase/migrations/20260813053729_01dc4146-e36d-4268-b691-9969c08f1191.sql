DROP POLICY IF EXISTS "Users can manage events they created" ON public.events;

CREATE POLICY "Users can manage events they created"
ON public.events
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM public.calendars c WHERE c.id = events.calendar_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.calendar_members m WHERE m.calendar_id = events.calendar_id AND m.user_id = auth.uid())
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (SELECT 1 FROM public.calendars c WHERE c.id = events.calendar_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.calendar_members m WHERE m.calendar_id = events.calendar_id AND m.user_id = auth.uid())
  )
);