import { useCallback } from "react";
import { useLocalState } from "@/lib/store";

export interface Todo {
  id: string;
  title: string;
  notes?: string;
  due?: string | null; // ISO date (yyyy-mm-dd)
  dueTime?: string | null; // HH:mm
  reminderMinutes?: number; // -1 = aus
  important?: boolean;
  done: boolean;
  createdAt: string;
}

export function useTodos() {
  const [state, setState, loaded] = useLocalState<{ items: Todo[] }>("mtk.todos", { items: [] });

  const add = useCallback(
    (title: string) =>
      setState((prev) => ({
        items: [
          {
            id: crypto.randomUUID(),
            title,
            done: false,
            important: false,
            due: null,
            dueTime: null,
            reminderMinutes: -1,
            createdAt: new Date().toISOString(),
          },
          ...prev.items,
        ],
      })),
    [setState],
  );

  const update = useCallback(
    (id: string, patch: Partial<Todo>) =>
      setState((prev) => ({
        items: prev.items.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    [setState],
  );

  const remove = useCallback(
    (id: string) => setState((prev) => ({ items: prev.items.filter((t) => t.id !== id) })),
    [setState],
  );

  const clearDone = useCallback(
    () => setState((prev) => ({ items: prev.items.filter((t) => !t.done) })),
    [setState],
  );

  return { todos: state.items, add, update, remove, clearDone, loaded };
}
