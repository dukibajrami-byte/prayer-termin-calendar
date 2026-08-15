import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocalState } from "@/lib/store";
import { useAuth } from "@/hooks/useAuth";

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
  updatedAt?: string;
}

interface TodoRow {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  done: boolean;
  important: boolean;
  due: string | null;
  due_time: string | null;
  reminder_minutes: number;
  created_at: string;
  updated_at: string;
}

function rowToTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    due: row.due,
    dueTime: row.due_time,
    reminderMinutes: row.reminder_minutes ?? -1,
    important: row.important,
    done: row.done,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function todoToRow(todo: Todo, userId: string) {
  return {
    id: todo.id,
    user_id: userId,
    title: todo.title,
    notes: todo.notes ?? null,
    done: todo.done,
    important: Boolean(todo.important),
    due: todo.due ?? null,
    due_time: todo.dueTime ?? null,
    reminder_minutes: todo.reminderMinutes ?? -1,
    created_at: todo.createdAt,
  };
}

function sortTodos(items: Todo[]) {
  return [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function mergeById(items: Todo[]) {
  const map = new Map<string, Todo>();
  for (const item of items) map.set(item.id, item);
  return sortTodos([...map.values()]);
}

export interface TodosApi {
  todos: Todo[];
  add: (title: string) => void;
  update: (id: string, patch: Partial<Todo>) => void;
  remove: (id: string) => void;
  clearDone: () => void;
  loaded: boolean;
  /** debug */
  source: "cloud" | "local";
  userId: string | null;
  realtimeStatus: string;
  cloudCount: number;
}

const TodosContext = createContext<TodosApi | null>(null);

const TABLE = "todos" as const;

function useTodosState(): TodosApi {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [local, setLocal, localLoaded] = useLocalState<{ items: Todo[] }>("mtk.todos", { items: [] });
  const [cloud, setCloud] = useState<Todo[]>([]);
  const [cloudLoaded, setCloudLoaded] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState("disconnected");
  const migratedFor = useRef<string | null>(null);
  const localRef = useRef(local.items);
  localRef.current = local.items;

  const fetchCloud = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[todos] load failed", error.message);
      return;
    }
    setCloud(mergeById((data ?? []).map((r) => rowToTodo(r as unknown as TodoRow))));
    setCloudLoaded(true);
  }, []);

  // Initial load + one-time migration of local-only todos.
  useEffect(() => {
    if (!userId) {
      setCloud([]);
      setCloudLoaded(false);
      setRealtimeStatus("disconnected");
      return;
    }
    let cancelled = false;
    void (async () => {
      if (localLoaded && migratedFor.current !== userId) {
        migratedFor.current = userId;
        const flag = `mtk.todos.migrated.${userId}`;
        const pending = localRef.current;
        if (typeof window !== "undefined" && !window.localStorage.getItem(flag)) {
          if (pending.length) {
            const { error } = await supabase
              .from(TABLE)
              .upsert(pending.map((item) => todoToRow(item, userId)), { onConflict: "id" });
            if (error) console.error("[todos] migration failed", error.message);
          }
          window.localStorage.setItem(flag, "1");
        }
      }
      if (!cancelled) await fetchCloud(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, localLoaded, fetchCloud]);

  // Realtime: keep this device in sync with other devices.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`todos-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${userId}` },
        (payload) => {
          setCloud((prev) => {
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { id?: string } | null)?.id;
              return oldId ? prev.filter((x) => x.id !== oldId) : prev;
            }
            const next = rowToTodo(payload.new as unknown as TodoRow);
            return mergeById([...prev.filter((x) => x.id !== next.id), next]);
          });
        },
      )
      .subscribe((status) => setRealtimeStatus(status));
    return () => {
      void supabase.removeChannel(channel);
      setRealtimeStatus("disconnected");
    };
  }, [userId]);

  const add = useCallback(
    (title: string) => {
      const item: Todo = {
        id: crypto.randomUUID(),
        title,
        done: false,
        important: false,
        due: null,
        dueTime: null,
        reminderMinutes: -1,
        createdAt: new Date().toISOString(),
      };
      if (!userId) {
        setLocal((prev) => ({ items: [item, ...prev.items] }));
        return;
      }
      setCloud((prev) => mergeById([item, ...prev]));
      void supabase
        .from(TABLE)
        .insert(todoToRow(item, userId))
        .then(({ error }) => {
          if (error) {
            console.error("[todos] insert failed", error.message);
            setCloud((prev) => prev.filter((x) => x.id !== item.id));
          }
        });
    },
    [userId, setLocal],
  );

  const update = useCallback(
    (id: string, patch: Partial<Todo>) => {
      if (!userId) {
        setLocal((prev) => ({
          items: prev.items.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }));
        return;
      }
      setCloud((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      const row: Record<string, unknown> = {};
      if (patch.title !== undefined) row["title"] = patch.title;
      if (patch.notes !== undefined) row["notes"] = patch.notes ?? null;
      if (patch.done !== undefined) row["done"] = patch.done;
      if (patch.important !== undefined) row["important"] = Boolean(patch.important);
      if (patch.due !== undefined) row["due"] = patch.due ?? null;
      if (patch.dueTime !== undefined) row["due_time"] = patch.dueTime ?? null;
      if (patch.reminderMinutes !== undefined) row["reminder_minutes"] = patch.reminderMinutes ?? -1;
      if (!Object.keys(row).length) return;
      void supabase
        .from(TABLE)
        .update(row)
        .eq("id", id)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) console.error("[todos] update failed", error.message);
        });
    },
    [userId, setLocal],
  );

  const remove = useCallback(
    (id: string) => {
      if (!userId) {
        setLocal((prev) => ({ items: prev.items.filter((x) => x.id !== id) }));
        return;
      }
      setCloud((prev) => prev.filter((x) => x.id !== id));
      void supabase
        .from(TABLE)
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .then(({ error }) => {
          if (error) console.error("[todos] delete failed", error.message);
        });
    },
    [userId, setLocal],
  );

  const clearDone = useCallback(() => {
    if (!userId) {
      setLocal((prev) => ({ items: prev.items.filter((x) => !x.done) }));
      return;
    }
    setCloud((prev) => prev.filter((x) => !x.done));
    void supabase
      .from(TABLE)
      .delete()
      .eq("user_id", userId)
      .eq("done", true)
      .then(({ error }) => {
        if (error) console.error("[todos] clearDone failed", error.message);
      });
  }, [userId, setLocal]);

  const todos = userId ? cloud : local.items;

  return useMemo(
    () => ({
      todos,
      add,
      update,
      remove,
      clearDone,
      loaded: userId ? cloudLoaded : localLoaded,
      source: userId ? "cloud" : "local",
      userId,
      realtimeStatus,
      cloudCount: cloud.length,
    }),
    [todos, add, update, remove, clearDone, userId, cloudLoaded, localLoaded, realtimeStatus, cloud.length],
  );
}

export function TodosProvider({ children }: { children: ReactNode }) {
  const value = useTodosState();
  return <TodosContext.Provider value={value}>{children}</TodosContext.Provider>;
}

export function useTodos(): TodosApi {
  const ctx = useContext(TodosContext);
  if (!ctx) throw new Error("useTodos must be used within <TodosProvider>");
  return ctx;
}