import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, addMonths, startOfDay } from "date-fns";
import { CalendarPlus, CalendarDays, ChevronLeft, ChevronRight, Compass, ListTodo, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { MonthView } from "@/components/calendar/MonthView";
import { EventDialog } from "@/components/calendar/EventDialog";
import { SettingsDialog } from "@/components/calendar/SettingsDialog";
import { CalendarManagerDialog } from "@/components/calendar/CalendarManagerDialog";
import { PrayerStrip } from "@/components/calendar/PrayerStrip";
import { fmt, weekDays } from "@/lib/dates";
import {
  collidingPrayers,
  getPrayerSlots,
  nextPrayer,
  type PrayerConfig,
  type PrayerSlot,
} from "@/lib/prayer";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";
import { AUTO_LOCATION, resolveLocationName, reverseGeocode } from "@/lib/location";
import { hijriLabel, upcomingHolidays } from "@/lib/holidays";
import { InstallButton } from "@/components/InstallButton";
import { Link } from "@tanstack/react-router";
import { useSubscription } from "@/hooks/useSubscription";
import { FREE_REMINDER_LIMIT } from "@/lib/premium";
import {
  DEFAULT_CALENDARS,
  DEFAULT_SETTINGS,
  useLocalState,
  type CalEvent,
  type Settings,
  type SharedCalendar,
} from "@/lib/store";
import { useEvents } from "@/hooks/useEvents";




export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Muslimischer Terminkalender & Gebetszeiten" },
      {
        name: "description",
        content:
          "Kalender für Muslime: Gebetszeiten standortbasiert berechnen, im Kalender sehen und Termine ohne Kollision mit Fajr, Dhuhr, Asr, Maghrib und Isha planen.",
      },
      { property: "og:title", content: "Muslimischer Terminkalender" },
      {
        property: "og:description",
        content:
          "Plane Termine rund um die täglichen Gebetszeiten – mit Warnung bei Überschneidungen.",
      },
    ],
  }),
  component: GatedIndex,
});

type ViewMode = "day" | "week" | "month";

