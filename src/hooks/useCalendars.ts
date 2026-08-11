import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import {
  createCalendar,
  updateCalendar,
  deleteCalendar,
  listCalendarMembers,
  inviteMember,
  removeMember,
  listCalendars,
  type CalendarRow,
  type CalendarMemberRow,
  type CalendarKind,
} from "@/lib/calendar.functions";

export function useCalendars() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [calendars, setCalendars] = useState<CalendarRow[]>([]);
  const [members, setMembers] = useState<Record<string, CalendarMemberRow[]>>({});
  const [loading, setLoading] = useState(false);
  const active = Boolean(user && isPremium);

  const fetchCalendars = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listCalendars({});
      setCalendars(data as CalendarRow[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!active) {
      setCalendars([]);
      return;
    }
    void fetchCalendars();
  }, [active, fetchCalendars]);

  const refresh = useCallback(() => {
    if (active) void fetchCalendars();
  }, [active, fetchCalendars]);

  const addCalendar = useCallback(
    async (name: string, kind: CalendarKind, color: string) => {
      await createCalendar({ data: { name, kind, color } });
      await fetchCalendars();
    },
    [fetchCalendars],
  );

  const editCalendar = useCallback(
    async (id: string, patch: { name?: string; color?: string }) => {
      await updateCalendar({ data: { id, ...patch } });
      await fetchCalendars();
    },
    [fetchCalendars],
  );

  const removeCalendar = useCallback(
    async (id: string) => {
      await deleteCalendar({ data: { id } });
      await fetchCalendars();
    },
    [fetchCalendars],
  );

  const fetchMembers = useCallback(
    async (calendarId: string) => {
      if (!user) return;
      const data = await listCalendarMembers({ data: { calendarId } });
      setMembers((prev) => ({ ...prev, [calendarId]: data as CalendarMemberRow[] }));
    },
    [user],
  );

  const invite = useCallback(
    async (calendarId: string, email: string) => {
      await inviteMember({ data: { calendarId, email } });
      await fetchMembers(calendarId);
    },
    [fetchMembers],
  );

  const remove = useCallback(
    async (calendarId: string, memberId: string) => {
      await removeMember({ data: { memberId } });
      await fetchMembers(calendarId);
    },
    [fetchMembers],
  );


  return {
    calendars,
    members,
    loading,
    active,
    refresh,
    addCalendar,
    editCalendar,
    removeCalendar,
    fetchMembers,
    invite,
    remove,
  };
}

