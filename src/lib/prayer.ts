import {
  CalculationMethod,
  Coordinates,
  Madhab,
  PrayerTimes,
  type CalculationParameters,
} from "adhan";

export type PrayerName = "fajr" | "dhuhr" | "asr" | "maghrib" | "isha";

export const PRAYER_LABELS: Record<PrayerName, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

export const METHODS = {
  MuslimWorldLeague: "Muslim World League",
  Egyptian: "Egyptian General Authority",
  Karachi: "University of Karachi",
  UmmAlQura: "Umm al-Qura, Makkah",
  Dubai: "Dubai",
  Qatar: "Qatar",
  Kuwait: "Kuwait",
  Singapore: "Singapore",
  Turkey: "Diyanet (Turkey)",
  Tehran: "Tehran",
  NorthAmerica: "ISNA (North America)",
  MoonsightingCommittee: "Moonsighting Committee",
} as const;

export type MethodKey = keyof typeof METHODS;
export type MadhabKey = "shafi" | "hanafi";

function params(method: MethodKey, madhab: MadhabKey): CalculationParameters {
  const factory = CalculationMethod as unknown as Record<string, () => CalculationParameters>;
  const p = (factory[method] ?? CalculationMethod.MuslimWorldLeague)();
  p.madhab = madhab === "hanafi" ? Madhab.Hanafi : Madhab.Shafi;
  return p;
}

export interface PrayerSlot {
  name: PrayerName;
  label: string;
  start: Date;
  end: Date;
}

export interface PrayerConfig {
  latitude: number;
  longitude: number;
  method: MethodKey;
  madhab: MadhabKey;
  /** Minuten, die pro Gebet im Kalender geblockt werden */
  durationMinutes: number;
}

export function getPrayerSlots(date: Date, cfg: PrayerConfig): PrayerSlot[] {
  const coords = new Coordinates(cfg.latitude, cfg.longitude);
  const times = new PrayerTimes(coords, date, params(cfg.method, cfg.madhab));
  const raw: Array<[PrayerName, Date]> = [
    ["fajr", times.fajr],
    ["dhuhr", times.dhuhr],
    ["asr", times.asr],
    ["maghrib", times.maghrib],
    ["isha", times.isha],
  ];
  return raw.map(([name, start]) => ({
    name,
    label: PRAYER_LABELS[name],
    start,
    end: new Date(start.getTime() + cfg.durationMinutes * 60_000),
  }));
}

export function nextPrayer(now: Date, cfg: PrayerConfig): PrayerSlot | null {
  const today = getPrayerSlots(now, cfg);
  const upcoming = today.find((p) => p.start.getTime() > now.getTime());
  if (upcoming) return upcoming;
  const tomorrow = getPrayerSlots(new Date(now.getTime() + 86_400_000), cfg);
  return tomorrow[0] ?? null;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function collidingPrayers(start: Date, end: Date, cfg: PrayerConfig): PrayerSlot[] {
  const slots = [
    ...getPrayerSlots(start, cfg),
    ...(start.toDateString() === end.toDateString() ? [] : getPrayerSlots(end, cfg)),
  ];
  return slots.filter((p) => overlaps(start, end, p.start, p.end));
}