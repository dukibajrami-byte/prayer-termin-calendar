import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Client-side access gate: requires an authenticated user with premium access
 * (active/trialing subscription or a premium_grant). Redirects to /auth when
 * signed out and to /premium when signed in without premium access.
 */
export function AccessGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isPremium, loading: subLoading } = useSubscription();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const ready = !authLoading && !subLoading;
  const allowed = Boolean(user) && isPremium;

  const redirected = useRef(false);

  useEffect(() => {
    if (!ready || allowed || redirected.current) return;
    redirected.current = true;
    if (!user) {
      void navigate({ to: "/auth", search: { next: pathname }, replace: true });
      return;
    }
    void navigate({ to: "/premium", replace: true });
  }, [ready, allowed, user, navigate, pathname]);

  if (!ready || !allowed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return <>{children}</>;
}
