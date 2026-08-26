import { afterEach, describe, expect, it } from "vitest";
import { PRAYER_ABBR, type PrayerName } from "@/lib/prayer";
import { fmt, setDateLocale } from "@/lib/dates";

const LTR = ["de", "en", "bn", "fr", "tr"];
const RTL = ["ar", "ur", "fa"];

/** Label as rendered in the narrow week bands: "<ABBR> <HH:mm>". */
function band(name: PrayerName, date: Date) {
  return `${PRAYER_ABBR[name]} ${fmt(date, "HH:mm")}`;
}

afterEach(() => setDateLocale("en"));

describe("prayer band abbreviations", () => {
  it("uses language-neutral latin letters", () => {
    expect(PRAYER_ABBR).toEqual({ fajr: "F", dhuhr: "D", asr: "A", maghrib: "M", isha: "I" });
  });

  it("never changes with the active language", () => {
    const snapshot = JSON.stringify(PRAYER_ABBR);
    for (const lang of [...LTR, ...RTL, "sq", "id", "ms", "ru", "es", "nl", "bs"]) {
      setDateLocale(lang);
      expect(JSON.stringify(PRAYER_ABBR)).toBe(snapshot);
    }
  });

  const cases: Array<[PrayerName, Date, string]> = [
    ["fajr", new Date(2026, 7, 17, 4, 17), "F 04:17"],
    ["asr", new Date(2026, 7, 17, 18, 25), "A 18:25"],
    ["maghrib", new Date(2026, 7, 17, 20, 37), "M 20:37"],
    ["isha", new Date(2026, 7, 17, 22, 39), "I 22:39"],
    ["dhuhr", new Date(2026, 7, 17, 13, 30), "D 13:30"],
  ];

  for (const lang of [...LTR, ...RTL]) {
    it(`renders stable band labels in ${lang}`, () => {
      setDateLocale(lang);
      for (const [name, date, expected] of cases) {
        const label = band(name, date);
        expect(label).toBe(expected);
        // digits must not be reordered or localized
        expect(/^[FDAMI] \d{2}:\d{2}$/.test(label)).toBe(true);
      }
    });
  }
});
