import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { fmt, minutesOfDay, sameDay } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import type { PrayerConfig, PrayerSlot } from "@/lib/prayer";
import { getPrayerSlots } from "@/lib/prayer";
import { holidaysOn } from "@/lib/holidays";
import type { CalEvent, SharedCalendar } from "@/lib/store";

const HOUR_HEIGHT = 52;
const LABEL_HEIGHT = 13;


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

  // Prayer times must be placed in the column of the day they actually occur on.
  // adhan returns e.g. Isha for 26 May as 27 May 00:48 at high latitudes, so we
  // also look at the previous/next day and filter by the real local date.
  const prayersByDay = useMemo(
    () =>
      days.map((d) =>
        [
          ...getPrayerSlots(new Date(d.getTime() - 86_400_000), config),
          ...getPrayerSlots(d, config),
          ...getPrayerSlots(new Date(d.getTime() + 86_400_000), config),
        ]
          .filter((p) => sameDay(p.start, d))
          .sort((a, b) => a.start.getTime() - b.start.getTime()),
      ),
    [days, config],
  );


  // Static grid: only render the hours that actually contain something,
  // so day/week views fit without an inner scroll area.
  const [startHour, endHour] = useMemo(() => {
    let min = 7;
    let max = 21;
    for (const slots of prayersByDay) {
      for (const p of slots) {
        min = Math.min(min, p.start.getHours());
        max = Math.max(max, p.end.getHours() + 1);
      }
    }
    for (const e of events) {
      const s = new Date(e.start);
      const en = new Date(e.end);
      if (days.some((d) => sameDay(s, d))) {
        min = Math.min(min, s.getHours());
        max = Math.max(max, en.getHours() + (en.getMinutes() > 0 ? 1 : 0));
      }
    }
    return [Math.max(0, min), Math.min(24, Math.max(max, min + 6))];
  }, [prayersByDay, events, days]);

  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const offset = startHour * HOUR_HEIGHT;
  const gridHeight = hours.length * HOUR_HEIGHT;

  return (
    <div className="surface w-full overflow-hidden [--gutter:44px] sm:[--gutter:56px]">
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `var(--gutter) repeat(${days.length}, minmax(0,1fr))` }}>
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

      <div ref={scrollRef}>
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `var(--gutter) repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div
                key={h}
                className="relative text-[11px] text-muted-foreground"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2 right-2">{`${String(h).padStart(2, "0")}:00`}</span>
              </div>
            ))}
          </div>

          {days.map((day, dayIndex) => {
            const dayEvents = events.filter((e) => sameDay(new Date(e.start), day));
            return (
              <div
                key={day.toISOString()}
                className="relative border-l border-border"
                style={{ height: gridHeight }}
              >
                {hours.map((h) => (
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

                {(() => {
                  const slots = prayersByDay[dayIndex] ?? [];
                  let lastLabelBottom = -Infinity;
                  return slots.map((p: PrayerSlot) => {
                    const top = (minutesOfDay(p.start) / 60) * HOUR_HEIGHT - offset;
                    const height = Math.max(
                      14,
                      ((p.end.getTime() - p.start.getTime()) / 3_600_000) * HOUR_HEIGHT,
                    );
                    // Keep the band at its exact time, but push the label down
                    // when the previous label would overlap it.
                    const labelTop = Math.max(top, lastLabelBottom);
                    lastLabelBottom = labelTop + LABEL_HEIGHT + 1;
                    const time = fmt(p.start, "HH:mm");
                    const name = t(`prayer.${p.name}`);
                    return (
                      <div key={`${p.name}-${p.start.getTime()}`} className="pointer-events-none">
                        <div
                          className="absolute inset-x-0 z-10 border-y border-prayer/40 bg-prayer/15"
                          style={{ top, height }}
                          title={`${name} · ${time}`}
                        />
                        <div
                          className="absolute inset-x-0 z-10 overflow-hidden px-1"
                          style={{ top: labelTop, height: LABEL_HEIGHT }}
                        >
                          <span
                            className="block truncate font-semibold uppercase tracking-tight text-prayer-foreground text-[9px] sm:text-[10px]"
                            style={{ lineHeight: `${LABEL_HEIGHT}px` }}
                          >
                            {days.length === 1 ? (
                              <span>{name} · {time}</span>
                            ) : (
                              <>
                                <span className="sm:hidden">
                                  {name.charAt(0)} {time}
                                </span>
                                <span className="hidden sm:inline">
                                  {name} · {time}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()}


                {dayEvents.map((e) => {
                  const start = new Date(e.start);
                  const end = new Date(e.end);
                  const top = (minutesOfDay(start) / 60) * HOUR_HEIGHT - offset;
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
                    style={{ top: (minutesOfDay(now) / 60) * HOUR_HEIGHT - offset }}
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