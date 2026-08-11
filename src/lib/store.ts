import { useCallback, useEffect, useState } from "react";
import type { MadhabKey, MethodKey } from "./prayer";

export interface CalEvent {
  id: string;
  title: string;
  notes?: string;
  start: string; // ISO
  end: string; // ISO
  calendarId: string;
  reminderMinutes: number; // -1 = aus
}

export interface SharedCalendar {
  id: string;
  name: string;
  color: string; // oklch/hsl string
}

export interface Settings {
  method: MethodKey;
  madhab: MadhabKey;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  locationName: string;
  timeZone: string;
  prayerReminderMinutes: number;
  autoLocation: boolean;
}

export const DEFAULT_CALENDARS: SharedCalendar[] = [
  { id: "personal", name: "Privat", color: "oklch(0.55 0.12 250)" },
  { id: "work", name: "Arbeit", color: "oklch(0.6 0.13 300)" },
  { id: "family", name: "Familie", color: "oklch(0.62 0.14 30)" },
  { id: "mosque", name: "Moschee / Verein", color: "oklch(0.55 0.12 145)" },
];

export const DEFAULT_SETTINGS: Settings = {
  method: "MuslimWorldLeague",
  madhab: "shafi",
  durationMinutes: 25,
  latitude: 52.52,
  longitude: 13.405,
  locationName: "Berlin, Deutschland",
  timeZone: "Europe/Berlin",
  prayerReminderMinutes: 15,
  autoLocation: true,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function useLocalState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setValue(read<T>(key, fallback));
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* ignore */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update, loaded] as const;
}

export function useEvents() {
  const [state, setState, loaded] = useLocalState<{ items: CalEvent[] }>("mtk.events", {
    items: [],
  });

  const upsert = useCallback(
    (event: CalEvent) =>
      setState((prev) => ({
        items: prev.items.some((e) => e.id === event.id)
          ? prev.items.map((e) => (e.id === event.id ? event : e))
          : [...prev.items, event],
      })),
    [setState],
  );

  const remove = useCallback(
    (id: string) => setState((prev) => ({ items: prev.items.filter((e) => e.id !== id) })),
    [setState],
  );

  return { events: state.items, upsert, remove, loaded };
}