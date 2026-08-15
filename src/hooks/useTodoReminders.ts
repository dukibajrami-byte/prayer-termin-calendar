import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useTodos, type Todo } from "@/hooks/useTodos";
import { isNativePlatform, ensureNativeNotificationPermission } from "@/lib/native-notifications";

export function todoDueDate(item: Todo): Date | null {
  if (!item.due) return null;
  const time = item.dueTime && /^\d{2}:\d{2}$/.test(item.dueTime) ? item.dueTime : "09:00";
  const d = new Date(`${item.due}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Stabile, positive 31-Bit-ID aus der To-Do-ID (für LocalNotifications). */
export function todoNotificationId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2_000_000_000 || 1;
}

function reminderSignature(item: Todo, at: number, title: string, body: string) {
  return `${at}|${title}|${body}|${item.reminderMinutes ?? -1}`;
}

/** Feuert Erinnerungen für fällige To-Dos (Toast + Browser-Notification). */
export function useTodoReminders() {
  const { t } = useI18n();
  const { todos } = useTodos();
  const [now, setNow] = useState(() => new Date());
  const notified = useRef(new Set<string>());
  const native = typeof window !== "undefined" && isNativePlatform();
  const scheduled = useRef(new Map<number, string>());

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
      for (const item of todos) {
        if (item.done) continue;
        const minutes = item.reminderMinutes ?? -1;
        if (minutes < 0) continue;
        const due = todoDueDate(item);
        if (!due) continue;
        const at = new Date(due.getTime() - minutes * 60_000);
        if (at.getTime() <= Date.now()) continue;
        const time = due.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
        const title = t("notif.todo", { title: item.title });
        const body = t("notif.todoBody", { time });
        const id = todoNotificationId(item.id);
        wanted.set(id, { at, title, body, sig: reminderSignature(item, at.getTime(), title, body) });
      }

      // Veraltete / geänderte / entfernte Erinnerungen abbrechen.
      const toCancel: { id: number }[] = [];
      for (const [id, sig] of scheduled.current) {
        const next = wanted.get(id);
        if (!next || next.sig !== sig) {
          toCancel.push({ id });
          scheduled.current.delete(id);
        }
      }
      if (toCancel.length) {
        try {
          await LocalNotifications.cancel({ notifications: toCancel });
        } catch {
          /* ignore */
        }
      }
      if (cancelled) return;

      const toSchedule = [...wanted.entries()].filter(([id]) => !scheduled.current.has(id));
      if (toSchedule.length) {
        try {
          await LocalNotifications.schedule({
            notifications: toSchedule.map(([id, n]) => ({
              id,
              title: n.title,
              body: n.body,
              schedule: { at: n.at, allowWhileIdle: true },
            })),
          });
          for (const [id, n] of toSchedule) scheduled.current.set(id, n.sig);
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [native, todos, t]);

  useEffect(() => {
    if (native) return;
    for (const item of todos) {
      if (item.done) continue;
      const minutes = item.reminderMinutes ?? -1;
      if (minutes < 0) continue;
      const due = todoDueDate(item);
      if (!due) continue;
      const at = due.getTime() - minutes * 60_000;
      const key = `todo-${item.id}-${at}`;
      if (notified.current.has(key)) continue;
      const delta = now.getTime() - at;
      if (delta < 0 || delta > 120_000) continue;
      notified.current.add(key);
      const time = due.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
      const title = t("notif.todo", { title: item.title });
      const body = t("notif.todoBody", { time });
      toast(title, { description: body });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    }
  }, [native, now, todos, t]);
}
