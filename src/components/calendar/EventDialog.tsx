import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { collidingPrayers, type PrayerConfig } from "@/lib/prayer";
import { fmt, toLocalInput } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import type { CalEvent, SharedCalendar } from "@/lib/store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CalEvent | null;
  calendars: SharedCalendar[];
  config: PrayerConfig;
  onSave: (event: CalEvent) => void;
  onDelete: (id: string) => void;
}

export function EventDialog({
  open,
  onOpenChange,
  draft,
  calendars,
  config,
  onSave,
  onDelete,
}: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<CalEvent | null>(draft);

  useEffect(() => setForm(draft), [draft]);

  const conflicts = useMemo(() => {
    if (!form) return [];
    const start = new Date(form.start);
    const end = new Date(form.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];
    return collidingPrayers(start, end, config);
  }, [form, config]);

  if (!form) return null;

  const set = (patch: Partial<CalEvent>) => setForm({ ...form, ...patch });

  const shiftAfterPrayer = () => {
    const last = conflicts[conflicts.length - 1];
    if (!last) return;
    const duration = new Date(form.end).getTime() - new Date(form.start).getTime();
    const newStart = new Date(last.end);
    set({
      start: newStart.toISOString(),
      end: new Date(newStart.getTime() + duration).toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("event.title")}</DialogTitle>
          <DialogDescription>
            {t("event.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">{t("field.title")}</Label>
            <Input
              id="title"
              value={form.title}
              placeholder={t("field.titlePlaceholder")}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">{t("field.start")}</Label>
              <Input
                id="start"
                type="datetime-local"
                value={toLocalInput(new Date(form.start))}
                onChange={(e) => set({ start: new Date(e.target.value).toISOString() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">{t("field.end")}</Label>
              <Input
                id="end"
                type="datetime-local"
                value={toLocalInput(new Date(form.end))}
                onChange={(e) => set({ end: new Date(e.target.value).toISOString() })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("field.calendar")}</Label>
              <Select value={form.calendarId} onValueChange={(v) => set({ calendarId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {calendars.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {t(`cal.${c.id}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("field.reminder")}</Label>
              <Select
                value={String(form.reminderMinutes)}
                onValueChange={(v) => set({ reminderMinutes: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[-1, 5, 10, 15, 30, 60].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m < 0 ? t("reminder.none") : t("reminder.before", { m })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t("field.notes")}</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>

          {conflicts.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning/15 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-warning-foreground">
                    {t("conflict.title")}
                  </p>
                  <ul className="text-muted-foreground">
                    {conflicts.map((c) => (
                      <li key={c.name + c.start.toISOString()}>
                        {t(`prayer.${c.name}`)}: {fmt(c.start, "HH:mm")}–{fmt(c.end, "HH:mm")}
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" variant="secondary" onClick={shiftAfterPrayer}>
                    {t("conflict.shift")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              onDelete(form.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" /> {t("action.delete")}
          </Button>
          <Button
            onClick={() => {
              onSave({ ...form, title: form.title.trim() || t("event.untitled") });
              onOpenChange(false);
            }}
          >
            {t("action.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}