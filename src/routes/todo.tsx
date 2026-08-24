import { useMemo, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Check, Crown, ListTodo, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useSubscription } from "@/hooks/useSubscription";
import { useTodos, type Todo } from "@/hooks/useTodos";
import { todoDueDate } from "@/hooks/useTodoReminders";
import { TodoDebugPanel } from "@/components/TodoDebugPanel";
import { FREE_TODO_LIMIT } from "@/lib/premium";
import { fmt, formatMediumDate } from "@/lib/dates";

export const Route = createFileRoute("/todo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "To-Do Notizen – Muslim Appointment Calendar" },
      {
        name: "description",
        content:
          "Aufgabenliste für Muslime: To-Do-Notizen mit Fälligkeitsdatum, Wichtig-Markierung und Notizen – passend zum Kalender mit Gebetszeiten.",
      },
      { property: "og:title", content: "To-Do Notizen – Muslim Appointment Calendar" },
      {
        property: "og:description",
        content: "Aufgaben festhalten, priorisieren und rund um die Gebetszeiten planen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GatedTodoPage,
});

function TodoPage() {
  const { t } = useI18n();
  const { isPremium } = useSubscription();
  const { todos, add, update, remove, clearDone, loaded } = useTodos();
  const [title, setTitle] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const open = useMemo(
    () =>
      todos
        .filter((x) => !x.done)
        .sort((a, b) => Number(b.important) - Number(a.important) || (a.due ?? "9").localeCompare(b.due ?? "9")),
    [todos],
  );
  const done = useMemo(() => todos.filter((x) => x.done), [todos]);

  const submit = () => {
    const value = title.trim();
    if (!value) return;
    if (!isPremium && todos.length >= FREE_TODO_LIMIT) {
      toast.error(t("todo.limit", { n: FREE_TODO_LIMIT }), {
        action: { label: t("premium.upgrade"), onClick: () => (window.location.href = "/premium") },
      });
      return;
    }
    add(value);
    setTitle("");
  };

  return (
    <main className="min-h-screen bg-background">
      <Toaster />
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <ListTodo className="h-6 w-6 text-primary" /> {t("todo.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("todo.subtitle")}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <CalendarDays className="mr-1 h-4 w-4" /> {t("todo.back")}
            </Link>
          </Button>
        </header>

        {!isPremium && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
            <span>{t("todo.premiumHint", { n: FREE_TODO_LIMIT })}</span>
            <Button size="sm" asChild>
              <Link to="/premium">
                <Crown className="mr-1 h-4 w-4" /> {t("premium.upgrade")}
              </Link>
            </Button>
          </div>
        )}

        {import.meta.env.DEV && <TodoDebugPanel />}

        <div className="flex gap-2">
          <Input
            value={title}
            placeholder={t("todo.placeholder")}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            aria-label={t("todo.add")}
          />
          <Button onClick={submit}>
            <Plus className="mr-1 h-4 w-4" /> {t("todo.add")}
          </Button>
        </div>

        {!loaded ? (
          <div className="h-32 animate-pulse rounded-xl bg-secondary" />
        ) : (
          <section className="space-y-2">
            <h2 className="text-xs font-medium uppercase text-muted-foreground">
              {t("todo.openTasks")} ({open.length})
            </h2>
            {open.length === 0 && <p className="text-sm text-muted-foreground">{t("todo.empty")}</p>}
            {open.map((item) => (
              <Row
                key={item.id}
                item={item}
                expanded={openId === item.id}
                isPremium={isPremium}
                onToggleExpand={() => setOpenId(openId === item.id ? null : item.id)}
                onUpdate={(patch) => update(item.id, patch)}
                onRemove={() => remove(item.id)}
              />
            ))}
          </section>
        )}

        {done.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase text-muted-foreground">
                {t("todo.done")} ({done.length})
              </h2>
              <Button variant="ghost" size="sm" onClick={clearDone}>
                {t("todo.clearDone")}
              </Button>
            </div>
            {done.map((item) => (
              <Row
                key={item.id}
                item={item}
                expanded={false}
                isPremium={isPremium}
                onToggleExpand={() => undefined}
                onUpdate={(patch) => update(item.id, patch)}
                onRemove={() => remove(item.id)}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function Row({
  item,
  expanded,
  isPremium,
  onToggleExpand,
  onUpdate,
  onRemove,
}: {
  item: Todo;
  expanded: boolean;
  isPremium: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<Todo>) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const dueAt = todoDueDate(item);
  const overdue = !item.done && dueAt ? dueAt.getTime() < Date.now() : false;
  const reminder = item.reminderMinutes ?? -1;

  const setReminder = (value: number) => {
    if (value >= 0 && !isPremium) {
      toast.error(t("todo.remindPremium"), {
        action: { label: t("premium.upgrade"), onClick: () => (window.location.href = "/premium") },
      });
      return;
    }
    if (value >= 0 && !item.due) {
      toast.error(t("todo.remindNeedsDue"));
      return;
    }
    onUpdate({ reminderMinutes: value });
    if (value >= 0 && typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.done}
          onCheckedChange={(v) => onUpdate({ done: Boolean(v) })}
          aria-label={t("todo.done")}
          className="mt-0.5"
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="min-w-0 flex-1 text-left"
        >
          <p className={"truncate text-sm " + (item.done ? "text-muted-foreground line-through" : "")}>
            {item.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {dueAt ? (
              <span className={overdue ? "text-destructive" : ""}>
                {overdue ? t("todo.overdue") : t("todo.due")}:{" "}
                <bdi>{formatMediumDate(dueAt)}{item.dueTime ? `, ${fmt(dueAt, "HH:mm")}` : ""}</bdi>
              </span>
            ) : (
              t("todo.noDue")
            )}
            {reminder >= 0 ? " · 🔔" : ""}
            {item.notes ? " · " + item.notes.slice(0, 40) : ""}
          </p>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("todo.important")}
          onClick={() => onUpdate({ important: !item.important })}
        >
          <Star
            className={"h-4 w-4 " + (item.important ? "fill-accent text-accent" : "text-muted-foreground")}
          />
        </Button>
        <Button variant="ghost" size="icon" aria-label={t("todo.delete")} onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={item.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              className="flex-1"
            />
            <Input
              type="date"
              value={item.due ?? ""}
              onChange={(e) =>
                onUpdate(
                  e.target.value
                    ? { due: e.target.value }
                    : { due: null, dueTime: null, reminderMinutes: -1 },
                )
              }
              className="w-40"
              aria-label={t("todo.due")}
            />
            <Input
              type="time"
              value={item.dueTime ?? ""}
              onChange={(e) => onUpdate({ dueTime: e.target.value || null })}
              className="w-28"
              aria-label={t("todo.time")}
            />
            <Select value={String(reminder)} onValueChange={(v) => setReminder(Number(v))}>
              <SelectTrigger className="w-44" aria-label={t("todo.reminder")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[-1, 0, 10, 30, 60, 1440].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m < 0
                      ? t("todo.remindNone")
                      : m === 0
                        ? t("todo.remindAtDue")
                        : t("todo.remindBefore", { m })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            rows={2}
            value={item.notes ?? ""}
            placeholder={t("todo.notesPlaceholder")}
            onChange={(e) => onUpdate({ notes: e.target.value })}
          />
          <Button size="sm" variant="secondary" onClick={onToggleExpand}>
            <Check className="mr-1 h-4 w-4" /> OK
          </Button>
        </div>
      )}
    </div>
  );
}

function GatedTodoPage() {
  return (
    <AccessGate>
      <TodoPage />
    </AccessGate>
  );
}
