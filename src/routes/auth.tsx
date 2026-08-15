import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import {
  isNativeApp,
  getPendingNativeHandoff,
  markNativeHandoffPending,
  startNativeSignIn,
} from "@/lib/native-auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { next?: string | undefined; native?: boolean | undefined } => ({
    next:
      typeof search["next"] === "string" && search["next"].startsWith("/")
        ? (search["next"] as string)
        : undefined,
    native: search["native"] === "1" || search["native"] === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Anmelden – Muslimtermin" },
      {
        name: "description",
        content:
          "Melde dich an, um Premium-Funktionen wie unbegrenzte Erinnerungen und alle Berechnungsmethoden für Gebetszeiten zu nutzen.",
      },
      { property: "og:title", content: "Anmelden – Muslimtermin" },
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
  const [nativeDebugMsg, setNativeDebugMsg] = useState<string | null>(null);
  const target = next ?? "/premium";
  // `native=1` is only present on the first hop; after the Google round trip we
  // rely on the persisted flag so we never fall through to the web flow.
  const nativeFlow = Boolean(native) || getPendingNativeHandoff() !== null;

  useEffect(() => {
    if (native) markNativeHandoffPending(target);
  }, [native, target]);

  useEffect(() => {
    if (loading) return;
    // Opened from the native app in the system browser: the global
    // useNativeOAuthHandoff() hook owns the deep-link handoff, so we only
    // avoid navigating away here.
    if (nativeFlow) {
      if (session) {
        // eslint-disable-next-line no-console
        console.log("[native-oauth-debug] Valid Supabase session exists before handoff");
        setNativeDebugMsg("Native session ready");
      } else {
        // eslint-disable-next-line no-console
        console.log("[native-oauth-debug] No Supabase session available for native handoff");
        setNativeDebugMsg("Native session missing");
      }
      return;
    }
    if (!user) return;
    void navigate({ to: target });
  }, [loading, user, session, nativeFlow, navigate, target]);

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
    const nativeParam = nativeFlow ? "&native=1" : "";
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth?next=${encodeURIComponent(target)}${nativeParam}`,
    });
    if (result.error) {
      toast.error(String(result.error));
      return;
    }
    if (result.redirected) return;
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