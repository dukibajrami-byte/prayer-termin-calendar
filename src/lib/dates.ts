import { de, enUS, arSA, sq, tr, fr, id, ms, bn, faIR, ru, es, nl, bs } from "date-fns/locale";
import type { Locale } from "date-fns";
import { addDays, format, startOfWeek } from "date-fns";

const LOCALES: Record<string, Locale> = {
  de,
  en: enUS,
  ar: arSA,
  sq,
  tr,
  fr,
  id,
  ms,
  bn,
  fa: faIR,
  ru,
  es,
  nl,
  bs,
  // Urdu has no date-fns locale yet – falls back to English formatting.
};

let current: Locale = de;
let currentTag = "de";

export function setDateLocale(lang: string) {
  current = LOCALES[lang] ?? enUS;
  currentTag = lang || "en";
}

export function getDateLocale() {
  return current;
}

/** BCP47 tag: Gregorian calendar + latin digits so dates stay unambiguous. */
function tag() {
  return `${currentTag}-u-ca-gregory-nu-latn`;
}

/**
 * Some runtimes (e.g. Chromium builds with reduced ICU data) silently fall back
 * to English for locales such as `sq`. In that case we format with the bundled
 * date-fns locale instead so month/weekday names stay localized.
 */
function intlUsable() {
  if (currentTag === "en") return true;
  try {
    const f = new Intl.DateTimeFormat(tag(), { month: "long" });
    if (f.resolvedOptions().locale.split("-")[0] !== currentTag.split("-")[0]) return false;
    // Placeholder data (e.g. "M08") means the runtime has no real month names.
    const sample = f.format(new Date(2020, 7, 1));
    return !/^M?\d+$/.test(sample);
  } catch {
    return false;
  }
}


function intl(opts: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(tag(), opts);
  } catch {
    return new Intl.DateTimeFormat("en-u-ca-gregory-nu-latn", opts);
  }
}


/** e.g. "August 2026" in the active language */
export function formatMonthYear(date: Date) {
  if (!intlUsable()) return format(date, "LLLL yyyy", { locale: current });
  return intl({ month: "long", year: "numeric" }).format(date);
}

/** e.g. "Sonntag, 23. August 2026" */
export function formatFullDate(date: Date) {
  if (!intlUsable()) return format(date, "PPPP", { locale: current });
  return intl({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
}

/** e.g. "23. Aug. 2026" */
export function formatMediumDate(date: Date) {
  if (!intlUsable()) return format(date, "PP", { locale: current });
  return intl({ day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** e.g. "17.–23. August 2026" – locale aware, correct in RTL */
export function formatDateRange(start: Date, end: Date) {
  if (!intlUsable()) {
    return `${format(start, "d", { locale: current })}–${format(end, "d MMM yyyy", { locale: current })}`;
  }

  const f = intl({ day: "numeric", month: "short", year: "numeric" });
  const anyF = f as unknown as { formatRange?: (a: Date, b: Date) => string };
  if (typeof anyF.formatRange === "function") return anyF.formatRange(start, end);
  return `${f.format(start)} – ${f.format(end)}`;
}


export function fmt(date: Date, pattern: string) {
  return format(date, pattern, { locale: current });
}


export function weekDays(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

/** Short weekday name in the active language, e.g. "Mo" / "Sun" / "اتوار" */
export function formatWeekdayShort(date: Date) {
  if (!intlUsable()) return format(date, "EEE", { locale: current });
  return intl({ weekday: "short" }).format(date);
}

/** Narrow weekday, used in dense 7-column grids. */
export function formatWeekdayNarrow(date: Date) {
  if (!intlUsable()) return format(date, "EEEEE", { locale: current });
  const narrow = intl({ weekday: "narrow" }).format(date);
  const short = intl({ weekday: "short" }).format(date);
  // Some locales (e.g. ur) fall back to a latin letter for "narrow";
  // prefer a trimmed localized short name in that case.
  if (/^[A-Za-z]/.test(narrow) && !/^[A-Za-z]/.test(short)) return short.slice(0, 3);
  return narrow;
}


/** Day number with latin digits */
export function formatDayNumber(date: Date) {
  return intl({ day: "numeric" }).format(date);
}
