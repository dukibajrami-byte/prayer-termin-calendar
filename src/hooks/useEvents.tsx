import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

interface EventsContextValue {
  events: CalEvent[];
  calendars: SharedCalendar[];
  upsert: (event: CalEvent) => Promise<void>;
  remove: (id: string) => Promise<void>;
  loading: boolean;
  refresh: () => void;
  useCloud: boolean;
  setCursor: (cursor: Date) => void;
}

const EventsContext = createContext<EventsContextValue | null>(null);

/**
 * Single shared source of truth for calendar events (cloud + local fallback).
 * Mounted once in __root.tsx so the calendar UI and the global reminder
 * scheduler consume exactly the same state.
 */
export function EventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const {
    events: localEvents,
    upsert: upsertLocal,
    remove: removeLocal,
    loaded: localLoaded,
  } = useLocalEvents();
  const [cloudEvents, setCloudEvents] = useState<CalEvent[]>([]);
  const [cloudCalendars, setCloudCalendars] = useState<SharedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(false);
  const [cursorTime, setCursorTime] = useState(() => Date.now());

  const useCloud = useMemo(() => Boolean(user && isPremium), [user, isPremium]);

  const setCursor = useCallback((next: Date) => {
    const time = next.getTime();
    setCursorTime((prev) => {
      const prevMonth = new Date(prev);
      const nextMonth = new Date(time);
      const same =
        prevMonth.getFullYear() === nextMonth.getFullYear() &&
        prevMonth.getMonth() === nextMonth.getMonth();
      return same ? prev : time;
    });
  }, []);

  const range = useMemo(() => {
    const cursor = new Date(cursorTime);
    const start = startOfMonth(addMonths(cursor, -1));
    const end = endOfMonth(addMonths(cursor, 1));
    return { start: start.toISOString(), end: end.toISOString() };
  }, [cursorTime]);

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
    } catch (error) {
      console.error("Cloud sync failed", error);
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
      data: { localEvents, localCalendars: DEFAULT_CALENDARS },
    })
      .then(() => fetchCloud())
      .catch((error) => console.error("Local event migration failed", error));
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
        // Optimistic update so the global reminder scheduler sees it instantly.
        setCloudEvents((prev) =>
          prev.some((e) => e.id === event.id)
            ? prev.map((e) => (e.id === event.id ? event : e))
            : [...prev, event],
        );
        try {
          await upsertCloudEvent({ data: { event: toCloudEvent(event) } });
          await fetchCloud();
        } catch (error) {
          console.error("Saving event failed", error);
          upsertLocal(event);
        }
      } else {
        upsertLocal(event);
      }
    },
    [useCloud, fetchCloud, upsertLocal],
  );

  const remove = useCallback(
    async (id: string) => {
      if (useCloud) {
        setCloudEvents((prev) => prev.filter((e) => e.id !== id));
        try {
          await deleteCloudEvent({ data: { id } });
          await fetchCloud();
        } catch (error) {
          console.error("Deleting event failed", error);
          removeLocal(id);
        }
      } else {
        removeLocal(id);
      }
    },
    [useCloud, fetchCloud, removeLocal],
  );

  const refresh = useCallback(() => {
    if (useCloud) void fetchCloud();
  }, [useCloud, fetchCloud]);

  const value = useMemo<EventsContextValue>(
    () => ({ events, calendars, upsert, remove, loading, refresh, useCloud, setCursor }),
    [events, calendars, upsert, remove, loading, refresh, useCloud, setCursor],
  );

  useEffect(() => {
    console.info(
      "[events-store] events:",
      events.length,
      events.map((e) => `${e.id}@${e.start}/${e.reminderMinutes}`),
    );
  }, [events]);

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEventsStore(): EventsContextValue {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error("useEventsStore must be used within EventsProvider");
  return ctx;
}

/**
 * Calendar-UI hook: reports the visible cursor to the shared store and
 * returns the shared events/calendars.
 */
export function useEvents(cursor: Date, _view: "day" | "week" | "month") {
  const store = useEventsStore();
  const { setCursor } = store;
  const cursorTime = cursor.getTime();

  useEffect(() => {
    setCursor(new Date(cursorTime));
  }, [cursorTime, setCursor]);

  return store;
}