import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { fmt, minutesOfDay, sameDay } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import type { PrayerConfig, PrayerSlot } from "@/lib/prayer";
import { getPrayerSlots } from "@/lib/prayer";
import { holidaysOn } from "@/lib/holidays";
import type { CalEvent, SharedCalendar } from "@/lib/store";

const HOUR_HEIGHT = 56;

interface Props {
  days: Date[];
  events: CalEvent[];
  calendars: SharedCalendar[];
  config: PrayerConfig;
  onCreate: (start: Date) => void;
  onSelect: (event: CalEvent) => void;
  conflictIds: Set<string>;
}

export function TimeGrid({
  days,
  events,
  calendars,
  config,
  onCreate,
  onSelect,
  conflictIds,
}: Props) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = new Date();

  const prayersByDay = useMemo(
    () => days.map((d) => getPrayerSlots(d, config)),
    [days, config],
  );

  return (
    <div className="surface overflow-hidden">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}>
        <div />
        {days.map((d) => (
          <div
            key={d.toISOString()}
            className={cn(
              "px-2 py-3 text-center",
              sameDay(d, now) && "bg-prayer-soft/60",
            )}
          >
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {fmt(d, "EEEEEE")}
            </div>
            <div
              className={cn(
                "font-display text-lg",
                sameDay(d, now) ? "text-primary font-semibold" : "text-foreground",
              )}
            >
              {fmt(d, "d")}
            </div>
            {holidaysOn(d).map((h) => (
              <div
                key={h}
                title={t(`holiday.${h}`)}
                className="mx-auto mt-0.5 max-w-full truncate rounded bg-accent/20 px-1 text-[9px] font-medium text-accent-foreground"
              >
                ✨ {days.length === 1 ? t(`holiday.${h}`) : t(`holiday.${h}`)}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto">
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="relative text-[11px] text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2">{h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}</span>
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const dayEvents = events.filter((e) => sameDay(new Date(e.start), day));
            return (
              <div key={day.toISOString()} className="relative border-l border-border">
                {Array.from({ length: 24 }, (_, h) => (
                  <button
                    key={h}
                    type="button"
                    aria-label={t("grid.createAria", { date: fmt(day, "d MMMM"), hour: h })}
                    onClick={() => {
                      const d = new Date(day);
                      d.setHours(h, 0, 0, 0);
                      onCreate(d);
                    }}
                    className="block w-full border-b border-border/60 transition-colors hover:bg-secondary/60"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}

                {prayersByDay[dayIndex]?.map((p: PrayerSlot) => {
                  const top = (minutesOfDay(p.start) / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    18,
                    ((p.end.getTime() - p.start.getTime()) / 3_600_000) * HOUR_HEIGHT,
                  );
                  return (
                    <div
                      key={p.name}
                      className="pointer-events-none absolute inset-x-0 z-10 border-y border-prayer/40 bg-prayer/15 px-1"
                      style={{ top, height }}
                      title={`${t(`prayer.${p.name}`)} · ${fmt(p.start, "HH:mm")}`}
                    >
                      <span className="block truncate text-[9px] font-semibold uppercase leading-none tracking-wide text-prayer-foreground sm:text-[10px]">
                        {days.length === 1 ? (
                          <span>{t(`prayer.${p.name}`)} · {fmt(p.start, "HH:mm")}</span>
                        ) : (
                          <>
                            <span className="sm:hidden">
                              {t(`prayer.${p.name}`).charAt(0)} {fmt(p.start, "HH:mm")}
                            </span>
                            <span className="hidden sm:inline">
                              {t(`prayer.${p.name}`)} · {fmt(p.start, "HH:mm")}
                            </span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}

                {dayEvents.map((e) => {
                  const start = new Date(e.start);
                  const end = new Date(e.end);
                  const top = (minutesOfDay(start) / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    22,
                    ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_HEIGHT,
                  );
                  const cal = calendars.find((c) => c.id === e.calendarId);
                  const conflict = conflictIds.has(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onSelect(e)}
                      className={cn(
                        "absolute left-1 right-1 z-20 overflow-hidden rounded-md border-l-4 px-2 py-1 text-left text-xs shadow-sm backdrop-blur-[2px]",
                        conflict
                          ? "bg-warning/25 ring-1 ring-warning"
                          : "bg-card/95 ring-1 ring-border",
                      )}
                      style={{ top, height, borderLeftColor: cal?.color }}
                    >
                      <span className="block truncate font-medium text-card-foreground">
                        {conflict ? "⚠️ " : ""}
                        {e.title}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {fmt(start, "HH:mm")}–{fmt(end, "HH:mm")}
                      </span>
                    </button>
                  );
                })}

                {sameDay(day, now) && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-accent"
                    style={{ top: (minutesOfDay(now) / 60) * HOUR_HEIGHT }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}