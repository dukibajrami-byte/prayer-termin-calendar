import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTodos } from "@/hooks/useTodos";
import { isNativePlatform, ensureNativeNotificationPermission } from "@/lib/native-notifications";

/** Temporary diagnostics panel (visible for signed-in users only). */
export function TodoDebugPanel() {
  const { todos, userId, realtimeStatus, cloudCount, source } = useTodos();
  const native = typeof window !== "undefined" && isNativePlatform();
  const [permission, setPermission] = useState<string>("unknown");
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (native) {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        const perm = await LocalNotifications.checkPermissions();
        const list = await LocalNotifications.getPending();
        if (cancelled) return;
        setPermission(perm.display);
        setPending(list.notifications.length);
      } else if (typeof Notification !== "undefined") {
        setPermission(Notification.permission);
      } else {
        setPermission("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [native, todos]);

  if (!userId) return null;

  const requestPermission = async () => {
    if (native) {
      const { granted } = await ensureNativeNotificationPermission();
      setPermission(granted ? "granted" : "denied");
      return;
    }
    if (typeof Notification !== "undefined") {
      setPermission(await Notification.requestPermission());
    }
  };

  return (
    <section className="space-y-1 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Debug</p>
      <p>user id: {userId}</p>
      <p>source: {source}</p>
      <p>todos from cloud: {cloudCount} (rendered: {todos.length})</p>
      <p>realtime: {realtimeStatus}</p>
      <p>platform: {native ? "native" : "web"}</p>
      <p>notification permission: {permission}</p>
      <p>pending native notifications: {pending ?? (native ? "…" : "n/a")}</p>
      {permission !== "granted" && (
        <Button size="sm" variant="secondary" className="mt-1" onClick={() => void requestPermission()}>
          Enable notifications
        </Button>
      )}
    </section>
  );
}