function Index() {
  const { t, lang, setLang } = useI18n();
  const [settings, setSettings] = useLocalState<Settings>("mtk.settings", DEFAULT_SETTINGS);
  const { isPremium } = useSubscription();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const { events, calendars, upsert, remove } = useEvents(cursor, view);
  const calendarName = (c: SharedCalendar) =>
    DEFAULT_CALENDARS.some((dc) => dc.id === c.id) ? t(`cal.${c.id}`) : c.name;
  const [draft, setDraft] = useState<CalEvent | null>(null);


  const [eventOpen, setEventOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [locating, setLocating] = useState(false);

  const [now, setNow] = useState(() => new Date());
  const notified = useRef<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const config: PrayerConfig = useMemo(
    () => ({
      latitude: settings.latitude,
      longitude: settings.longitude,
      method: settings.method,
      madhab: settings.madhab,
      durationMinutes: settings.durationMinutes,
    }),
    [settings],
  );

  // Uhr / automatische Aktualisierung der Gebetszeiten
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("toast.geoUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        setSettings((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          locationName: AUTO_LOCATION,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || prev.timeZone,
        }));
        toast.success(t("toast.located"));
        const place = await reverseGeocode(lat, lon, lang);
        if (place) {
          setSettings((prev) =>
            prev.locationName === AUTO_LOCATION ? { ...prev, locationName: place } : prev,
          );
        }
      },
      () => {
        setLocating(false);
        toast.error(t("toast.geoFailed"));
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }, [setSettings, t, lang]);

  useEffect(() => {
    if (settings.autoLocation && settings.locationName === DEFAULT_SETTINGS.locationName) {
      locate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoLocation]);

  const todaySlots = useMemo(() => getPrayerSlots(now, config), [now, config]);
  const upcoming: PrayerSlot | null = useMemo(() => nextPrayer(now, config), [now, config]);

  const countdown = useMemo(() => {
    if (!upcoming) return "";
    const diff = Math.max(0, upcoming.start.getTime() - now.getTime());
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return h > 0
      ? `${h} ${t("time.hours")} ${m} ${t("time.minutes")}`
      : `${m} ${t("time.minutes")}`;
  }, [upcoming, now, t]);

  const conflictIds = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (collidingPrayers(new Date(e.start), new Date(e.end), config).length > 0) set.add(e.id);
    }
    return set;
  }, [events, config]);

  const nextHolidays = useMemo(() => upcomingHolidays(now).slice(0, 4), [now]);

  // Gebets-Erinnerungen (Termin-Erinnerungen laufen global in useEventReminders)
  useEffect(() => {
    const fire = (msg: string, description: string) => {
      toast(msg, { description });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(msg, { body: description });
      }
    };
    if (upcoming && settings.prayerReminderMinutes >= 0) {
      const at = upcoming.start.getTime() - settings.prayerReminderMinutes * 60_000;
      const key = `prayer-${upcoming.name}-${at}`;
      if (!notified.current.has(key) && at <= now.getTime() && now.getTime() - at < 120_000) {
        notified.current.add(key);
        fire(
          t("notif.prayerSoon", { label: t(`prayer.${upcoming.name}`) }),
          t("notif.prayerBody", { time: fmt(upcoming.start, "HH:mm") }),
        );
      }
    }
  }, [now, upcoming, settings.prayerReminderMinutes, t]);

  const openNew = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    const defaultCalendar = calendars[0] ?? DEFAULT_CALENDARS[0]!;
    setDraft({
      id: crypto.randomUUID(),
      title: "",
      start: start.toISOString(),
      end: end.toISOString(),
      calendarId: defaultCalendar.id,
      reminderMinutes: 15,
    });
    setEventOpen(true);
  };


  const step = (dir: 1 | -1) => {
    setCursor((c) =>
      view === "month" ? addMonths(c, dir) : addDays(c, view === "week" ? 7 * dir : dir),
    );
  };

  const days = view === "day" ? [cursor] : weekDays(cursor);

  const saveEvent = (event: CalEvent) => {
    if (!isPremium && event.reminderMinutes >= 0) {
      const used = events.filter((e) => e.id !== event.id && e.reminderMinutes >= 0).length;
      if (used >= FREE_REMINDER_LIMIT) {
        toast.error(t("premium.reminderLimit", { n: FREE_REMINDER_LIMIT }), {
          action: {
            label: t("premium.upgrade"),
            onClick: () => {
              window.location.href = "/premium";
            },
          },
        });
        upsert({ ...event, reminderMinutes: -1 });
        return;
      }
    }
    upsert(event);
  };
  const rangeLabel =
    view === "month"
      ? fmt(cursor, "MMMM yyyy")
      : view === "day"
        ? fmt(cursor, "EEEE, d. MMMM yyyy")
        : `${fmt(days[0]!, "d. MMM")} – ${fmt(days[6]!, "d. MMM yyyy")}`;

  return (
    <main className="min-h-screen bg-background">
      <Toaster />
      <div className="mx-auto max-w-6xl space-y-5 px-0 py-6 sm:px-4">
        <header className="space-y-3 px-4 sm:space-y-2 sm:px-0">
          {/* Title/subtitle + language/settings */}
          <div className="space-y-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-2 sm:space-y-0">
            {/* Title + subtitle */}
            <div className="space-y-1">
              <h1 className="font-display text-lg font-semibold leading-tight text-foreground sm:text-2xl sm:truncate">
                {t("app.headline")}
              </h1>
              <p className="text-sm text-muted-foreground sm:truncate">
                {t("app.subtitle")}
              </p>
            </div>

            {/* Language selector + Settings */}
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <div className="flex min-w-0 items-center rounded-md border border-border p-0.5">
                {(Object.keys(LANGS) as Lang[]).map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLang(code)}
                    aria-pressed={lang === code}
                    className={
                      "rounded px-1 py-1 text-[10px] font-medium uppercase transition-colors sm:px-2 sm:text-xs " +
                      (lang === code
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-secondary")
                    }
                  >
                    {code}
                  </button>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <div className="sm:hidden">
                  <InstallButton />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 whitespace-nowrap px-2 text-xs shadow-sm sm:px-3"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings2 className="mr-1 h-4 w-4" />
                  {t("nav.settings")}
                </Button>
              </div>
            </div>
          </div>

          {/* Mobile action grid: 2 rows × 2 columns */}
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full"
              onClick={() => setCalendarOpen(true)}
            >
              <CalendarDays className="mr-1 h-4 w-4 shrink-0" /> {t("calendars.manage")}
            </Button>
            <Button variant="outline" size="sm" className="h-10 w-full" asChild>
              <Link to="/todo">
                <ListTodo className="mr-1 h-4 w-4 shrink-0" /> {t("todo.nav")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-10 w-full" asChild>
              <Link to="/qibla">
                <Compass className="mr-1 h-4 w-4 shrink-0" /> {t("qibla.nav")}
              </Link>
            </Button>
            <Button
              size="sm"
              className="h-10 w-full"
              onClick={() => {
                const start = new Date();
                start.setMinutes(0, 0, 0);
                openNew(start);
              }}
            >
              <CalendarPlus className="mr-1 h-4 w-4 shrink-0" /> {t("nav.newEvent")}
            </Button>
          </div>

          {/* Desktop action row */}
          <div className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setCalendarOpen(true)}
            >
              <CalendarDays className="mr-1 h-4 w-4" /> {t("calendars.manage")}
            </Button>
            <Button variant="outline" size="sm" className="h-8" asChild>
              <Link to="/todo">
                <ListTodo className="mr-1 h-4 w-4" /> {t("todo.nav")}
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="h-8" asChild>
              <Link to="/qibla">
                <Compass className="mr-1 h-4 w-4" /> {t("qibla.nav")}
              </Link>
            </Button>
            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                const start = new Date();
                start.setMinutes(0, 0, 0);
                openNew(start);
              }}
            >
              <CalendarPlus className="mr-1 h-4 w-4" /> {t("nav.newEvent")}
            </Button>
            <InstallButton />
          </div>
        </header>

        {!hydrated ? (
          <div className="h-40 animate-pulse rounded-2xl bg-secondary" />
        ) : (
          <PrayerStrip
            slots={todaySlots}
            next={upcoming}
            locationName={resolveLocationName(
              settings.locationName,
              t,
              settings.latitude,
              settings.longitude,
            )}
            countdown={countdown}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-0">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label={t("nav.prev")} onClick={() => step(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label={t("nav.next")} onClick={() => step(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="ml-2 font-display text-lg">{hydrated ? rangeLabel : ""}</span>
            <Button
              variant="link"
              size="sm"
              onClick={() => setCursor(startOfDay(new Date()))}
            >
              {t("nav.today")}
            </Button>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="day">{t("view.day")}</TabsTrigger>
              <TabsTrigger value="week">{t("view.week")}</TabsTrigger>
              <TabsTrigger value="month">{t("view.month")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <h2 className="sr-only">{t("section.calendar")}</h2>

        {!hydrated ? (
          <div className="h-[480px] animate-pulse rounded-xl bg-secondary" />
        ) : view === "month" ? (
          <MonthView
            month={cursor}
            events={events}
            calendars={calendars}
            config={config}
            conflictIds={conflictIds}
            onSelectDay={(d) => {
              setCursor(d);
              setView("day");
            }}
            onSelect={(e) => {
              setDraft(e);
              setEventOpen(true);
            }}
          />
        ) : (
          <TimeGrid
            days={days}
            events={events}
            calendars={calendars}
            config={config}
            conflictIds={conflictIds}
            onCreate={openNew}
            onSelect={(e) => {
              setDraft(e);
              setEventOpen(true);
            }}
          />
        )}


        <div className="flex flex-wrap items-center gap-4 px-4 text-xs text-muted-foreground sm:px-0">
          <span className="flex items-center gap-1">
            <span className="h-3 w-4 rounded-sm bg-prayer/30 ring-1 ring-prayer/50" /> {t("legend.prayer")}
          </span>
          <span className="flex items-center gap-1"><Sparkles className="h-3 w-3 text-accent" /> {t("legend.holiday")}</span>
          {calendars.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {calendarName(c)}
            </span>
          ))}
          <span className="flex items-center gap-1">⚠️ {t("legend.conflict")}</span>
        </div>

        {hydrated && (
          <section className="mx-4 rounded-2xl border border-border bg-card p-4 sm:mx-0">
            <h2 className="font-display text-lg text-foreground">{t("holidays.title")}</h2>
            <p className="text-xs text-muted-foreground">{hijriLabel(now)}</p>
            <ul className="mt-3 space-y-2">
              {nextHolidays.map(({ key, date }) => (
                <li
                  key={`${key}-${date.toDateString()}`}
                  className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 text-sm last:border-0 last:pb-0"
                >
                  <span className="flex min-w-0 items-center gap-2 font-medium"><Sparkles className="h-4 w-4 shrink-0 text-accent" /><span className="truncate">{t(`holiday.${key}`)}</span></span>
                  <span className="shrink-0 text-muted-foreground">{fmt(date, "d. MMM yyyy")}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">{t("holidays.note")}</p>
          </section>
        )}
      </div>

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        draft={draft}
        calendars={calendars.map((c) => ({ ...c, name: calendarName(c) }))}
        config={config}
        onSave={saveEvent}
        onDelete={remove}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onChange={(patch) => setSettings((prev) => ({ ...prev, ...patch }))}
        onLocate={locate}
        locating={locating}
      />

      <CalendarManagerDialog open={calendarOpen} onOpenChange={setCalendarOpen} />
    </main>
  );
}

function GatedIndex() {
  return (
    <AccessGate>
      <Index />
    </AccessGate>
  );
}
