import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useTodos, type Todo } from "@/hooks/useTodos";

export function todoDueDate(item: Todo): Date | null {
  if (!item.due) return null;
  const time = item.dueTime && /^\d{2}:\d{2}$/.test(item.dueTime) ? item.dueTime : "09:00";
  const d = new Date(`${item.due}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Feuert Erinnerungen für fällige To-Dos (Toast + Browser-Notification). */
export function useTodoReminders() {
  const { t } = useI18n();
  const { todos } = useTodos();
  const [now, setNow] = useState(() => new Date());
  const notified = useRef(new Set<string>());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
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
  }, [now, todos, t]);
}
