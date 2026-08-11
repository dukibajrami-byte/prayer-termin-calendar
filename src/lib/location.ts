import type { Translate } from "./i18n";

export const AUTO_LOCATION = "@auto";

export function resolveLocationName(
  name: string,
  t: Translate,
  latitude: number,
  longitude: number,
) {
  if (name === AUTO_LOCATION) {
    return `${t("loc.current")} (${latitude.toFixed(2)}, ${longitude.toFixed(2)})`;
  }
  return name;
}
