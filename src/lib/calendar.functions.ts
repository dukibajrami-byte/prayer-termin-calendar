import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CalendarKind = "personal" | "family" | "mosque" | "work";

export interface CalendarRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  kind: CalendarKind;
}


export interface CalendarMemberRow {
  id: string;
  calendar_id: string;
  user_id: string;
  role: string;
  invited_email: string | null;
}

export interface CloudEventRow {
  id: string;
  user_id: string;
  calendar_id: string;
  title: string;
  notes: string | null;
  start: string;
  end: string;
  reminder_minutes: number;
}

export const listCalendars = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("calendars")
      .select("id, user_id, name, color, kind")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data as CalendarRow[]) ?? [];
  });

export const createCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; color: string; kind: string }) => data)
  .handler(async ({ data, context }): Promise<CalendarRow> => {
    const { data: row, error } = await context.supabase
      .from("calendars")
      .insert({ ...data, user_id: context.userId })
      .select("id, user_id, name, color, kind")
      .single();
    if (error) throw error;
    return row as CalendarRow;
  });

export const updateCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; name?: string; color?: string }) => data)
  .handler(async ({ data, context }): Promise<CalendarRow> => {
    const update: Partial<Pick<CalendarRow, "name" | "color">> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.color !== undefined) update.color = data.color;
    const { data: row, error } = await context.supabase
      .from("calendars")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id, user_id, name, color, kind")
      .single();
    if (error) throw error;
    return row as CalendarRow;
  });


export const deleteCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendars")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const listCalendarMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { calendarId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("calendar_members")
      .select("id, calendar_id, user_id, role, invited_email")
      .eq("calendar_id", data.calendarId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (rows as CalendarMemberRow[]) ?? [];
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { calendarId: string; email: string; role?: string }) => data)
  .handler(async ({ data, context }): Promise<CalendarMemberRow> => {
    // Verify the caller actually owns the target calendar BEFORE any admin lookup,
    // otherwise this endpoint could be used to enumerate registered emails.
    const { data: ownedCalendar, error: ownerError } = await context.supabase
      .from("calendars")
      .select("id")
      .eq("id", data.calendarId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (ownerError) throw ownerError;
    if (!ownedCalendar) throw new Error("Calendar not found or access denied.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    if (userError) throw userError;
    const matched = list.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!matched) {
      throw new Error("User with this email not found. They must sign up first.");
    }

    const memberUserId = matched.id;
    const { data: row, error } = await context.supabase
      .from("calendar_members")
      .insert({
        calendar_id: data.calendarId,
        user_id: memberUserId,
        role: data.role || "member",
        invited_email: data.email,
      })
      .select("id, calendar_id, user_id, role, invited_email")
      .single();
    if (error) throw error;
    return row as CalendarMemberRow;
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { memberId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("calendar_members")
      .delete()
      .eq("id", data.memberId);
    if (error) throw error;
    return { ok: true };
  });

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { start: string; end: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("events")
      .select("id, user_id, calendar_id, title, notes, start, end, reminder_minutes")
      .lte("start", data.end)
      .gte("end", data.start)
      .order("start", { ascending: true });
    if (error) throw error;
    return (rows as CloudEventRow[]) ?? [];
  });

export const upsertEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { event: CloudEventRow }) => data)
  .handler(async ({ data, context }) => {
    const event = { ...data.event, user_id: context.userId };
    const { error } = await context.supabase.from("events").upsert(event, { onConflict: "id" });
    if (error) throw error;
    return { ok: true };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("events")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const migrateLocalEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      localEvents: {
        id: string;
        title: string;
        notes?: string;
        start: string;
        end: string;
        calendarId: string;
        reminderMinutes: number;
      }[];
      localCalendars: { id: string; name: string; color: string }[];
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { data: existing, error: countError } = await context.supabase
      .from("calendars")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if (countError) throw countError;

    if ((existing?.length ?? 0) > 0) {
      return { created: 0, skipped: true };
    }

    const created: CalendarRow[] = [];
    for (const cal of data.localCalendars) {
      const { data: row, error } = await context.supabase
        .from("calendars")
        .insert({
          user_id: context.userId,
          name: cal.name,
          color: cal.color,
          kind: "personal",
        })
        .select("id, user_id, name, color, kind")
        .single();
      if (error) throw error;
      created.push(row as CalendarRow);
    }

    const calendarMap = new Map(data.localCalendars.map((c, i) => [c.id, created[i]?.id]));
    const events = data.localEvents
      .map((e) => {
        const cloudCalendarId = calendarMap.get(e.calendarId);
        if (!cloudCalendarId) return null;
        return {
          id: e.id,
          user_id: context.userId,
          calendar_id: cloudCalendarId,
          title: e.title,
          notes: e.notes || null,
          start: e.start,
          end: e.end,
          reminder_minutes: e.reminderMinutes,
        };
      })
      .filter(Boolean) as CloudEventRow[];

    if (events.length > 0) {
      const { error } = await context.supabase.from("events").insert(events);
      if (error) throw error;
    }

    return { created: events.length, skipped: false };
  });
