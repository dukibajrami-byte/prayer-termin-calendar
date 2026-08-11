import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfMonth, startOfMonth, addMonths } from "date-fns";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import {
  DEFAULT_CALENDARS,
  useLocalEvents,
  type CalEvent,
  type SharedCalendar,
} from "@/lib/store";
import {
  listCalendars,
  listEvents,
  upsertEvent as upsertCloudEvent,
  deleteEvent as deleteCloudEvent,
  migrateLocalEvents,
} from "@/lib/calendar.functions";
import type { CalendarRow, CloudEventRow } from "@/lib/calendar.functions";

function toCalEvent(row: CloudEventRow): CalEvent {
  const event: CalEvent = {
    id: row.id,
    title: row.title,
    start: row.start,
    end: row.end,
    calendarId: row.calendar_id,
    reminderMinutes: row.reminder_minutes,
  };
  if (row.notes) event.notes = row.notes;
  return event;
}


function toCloudEvent(event: CalEvent): CloudEventRow {
  return {
    id: event.id,
    user_id: "",
    calendar_id: event.calendarId,
    title: event.title,
    notes: event.notes || null,
    start: event.start,
    end: event.end,
    reminder_minutes: event.reminderMinutes,
  };
}

function cloudCalendarToShared(row: CalendarRow): SharedCalendar {
  return { id: row.id, name: row.name, color: row.color };
}

export function useEvents(cursor: Date, view: "day" | "week" | "month") {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { events: localEvents, upsert: upsertLocal, remove: removeLocal, loaded: localLoaded } = useLocalEvents();
  const [cloudEvents, setCloudEvents] = useState<CalEvent[]>([]);
  const [cloudCalendars, setCloudCalendars] = useState<SharedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);

  const useCloud = useMemo(() => Boolean(user && isPremium), [user, isPremium]);

  const range = useMemo(() => {
    const start = startOfMonth(addMonths(cursor, -1));
    const end = endOfMonth(addMonths(cursor, 1));
    return { start: start.toISOString(), end: end.toISOString() };
  }, [cursor]);

  const fetchCloud = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [calendars, events] = await Promise.all([
        listCalendars({}),
        listEvents({ data: range }),
      ]);
      setCloudCalendars((calendars as CalendarRow[]).map(cloudCalendarToShared));
      setCloudEvents((events as CloudEventRow[]).map(toCalEvent));
    } finally {
      setLoading(false);
    }
  }, [user, range]);

  useEffect(() => {
    if (!useCloud) {
      setLoading(false);
      return;
    }
    void fetchCloud();
  }, [useCloud, fetchCloud]);

  useEffect(() => {
    if (!useCloud || !localLoaded || migrated || localEvents.length === 0) return;
    setMigrated(true);
    void migrateLocalEvents({
      data: {
        localEvents,
        localCalendars: DEFAULT_CALENDARS,
      },
    }).then(() => fetchCloud());
  }, [useCloud, localLoaded, migrated, localEvents, fetchCloud]);

  const events = useMemo(
    () => (useCloud ? cloudEvents : localEvents),
    [useCloud, cloudEvents, localEvents],
  );

  const calendars = useMemo(
    () => (useCloud ? cloudCalendars : DEFAULT_CALENDARS),
    [useCloud, cloudCalendars],
  );

  const upsert = useCallback(
    async (event: CalEvent) => {
      if (useCloud) {
        await upsertCloudEvent({ data: { event: toCloudEvent(event) } });
        await fetchCloud();
      } else {
        upsertLocal(event);
      }
    },
    [useCloud, fetchCloud, upsertLocal],
  );

  const remove = useCallback(
    async (id: string) => {
      if (useCloud) {
        await deleteCloudEvent({ data: { id } });
        await fetchCloud();
      } else {
        removeLocal(id);
      }
    },
    [useCloud, fetchCloud, removeLocal],
  );

  const refresh = useCallback(() => {
    if (useCloud) void fetchCloud();
  }, [useCloud, fetchCloud]);

  return { events, calendars, upsert, remove, loading, refresh, useCloud };
}
