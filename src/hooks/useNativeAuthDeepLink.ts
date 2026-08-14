import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { consumeNativeAuthUrl, isNativeApp } from "@/lib/native-auth";

/**
 * Listens for the com.muslimtermin.app://login-callback deep link in the native
 * shell and signs the user in inside the app. No-op on the web.
 */
export function useNativeAuthDeepLink(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const [{ App }, { Browser }] = await Promise.all([
        import("@capacitor/app"),
        import("@capacitor/browser"),
      ]);

      const handle = async (url: string) => {
        const result = await consumeNativeAuthUrl(url);
        if (!result) return;
        try {
          await Browser.close();
        } catch {
          /* browser may already be closed */
        }
        if (!result.ok) {
          toast.error("Sign-in failed. Please try again.");
          return;
        }
        void navigate({ to: result.next });
      };

      const listener = await App.addListener("appUrlOpen", (event) => {
        void handle(event.url);
      });
      const launch = await App.getLaunchUrl();
      if (launch?.url) void handle(launch.url);

      if (cancelled) void listener.remove();
      else cleanup = () => void listener.remove();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [navigate]);
}
