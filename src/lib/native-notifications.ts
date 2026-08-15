import { Capacitor } from "@capacitor/core";
import type { PermissionState } from "@capacitor/core";

export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform();
}

export interface NotificationPermissionResult {
  granted: boolean;
  display?: PermissionState;
}

/**
 * Checks (and requests if necessary) local notification permission on a
 * Capacitor native build. On web/PWA this returns { granted: false } so the
 * caller can fall back to the standard browser Notification API.
 */
export async function ensureNativeNotificationPermission(): Promise<NotificationPermissionResult> {
  if (!isNativePlatform()) {
    return { granted: false };
  }

  const { LocalNotifications } = await import("@capacitor/local-notifications");
  let { display } = await LocalNotifications.checkPermissions();

  if (display === "prompt" || display === "denied") {
    const result = await LocalNotifications.requestPermissions();
    display = result.display;
  }

  return { granted: display === "granted", display };
}
