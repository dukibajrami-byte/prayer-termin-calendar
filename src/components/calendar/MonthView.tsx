import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/utils";
import { fmt, sameDay } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import { getPrayerSlots, type PrayerConfig } from "@/lib/prayer";
import { holidaysOn } from "@/lib/holidays";
import type { CalEvent, SharedCalendar } from "@/lib/store";

interface Props {
  month: Date;
  events: CalEvent[];
  calendars: SharedCalendar[];
  config: PrayerConfig;
  conflictIds: Set<string>;
  onSelectDay: (day: Date) => void;
  onSelect: (event: CalEvent) => void;
}

export function MonthView({
  month,
  events,
  calendars,
  config,
  conflictIds,
  onSelectDay,
  onSelect,
}: Props) {
  const { t } = useI18n();
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  const today = new Date();

  return (
    <div className="surface w-full overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            key={i}
            className="px-2 py-2 text-center text-[11px] uppercase tracking-wide text-muted-foreground"
          >
            {fmt(addDays(start, i), "EEEEEE")}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = events
            .filter((e) => sameDay(new Date(e.start), day))
            .sort((a, b) => a.start.localeCompare(b.start));
          const slots = getPrayerSlots(day, config);
          const holidays = holidaysOn(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-28 border-b border-l border-border p-1.5 text-left align-top transition-colors hover:bg-secondary/50",
                !isSameMonth(day, month) && "bg-muted/40 text-muted-foreground",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-display text-sm",
                    sameDay(day, today) &&
                      "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground",
                  )}
                >
                  {fmt(day, "d")}
                </span>
                <span className="text-[9px] text-prayer-foreground/70">
                  {fmt(slots[1]!.start, "HH:mm")}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {holidays.map((h) => (
                  <span
                    key={h}
                    className="block truncate rounded bg-accent/20 px-1 py-0.5 text-[9px] font-medium text-accent-foreground"
                    title={t(`holiday.${h}`)}
                  >
                    {t(`holiday.${h}`)}
                  </span>
                ))}
                {dayEvents.slice(0, 3).map((e) => {
                  const cal = calendars.find((c) => c.id === e.calendarId);
                  return (
                    <span
                      key={e.id}
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onSelect(e);
                      }}
                      onKeyDown={(ev) => ev.key === "Enter" && onSelect(e)}
                      className={cn(
                        "flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]",
                        conflictIds.has(e.id) ? "bg-warning/30" : "bg-secondary",
                      )}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: cal?.color }}
                      />
                      <span className="truncate">
                        {fmt(new Date(e.start), "HH:mm")} {e.title}
                      </span>
                    </span>
                  );
                })}
                {dayEvents.length > 3 && (
                  <span className="block text-[10px] text-muted-foreground">
                    {t("month.more", { n: dayEvents.length - 3 })}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}