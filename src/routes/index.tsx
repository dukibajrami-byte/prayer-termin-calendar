import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, addMonths, startOfDay } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { MonthView } from "@/components/calendar/MonthView";
import { EventDialog } from "@/components/calendar/EventDialog";
import { SettingsDialog } from "@/components/calendar/SettingsDialog";
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
import { AUTO_LOCATION, resolveLocationName } from "@/lib/location";
import { InstallButton } from "@/components/InstallButton";
import {
  DEFAULT_CALENDARS,
  DEFAULT_SETTINGS,
  useEvents,
  useLocalState,
  type CalEvent,
  type Settings,
} from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Muslimischer Terminkalender – Termine & Gebetszeiten" },
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
  component: Index,
});

type ViewMode = "day" | "week" | "month";

function Index() {
  const { t, lang, setLang } = useI18n();
  const [settings, setSettings] = useLocalState<Settings>("mtk.settings", DEFAULT_SETTINGS);
  const { events, upsert, remove } = useEvents();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [draft, setDraft] = useState<CalEvent | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      (pos) => {
        setLocating(false);
        setSettings((prev) => ({
          ...prev,
          latitude: Number(pos.coords.latitude.toFixed(4)),
          longitude: Number(pos.coords.longitude.toFixed(4)),
          locationName: AUTO_LOCATION,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || prev.timeZone,
        }));
        toast.success(t("toast.located"));
      },
      () => {
        setLocating(false);
        toast.error(t("toast.geoFailed"));
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  }, [setSettings, t]);

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

  // Erinnerungen für Termine und Gebete
  useEffect(() => {
    const fire = (msg: string, description: string) => {
      toast(msg, { description });
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(msg, { body: description });
      }
    };
    for (const e of events) {
      if (e.reminderMinutes < 0) continue;
      const at = new Date(e.start).getTime() - e.reminderMinutes * 60_000;
      const key = `event-${e.id}-${at}`;
      if (!notified.current.has(key) && at <= now.getTime() && now.getTime() - at < 120_000) {
        notified.current.add(key);
        fire(
          t("notif.event", { title: e.title }),
          t("notif.eventBody", { time: fmt(new Date(e.start), "HH:mm") }),
        );
      }
    }
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
  }, [now, events, upcoming, settings.prayerReminderMinutes, t]);

  const openNew = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    setDraft({
      id: crypto.randomUUID(),
      title: "",
      start: start.toISOString(),
      end: end.toISOString(),
      calendarId: DEFAULT_CALENDARS[0]!.id,
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
  const rangeLabel =
    view === "month"
      ? fmt(cursor, "MMMM yyyy")
      : view === "day"
        ? fmt(cursor, "EEEE, d. MMMM yyyy")
        : `${fmt(days[0]!, "d. MMM")} – ${fmt(days[6]!, "d. MMM yyyy")}`;

  return (
    <main className="min-h-screen bg-background">
      <Toaster />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">
              {t("app.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("app.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-border p-0.5">
              {(Object.keys(LANGS) as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={
                    "rounded px-2 py-1 text-xs font-medium uppercase transition-colors " +
                    (lang === code
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary")
                  }
                >
                  {code}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-1 h-4 w-4" /> {t("nav.settings")}
            </Button>
            <InstallButton />
            <Button
              size="sm"
              onClick={() => {
                const start = new Date();
                start.setMinutes(0, 0, 0);
                openNew(start);
              }}
            >
              <CalendarPlus className="mr-1 h-4 w-4" /> {t("nav.newEvent")}
            </Button>
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

        <div className="flex flex-wrap items-center justify-between gap-3">
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

        {!hydrated ? (
          <div className="h-[480px] animate-pulse rounded-xl bg-secondary" />
        ) : view === "month" ? (
          <MonthView
            month={cursor}
            events={events}
            calendars={DEFAULT_CALENDARS}
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
            calendars={DEFAULT_CALENDARS}
            config={config}
            conflictIds={conflictIds}
            onCreate={openNew}
            onSelect={(e) => {
              setDraft(e);
              setEventOpen(true);
            }}
          />
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-3 w-4 rounded-sm bg-prayer/30 ring-1 ring-prayer/50" /> {t("legend.prayer")}
          </span>
          {DEFAULT_CALENDARS.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
              {t(`cal.${c.id}`)}
            </span>
          ))}
          <span className="flex items-center gap-1">⚠️ {t("legend.conflict")}</span>
        </div>
      </div>

      <EventDialog
        open={eventOpen}
        onOpenChange={setEventOpen}
        draft={draft}
        calendars={DEFAULT_CALENDARS}
        config={config}
        onSave={upsert}
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
    </main>
  );
}
