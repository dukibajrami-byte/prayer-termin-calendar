import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativePlatform, ensureNativeNotificationPermission } from "@/lib/native-notifications";

/**
 * User-triggered notification permission request + honest note about the
 * limits of web notifications (browser must be running).
 */
export function NotificationSetup() {
  const native = typeof window !== "undefined" && isNativePlatform();
  const [permission, setPermission] = useState<string>("unknown");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (native) {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const perm = await LocalNotifications.checkPermissions();
        if (!cancelled) setPermission(perm.display);
      } else if (typeof Notification !== "undefined") {
        setPermission(Notification.permission);
      } else {
        setPermission("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [native]);

  const request = async () => {
    if (native) {
      const { granted } = await ensureNativeNotificationPermission();
      setPermission(granted ? "granted" : "denied");
      return;
    }
    if (typeof Notification !== "undefined") setPermission(await Notification.requestPermission());
  };

  if (permission === "granted" && native) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
      <p className="max-w-md">
        {native
          ? "Reminders are delivered by the system, also when the app is closed."
          : "In the browser, reminders can only appear while this app is open in a tab. For reminders when the app is closed, use the Android/iOS app."}
      </p>
      {permission !== "granted" && permission !== "unsupported" && (
        <Button size="sm" variant="secondary" onClick={() => void request()}>
          <Bell className="mr-1 h-4 w-4" /> Enable notifications
        </Button>
      )}
    </div>
  );
}