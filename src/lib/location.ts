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
  // Legacy default carried a German country name; keep the proper noun only.
  if (name === "Berlin, Deutschland") return "Berlin";
  return name;
}

/**
 * Reverse-Geocoding: liefert möglichst den Stadtteil (locality) plus Stadt.
 * Nutzt die freie BigDataCloud-API (kein API-Key nötig).
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  lang = "en",
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${lang}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      locality?: string;
      city?: string;
      localityInfo?: { administrative?: { name?: string; adminLevel?: number }[] };
      countryName?: string;
    };
    const admin = data.localityInfo?.administrative ?? [];
    const district = admin
      .filter((a) => (a.adminLevel ?? 0) >= 9 && a.name)
      .sort((a, b) => (b.adminLevel ?? 0) - (a.adminLevel ?? 0))[0]?.name;
    const parts = [district || data.locality, data.city].filter(
      (p, i, arr): p is string => Boolean(p) && arr.indexOf(p) === i,
    );
    return parts.length ? parts.join(", ") : null;
  } catch {
    return null;
  }
}
