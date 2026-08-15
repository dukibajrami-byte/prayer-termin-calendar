import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearPendingNativeHandoff,
  getPendingNativeHandoff,
  handoffSessionToNativeApp,
  isNativeApp,
} from "@/lib/native-auth";

/**
 * Runs in the *system browser* tab that the native app opened for Google login.
 * As soon as a Supabase session exists we hand it back to the Android/iOS app
 * through the deep link, no matter which page the OAuth redirect landed on.
 * No-op on normal web sessions and inside the native shell itself.
 */
export function useNativeOAuthHandoff(): string | null {
  const [returnUrl, setReturnUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || isNativeApp()) return;
    if (!getPendingNativeHandoff()) return;

    let done = false;
    const tryHandoff = (session: Parameters<typeof handoffSessionToNativeApp>[0] | null) => {
      if (done || !session) return;
      const next = getPendingNativeHandoff();
      if (!next) return;
      done = true;
      clearPendingNativeHandoff();
      setReturnUrl(handoffSessionToNativeApp(session, next));
    };

    void supabase.auth.getSession().then(({ data }) => tryHandoff(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      tryHandoff(session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  return returnUrl;
}
