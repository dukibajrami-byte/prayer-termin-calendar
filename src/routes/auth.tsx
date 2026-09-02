import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import {
  isNativeApp,
  getPendingNativeHandoff,
  markNativeHandoffPending,
  startNativeSignIn,
  WEB_ORIGIN,
} from "@/lib/native-auth";

const lovableAuth = createLovableAuth();

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { next?: string | undefined; native?: boolean | undefined } => ({
    next:
      typeof search["next"] === "string" && search["next"].startsWith("/")
        ? (search["next"] as string)
        : undefined,
    native:
      search["native"] === "1" || search["native"] === "true" || search["native"] === true
        ? true
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Anmelden – Muslim Appointment Calendar" },
      {
        name: "description",
        content:
          "Melde dich an, um Premium-Funktionen wie unbegrenzte Erinnerungen und alle Berechnungsmethoden für Gebetszeiten zu nutzen.",
      },
      { property: "og:title", content: "Anmelden – Muslim Appointment Calendar" },
      {
        property: "og:description",
        content: "Konto erstellen oder anmelden und Premium freischalten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { next, native } = Route.useSearch();
  const { user, session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
...
    if (nativeFlow) return;
    if (!user) return;
    // Wait until the subscription status is known so we never redirect to the
    // wrong destination.
    if (!next && subLoading) return;
    void navigate({ to: target });
  }, [loading, user, session, nativeFlow, navigate, target, next, subLoading]);

  const submit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}${target}` },
      });
      setBusy(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(t("auth.checkEmail"));
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void navigate({ to: target });
  };

  const google = async () => {
    if (isNativeApp()) {
      await startNativeSignIn(target);
      return;
    }
    if (nativeFlow) markNativeHandoffPending(target);
    // Native flow returns to a dedicated callback route that owns the deep-link
    // handoff; the web flow keeps returning to /auth as before.
    const redirectUri = nativeFlow
      ? `${WEB_ORIGIN}/native-auth-callback?next=${encodeURIComponent(target)}`
      : `${window.location.origin}/auth?next=${encodeURIComponent(target)}`;

    // cloud-auth-js generates a random `state` internally and does not expose
    // the final broker URL. This is the otherwise exact, token-free request URL.
    const oauthUrl = new URL("/~oauth/initiate", window.location.origin);
    oauthUrl.searchParams.set("provider", "google");
    oauthUrl.searchParams.set("redirect_uri", redirectUri);
    const beforeDebug: OAuthDebugState = {
      phase: "before",
      redirectUri,
      nativeFlow,
      windowHref: window.location.href,
      redirected: null,
      oauthUrl: oauthUrl.toString(),
    };
    setOauthDebug(beforeDebug);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    // eslint-disable-next-line no-console
    console.log("[oauth-debug:before]", beforeDebug);
    const result = await lovableAuth.signInWithOAuth("google", {
      redirect_uri: redirectUri,
    });

    const afterDebug: OAuthDebugState = {
      ...beforeDebug,
      phase: "after",
      windowHref: window.location.href,
      redirected: result.redirected === true,
    };
    setOauthDebug(afterDebug);
    // Deliberately log only redirect metadata, never the returned tokens.
    // eslint-disable-next-line no-console
    console.log("[oauth-debug:after]", afterDebug);
    if (result.error) {
      toast.error(String(result.error));
      return;
    }
    if (result.redirected) return;
    const { error: sessionError } = await supabase.auth.setSession(result.tokens);
    if (sessionError) {
      toast.error(sessionError.message);
      return;
    }
    if (!nativeFlow) void navigate({ to: target });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Toaster />
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-6">
        {nativeDebugMsg && (
          <div
            className={`rounded-lg px-3 py-2 text-center text-sm font-medium ${
              nativeDebugMsg === "Native session ready"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            }`}
          >
            {nativeDebugMsg}
          </div>
        )}
        {oauthDebug && (
          <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">
              OAuth debug ({oauthDebug.phase})
            </p>
            <p className="text-xs break-all font-mono text-foreground">
              redirect_uri: {oauthDebug.redirectUri}
            </p>
            <p className="text-xs break-all font-mono text-foreground">
              window.location.href: {oauthDebug.windowHref}
            </p>
            <p className="text-xs text-muted-foreground">
              nativeFlow: {String(oauthDebug.nativeFlow)}
            </p>
            <p className="text-xs text-muted-foreground">
              result.redirected: {oauthDebug.redirected === null ? "pending" : String(oauthDebug.redirected)}
            </p>
            {oauthDebug.oauthUrl && (
              <p className="text-xs break-all font-mono text-muted-foreground">
                OAuth URL (without internal state): {oauthDebug.oauthUrl}
              </p>
            )}
          </div>
        )}
        <div className="space-y-1">
          <h1 className="font-display text-xl font-semibold">
            {mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("auth.desc")}</p>
        </div>

        <Button variant="outline" className="w-full" onClick={google}>
          {t("auth.google")}
        </Button>

        <form className="space-y-3" onSubmit={submit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">{t("auth.password")}</Label>
            <Input
              id="pw"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
          </Button>
        </form>

        <button
          type="button"
          className="w-full text-sm text-muted-foreground underline"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? t("auth.toSignUp") : t("auth.toSignIn")}
        </button>

        <Link to="/" className="block text-center text-sm text-muted-foreground underline">
          {t("auth.backToCalendar")}
        </Link>
      </div>
    </main>
  );
}