export type HolidayKey =
  | "newYear"
  | "ashura"
  | "mawlid"
  | "isra"
  | "baraah"
  | "ramadanStart"
  | "laylatQadr"
  | "eidFitr"
  | "arafah"
  | "eidAdha";

interface HolidayDef {
  key: HolidayKey;
  month: number; // Hijri month (1-12)
  day: number;
}

const DEFS: HolidayDef[] = [
  { key: "newYear", month: 1, day: 1 },
  { key: "ashura", month: 1, day: 10 },
  { key: "mawlid", month: 3, day: 12 },
  { key: "isra", month: 7, day: 27 },
  { key: "baraah", month: 8, day: 15 },
  { key: "ramadanStart", month: 9, day: 1 },
  { key: "laylatQadr", month: 9, day: 27 },
  { key: "eidFitr", month: 10, day: 1 },
  { key: "arafah", month: 12, day: 9 },
  { key: "eidAdha", month: 12, day: 10 },
];

const formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export interface HijriDate {
  day: number;
  month: number;
  year: number;
}

export function toHijri(date: Date): HijriDate {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
  const parts = formatter.formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value?.replace(/\D/g, "") ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

export function hijriLabel(date: Date) {
  const h = toHijri(date);
  return `${h.day}.${h.month}.${h.year} AH`;
}

/** Returns the holidays falling on the given Gregorian day (usually 0 or 1). */
export function holidaysOn(date: Date): HolidayKey[] {
  const h = toHijri(date);
  return DEFS.filter((d) => d.month === h.month && d.day === h.day).map((d) => d.key);
}

/** Upcoming holidays within the next `days` days, sorted by date. */
export function upcomingHolidays(from: Date, days = 400) {
  const out: Array<{ key: HolidayKey; date: Date }> = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < days; i++) {
    const d = new Date(cursor.getTime() + i * 86_400_000);
    for (const key of holidaysOn(d)) out.push({ key, date: d });
  }
  return out;
}
