export const KAABA = { latitude: 21.4224779, longitude: 39.6234307 };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Großkreis-Peilung (0-360°, von Nord im Uhrzeigersinn) zur Kaaba */
export function qiblaBearing(latitude: number, longitude: number) {
  const dLon = rad(KAABA.longitude - longitude);
  const lat1 = rad(latitude);
  const lat2 = rad(KAABA.latitude);
  const y = Math.sin(dLon);
  const x = Math.cos(lat1) * Math.tan(lat2) - Math.sin(lat1) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Entfernung zur Kaaba in km */
export function distanceToKaaba(latitude: number, longitude: number) {
  const R = 6371;
  const dLat = rad(KAABA.latitude - latitude);
  const dLon = rad(KAABA.longitude - longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latitude)) * Math.cos(rad(KAABA.latitude)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function compassPoint(bearing: number) {
  return COMPASS_POINTS[Math.round(bearing / 45) % 8]!;
}
