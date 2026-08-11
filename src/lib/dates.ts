import { de, enUS, arSA, sq } from "date-fns/locale";
import type { Locale } from "date-fns";
import { addDays, format, startOfWeek } from "date-fns";

const LOCALES: Record<string, Locale> = { de, en: enUS, ar: arSA, sq };

let current: Locale = de;

export function setDateLocale(lang: string) {
  current = LOCALES[lang] ?? enUS;
}

export function getDateLocale() {
  return current;
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
