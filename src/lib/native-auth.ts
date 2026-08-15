// Native (Capacitor) OAuth helpers.
// Web behaviour is untouched: every helper here no-ops unless we run inside the
// native Android/iOS shell.

import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const NATIVE_APP_SCHEME = "com.muslimtermin.app";
export const NATIVE_AUTH_CALLBACK = `${NATIVE_APP_SCHEME}://login-callback`;
/** The published site the native shell wraps. */
export const WEB_ORIGIN = "https://muslim-calendar.com";

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Opens the sign-in page in the system browser (Google blocks OAuth inside
 * embedded webviews) and lets it hand the session back through the deep link.
 */
export async function startNativeSignIn(next: string): Promise<void> {
  const { Browser } = await import("@capacitor/browser");
  const url = `${WEB_ORIGIN}/auth?native=1&next=${encodeURIComponent(next)}`;
  await Browser.open({ url, presentationStyle: "popover" });
}

/** Called from the browser tab once a session exists: hands it to the app. */
export function handoffSessionToNativeApp(session: Session, next: string): void {
  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    next,
  });
  window.location.href = `${NATIVE_AUTH_CALLBACK}#${params.toString()}`;
}

export type NativeAuthResult = { ok: boolean; next: string };

/**
 * The native login intent has to survive the full Google OAuth round trip in
 * the system browser (the `native=1` query param is lost on the way back).
 * We therefore persist it in localStorage with a short TTL.
 */
const PENDING_KEY = "muslimtermin.native-oauth-pending";
const PENDING_TTL_MS = 15 * 60 * 1000;

export function markNativeHandoffPending(next: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify({ next, at: Date.now() }));
  } catch {
    /* storage unavailable */
  }
}

export function getPendingNativeHandoff(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { next?: string; at?: number };
    if (!parsed.at || Date.now() - parsed.at > PENDING_TTL_MS) {
      window.localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return typeof parsed.next === "string" && parsed.next.startsWith("/") ? parsed.next : "/";
  } catch {
    return null;
  }
}

export function clearPendingNativeHandoff(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Parses a deep link and, if it carries tokens, establishes the session. */
export async function consumeNativeAuthUrl(url: string): Promise<NativeAuthResult | null> {
  if (!url.startsWith(NATIVE_AUTH_CALLBACK)) return null;
  const fragment = url.split("#")[1] ?? url.split("?")[1] ?? "";
  const params = new URLSearchParams(fragment);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const next = params.get("next") ?? "/";
  if (!access_token || !refresh_token) return { ok: false, next };
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  return { ok: !error, next };
}
