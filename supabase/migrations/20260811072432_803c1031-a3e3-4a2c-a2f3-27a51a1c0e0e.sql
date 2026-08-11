create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null,
  kind text not null default 'personal',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.calendar_members (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid references public.calendars(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member',
  invited_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(calendar_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  calendar_id uuid references public.calendars(id) on delete cascade not null,
  title text not null,
  notes text,
  start timestamptz not null,
  "end" timestamptz not null,
  reminder_minutes integer default -1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendars TO authenticated;
GRANT ALL ON public.calendars TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_members TO authenticated;
GRANT ALL ON public.calendar_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

alter table public.calendars enable row level security;
alter table public.calendar_members enable row level security;
alter table public.events enable row level security;

create policy "Users can manage calendars they own"
  on public.calendars for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can view calendars they are members of"
  on public.calendars for select
  to authenticated
  using (
    exists (
      select 1 from public.calendar_members
      where calendar_id = id and user_id = auth.uid()
    )
  );

create policy "Calendar owners can manage members"
  on public.calendar_members for all
  to authenticated
  using (
    exists (
      select 1 from public.calendars
      where id = calendar_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.calendars
      where id = calendar_id and user_id = auth.uid()
    )
  );

create policy "Users can view their own memberships"
  on public.calendar_members for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Calendar owners can manage events in their calendars"
  on public.events for all
  to authenticated
  using (
    exists (
      select 1 from public.calendars
      where id = events.calendar_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.calendars
      where id = events.calendar_id and user_id = auth.uid()
    )
  );

create policy "Users can manage events they created"
  on public.events for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Calendar members can view events"
  on public.events for select
  to authenticated
  using (
    exists (
      select 1 from public.calendar_members
      where calendar_id = events.calendar_id and user_id = auth.uid()
    )
  );

create index idx_events_calendar_id on public.events(calendar_id);
create index idx_events_user_id on public.events(user_id);
create index idx_events_start on public.events(start);
create index idx_calendar_members_calendar_id on public.calendar_members(calendar_id);
create index idx_calendar_members_user_id on public.calendar_members(user_id);

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_calendars_updated_at
  before update on public.calendars
  for each row execute function public.update_updated_at_column();

create trigger update_calendar_members_updated_at
  before update on public.calendar_members
  for each row execute function public.update_updated_at_column();

create trigger update_events_updated_at
  before update on public.events
  for each row execute function public.update_updated_at_column();