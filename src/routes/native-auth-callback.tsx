import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { buildNativeCallbackUrl, clearPendingNativeHandoff } from "@/lib/native-auth";

export const Route = createFileRoute("/native-auth-callback")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { next: string } => ({
    next:
      typeof search["next"] === "string" && (search["next"] as string).startsWith("/")
        ? (search["next"] as string)
        : "/premium",
  }),
  head: () => ({
    meta: [
      { title: "Zurück zur App – Muslimtermin" },
      {
        name: "description",
        content: "Anmeldung abgeschlossen – zurück zur Muslimtermin App wechseln.",
      },
      { property: "og:title", content: "Zurück zur App – Muslimtermin" },
      {
        property: "og:description",
        content: "Die Anmeldung war erfolgreich. Kehre zur Muslimtermin App zurück.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NativeAuthCallbackPage,
});

function NativeAuthCallbackPage() {
  const { next } = Route.useSearch();
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"waiting" | "ready" | "missing">("waiting");

  useEffect(() => {
    let done = false;
    const handle = (session: Parameters<typeof buildNativeCallbackUrl>[0] | null) => {
      if (done || !session) return;
      done = true;
      const url = buildNativeCallbackUrl(session, next);
      // Make the manual fallback available before attempting the auto-launch.
      setReturnUrl(url);
      setStatus("ready");
      // This dedicated route identifies the native flow; the localStorage flag
      // is only cleaned up so the global handoff hook doesn't fire again.
      clearPendingNativeHandoff();
      window.setTimeout(() => {
        window.location.href = url;
      }, 100);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) handle(data.session);
      else setStatus((s) => (s === "ready" ? s : "missing"));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => handle(session));
    return () => sub.subscription.unsubscribe();
  }, [next]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="font-display text-xl font-semibold">
          {status === "ready" ? "Signed in successfully" : "Finishing sign-in…"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {status === "ready"
            ? "Tap the button below if the app does not open automatically."
            : status === "missing"
              ? "No session found yet. Please try signing in again."
              : "Waiting for your session…"}
        </p>
        {returnUrl && (
          <a
            href={returnUrl}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Return to app
          </a>
        )}
      </div>
    </main>
  );
}
