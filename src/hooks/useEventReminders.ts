import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useEvents } from "@/hooks/useEvents";
import { fmt } from "@/lib/dates";
import { isNativePlatform, ensureNativeNotificationPermission } from "@/lib/native-notifications";
import type { CalEvent } from "@/lib/store";

/**
 * Stabile, positive Notification-ID aus der Event-ID.
 * Bereich: 1_000_000_001 – 1_899_999_999 (klar unter dem Android-Limit).
 * To-Do-IDs sind immer ungerade-unabhängig; hier erzwingen wir gerade IDs,
 * To-Dos erzeugen (siehe useTodoReminders) über `|| 1` beliebige Werte – durch
 * die Beschränkung auf gerade Zahlen in diesem Band plus eigenem Hash-Seed
 * bleiben Kollisionen praktisch ausgeschlossen.
 */
export function eventNotificationId(id: string): number {
  let hash = 7;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33 + id.charCodeAt(i)) | 0;
  }
  const slot = Math.abs(hash) % 449_999_999;
  return 1_000_000_000 + slot * 2; // gerade IDs in 1_000_000_000 – 1_899_999_996
}

function signature(event: CalEvent, at: number, title: string, body: string) {
  return `${at}|${title}|${body}|${event.reminderMinutes}`;
}

/**
 * Plant Termin-Erinnerungen: nativ via Capacitor LocalNotifications,
 * im Web als Toast + Browser-Notification (nur solange die App offen ist).
 */
export function useEventReminders() {
  const { t } = useI18n();
  const [cursor] = useState(() => new Date());
  const { events } = useEvents(cursor, "month");
  const [now, setNow] = useState(() => new Date());
  const notified = useRef(new Set<string>());
  const scheduled = useRef(new Map<number, string>());
  // IDs, deren Zeitpunkt bereits erreicht wurde: Android hat sie (vermutlich)
  // schon angezeigt – sie dürfen NICHT mehr abgebrochen werden.
  const delivered = useRef(new Set<number>());
  const native = typeof window !== "undefined" && isNativePlatform();

useEffect(() => {
  useEffect(() => {
  console.info(
    "[event-reminders] DEBUG events",
    JSON.stringify(
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start: event.start,
        reminderMinutes: event.reminderMinutes,
      })),
    ),
  );
}, [events]);
      id: event.id,
      title: event.title,
      start: event.start,
      reminderMinutes: event.reminderMinutes,
    })),
  );
}, [events]);

  useEffect(() => {
    if (native) return;
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, [native]);

  // Native (Capacitor Android/iOS): echte geplante Local Notifications.
  useEffect(() => {
    if (!native) return;
    let cancelled = false;

    void (async () => {
      const { granted } = await ensureNativeNotificationPermission();
      if (!granted || cancelled) return;
      const { LocalNotifications } = await import("@capacitor/local-notifications");

      const wanted = new Map<number, { at: Date; title: string; body: string; sig: string }>();
      const pastDue = new Set<number>();
      for (const event of events) {
        if (event.reminderMinutes < 0) continue;
        const start = new Date(event.start);
        if (Number.isNaN(start.getTime())) continue;
        const at = new Date(start.getTime() - event.reminderMinutes * 60_000);
        const id0 = eventNotificationId(event.id);
        if (at.getTime() <= Date.now()) {
          pastDue.add(id0);
          continue;
        }
        const title = t("notif.event", { title: event.title });
        const body = t("notif.eventBody", { time: fmt(start, "HH:mm") });
        const id = eventNotificationId(event.id);
        wanted.set(id, { at, title, body, sig: signature(event, at.getTime(), title, body) });
      }

      const toCancel: { id: number }[] = [];
      for (const [id, sig] of scheduled.current) {
        const next = wanted.get(id);
        if (next && next.sig === sig) continue;
        if (pastDue.has(id) || delivered.current.has(id)) {
          // Erinnerungszeit ist vorbei -> Notification wurde bereits ausgelöst.
          // Nicht abbrechen, sonst verschwindet sie sofort wieder aus der Leiste.
          delivered.current.add(id);
          scheduled.current.delete(id);
          console.info(`[event-reminders] keep ${id} (already fired, not cancelled)`);
          continue;
        }
        const reason = !next
          ? "event deleted or reminder disabled"
          : "reminder changed (time/title/offset)";
        console.info(`[event-reminders] cancel ${id} – reason: ${reason}`);
        toCancel.push({ id });
        scheduled.current.delete(id);
      }
      if (toCancel.length) {
        try {
          await LocalNotifications.cancel({ notifications: toCancel });
        } catch (error) {
          console.error("[event-reminders] cancel failed", toCancel, error);
        }
      }
      if (cancelled) return;

      const toSchedule = [...wanted.entries()].filter(([id]) => !scheduled.current.has(id));
      if (toSchedule.length) {
        for (const [id] of toSchedule) delivered.current.delete(id);
        try {
          console.info(
            "[event-reminders] scheduling",
            toSchedule.map(([id, n]) => `${id}@${n.at.toISOString()}`),
          );
          await LocalNotifications.schedule({
            notifications: toSchedule.map(([id, n]) => ({
              id,
              title: n.title,
              body: n.body,
              schedule: { at: n.at, allowWhileIdle: true },
            })),
          });
          for (const [id, n] of toSchedule) scheduled.current.set(id, n.sig);
          try {
            const pending = await LocalNotifications.getPending();
            const pendingIds = new Set(pending.notifications.map((n) => n.id));
            for (const [id] of toSchedule) {
              console.info(
                `[event-reminders] notification ${id} pending: ${pendingIds.has(id)}`,
              );
            }
          } catch (error) {
            console.error("[event-reminders] getPending failed", error);
          }
        } catch (error) {
          console.error(
            "[event-reminders] schedule failed",
            toSchedule.map(([id]) => id),
            error,
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [native, events, t]);

  // Web/PWA-Fallback: Toast + Browser-Notification, solange die App offen ist.
  useEffect(() => {
    if (native) return;
    for (const event of events) {
      if (event.reminderMinutes < 0) continue;
      const start = new Date(event.start);
      if (Number.isNaN(start.getTime())) continue;
      const at = start.getTime() - event.reminderMinutes * 60_000;
      const key = `event-${event.id}-${at}`;
      if (notified.current.has(key)) continue;
      const delta = now.getTime() - at;
      if (delta < 0 || delta > 120_000) continue;
      notified.current.add(key);
      const title = t("notif.event", { title: event.title });
      const body = t("notif.eventBody", { time: fmt(start, "HH:mm") });
      toast(title, { description: body });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    }
  }, [native, now, events, t]);
}
