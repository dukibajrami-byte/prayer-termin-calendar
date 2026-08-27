import { DEFAULT_CALENDARS } from "./store";

/**
 * Cloud calendars are seeded from the local defaults, so their stored names
 * can be German ("Privat", "Moschee / Verein"). Map those known seed names
 * back to the default calendar ids so the UI can translate them.
 */
const SEED_NAME_TO_ID: Record<string, string> = {
  privat: "personal",
  personal: "personal",
  arbeit: "work",
  work: "work",
  familie: "family",
  family: "family",
  "moschee / verein": "mosque",
  "moschee/verein": "mosque",
  "mosque / community": "mosque",
  "mosque / club": "mosque",
  mosque: "mosque",
};

const DEFAULT_IDS = new Set(DEFAULT_CALENDARS.map((c) => c.id));

/** Localized display name for a calendar; user-created names stay untouched. */
export function calendarLabel(
  cal: { id: string; name: string },
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  if (DEFAULT_IDS.has(cal.id)) return t(`cal.${cal.id}`);
  const mapped = SEED_NAME_TO_ID[cal.name.trim().toLowerCase()];
  return mapped ? t(`cal.${mapped}`) : cal.name;
}
