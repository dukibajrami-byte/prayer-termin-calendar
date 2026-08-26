import { afterEach, describe, expect, it } from "vitest";
import {
  fmt,
  formatDateRange,
  formatDayNumber,
  formatFullDate,
  formatMediumDate,
  formatMonthYear,
  formatWeekdayNarrow,
  setDateLocale,
} from "@/lib/dates";
import { holidaysOn, toHijri, upcomingHolidays } from "@/lib/holidays";

const WEEK_START = new Date(2026, 7, 17); // Mon 17 Aug 2026
const WEEK_END = new Date(2026, 7, 23); // Sun 23 Aug 2026

/** Month fragments that must appear in the localized output per locale. */
const MONTH_TOKEN: Record<string, string> = {
  de: "Aug",
  en: "Aug",
  ar: "أغسطس",
  ur: "اگست",
  fa: "اوت",
  bn: "আগ",
  fr: "août",
  tr: "Ağu",
};

const LOCALES = Object.keys(MONTH_TOKEN);
const NON_ENGLISH_NON_LATIN = ["ar", "ur", "fa", "bn"];

afterEach(() => setDateLocale("en"));

describe("localized date formatting for 17.–23. August 2026", () => {
  for (const lang of LOCALES) {
    describe(lang, () => {
      it("formats a single date with a localized month name and the correct year", () => {
        setDateLocale(lang);
        const out = formatMediumDate(WEEK_START);
        expect(out).toContain(MONTH_TOKEN[lang]!);
        expect(out).toContain("2026");
        expect(out).toContain("17");
      });

      it("formats the week range with both days in the correct semantic order", () => {
        setDateLocale(lang);
        const out = formatDateRange(WEEK_START, WEEK_END);
        expect(out).toContain(MONTH_TOKEN[lang]!);
        expect(out).toContain("2026");
        const i17 = out.indexOf("17");
        const i23 = out.indexOf("23");
        expect(i17).toBeGreaterThanOrEqual(0);
        expect(i23).toBeGreaterThan(i17); // start before end in logical order
      });

      it("uses latin digits so times/dates stay unambiguous", () => {
        setDateLocale(lang);
        expect(formatDayNumber(WEEK_START)).toBe("17");
        expect(/[٠-٩۰-۹০-৯]/.test(formatMediumDate(WEEK_START))).toBe(false);
      });

      it("keeps clock times readable as HH:mm", () => {
        setDateLocale(lang);
        const d = new Date(2026, 7, 17, 18, 25);
        expect(fmt(d, "HH:mm")).toBe("18:25");
      });

      it("localizes month + year and the full date", () => {
        setDateLocale(lang);
        expect(formatMonthYear(WEEK_START)).toContain("2026");
        expect(formatFullDate(WEEK_START)).toContain("2026");
      });
    });
  }

  it("does not leak english month names into non-latin locales", () => {
    const english = /\b(Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec|August)\b/;
    for (const lang of NON_ENGLISH_NON_LATIN) {
      setDateLocale(lang);
      expect(english.test(formatMediumDate(WEEK_START))).toBe(false);
      expect(english.test(formatMonthYear(WEEK_START))).toBe(false);
      expect(english.test(formatDateRange(WEEK_START, WEEK_END))).toBe(false);
    }
  });

  it("keeps the gregorian calendar for fa (no solar hijri year)", () => {
    setDateLocale("fa");
    const out = formatMediumDate(WEEK_START);
    expect(out).toContain("2026");
    expect(out).not.toContain("1405"); // solar hijri year for Aug 2026
    expect(out).toContain("اوت");
  });

  it("keeps the gregorian calendar for ar (no islamic year)", () => {
    setDateLocale("ar");
    expect(formatMediumDate(WEEK_START)).toContain("2026");
  });

  it("returns non-empty narrow weekdays for every tested locale", () => {
    for (const lang of LOCALES) {
      setDateLocale(lang);
      for (let i = 0; i < 7; i++) {
        const d = new Date(2026, 7, 17 + i);
        expect(formatWeekdayNarrow(d).trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("bidi isolation does not change semantics", () => {
  it("range text contains the same date tokens regardless of direction", () => {
    for (const lang of LOCALES) {
      setDateLocale(lang);
      const raw = formatDateRange(WEEK_START, WEEK_END);
      // strip bidi control characters that Intl may insert
      const stripped = raw.replace(/[\u200e\u200f\u2066-\u2069]/g, "");
      expect(stripped).toContain("17");
      expect(stripped).toContain("23");
      expect(stripped).toContain("2026");
    }
  });
});

describe("islamic holiday dates are formatted in the active locale", () => {
  it("finds upcoming holidays and formats them localized", () => {
    const holidays = upcomingHolidays(new Date(2026, 0, 1));
    expect(holidays.length).toBeGreaterThan(0);
    const first = holidays[0]!;
    for (const lang of LOCALES) {
      setDateLocale(lang);
      const label = formatMediumDate(first.date);
      expect(label).toContain(String(first.date.getFullYear()));
      if (NON_ENGLISH_NON_LATIN.includes(lang)) {
        expect(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(label)).toBe(false);
      }
    }
  });

  it("maps a known hijri conversion and detects holidays on that day", () => {
    const eidFitrIsh = upcomingHolidays(new Date(2026, 0, 1)).find((h) => h.key === "eidFitr");
    expect(eidFitrIsh).toBeTruthy();
    const hijri = toHijri(eidFitrIsh!.date);
    expect(hijri.month).toBe(10);
    expect(hijri.day).toBe(1);
    expect(holidaysOn(eidFitrIsh!.date)).toContain("eidFitr");
  });
});
