import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { createPortalSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { PRICE_MONTHLY, PRICE_YEARLY } from "@/lib/premium";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/premium")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { manage?: boolean | undefined } => ({
    manage: search["manage"] === "1" || search["manage"] === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Premium – Muslim Appointment Calendar" },
      {
        name: "description",
        content:
          "Premium für den muslimischen Terminkalender: unbegrenzte Erinnerungen und alle Berechnungsmethoden für Gebetszeiten – monatlich oder jährlich.",
      },
      { property: "og:title", content: "Muslim Appointment Calendar Premium" },
      {
        property: "og:description",
        content: "Unbegrenzte Erinnerungen und alle Berechnungsmethoden freischalten.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { manage: manageMode } = Route.useSearch();
  const { user, loading: authLoading, signOut } = useAuth();
  const { isPremium, subscription, hasGrant, hasActiveSubscription, loading } = useSubscription();
  const [checkoutPrice, setCheckoutPrice] = useState<string | null>(null);

  // Users who already have premium access must not be asked to pay again.
  useEffect(() => {
    if (authLoading || loading) return;
    if (user && isPremium && !manageMode) void navigate({ to: "/", replace: true });
  }, [authLoading, loading, user, isPremium, manageMode, navigate]);

  const start = (priceId: string) => {
    if (!user) {
      void navigate({ to: "/auth", search: { next: "/premium" } });
      return;
    }
    setCheckoutPrice(priceId);
  };

  const manage = async () => {
    const result = await createPortalSession({
      data: { returnUrl: window.location.href, environment: getStripeEnvironment() },
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    window.location.href = result.url;
  };

  const signOutNow = async () => {
    await signOut();
    void navigate({ to: "/" });
  };

  const features = [
    t("premium.f1"),
    t("premium.f2"),
    t("premium.f6"),
    t("premium.f7"),
    t("premium.f4"),
    t("premium.f5"),
    t("premium.f3"),
  ];

  return (
    <main className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <Toaster />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-3xl font-semibold">{t("premium.title")}</h1>
          <p className="text-muted-foreground">{t("premium.subtitle")}</p>
        </div>

        <ul className="mx-auto max-w-md space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 text-primary" />
              {f}
            </li>
          ))}
        </ul>

        {!authLoading && !loading && isPremium ? (
          <div className="mx-auto max-w-md space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-5 text-center">
            <p className="flex items-center justify-center gap-2 font-medium">
              <Crown className="h-4 w-4 text-primary" /> {t("premium.active")}
            </p>
            {hasGrant && (
              <p className="text-sm text-muted-foreground">{t("premium.granted")}</p>
            )}
            {subscription?.current_period_end && !hasGrant && (
              <p className="text-sm text-muted-foreground">
                {t(subscription.cancel_at_period_end ? "premium.endsOn" : "premium.renewsOn", {
                  date: new Date(subscription.current_period_end).toLocaleDateString(),
                })}
              </p>
            )}
            {hasActiveSubscription && !hasGrant && (
              <Button variant="outline" onClick={manage}>
                {t("premium.manage")}
              </Button>
            )}
            <div>
              <Button variant="ghost" size="sm" onClick={signOutNow}>
                {t("auth.signOut")}
              </Button>
            </div>
          </div>
        ) : checkoutPrice ? (
          <div className="space-y-3">
            <StripeEmbeddedCheckout
              priceId={checkoutPrice}
              returnUrl={`${window.location.origin}/premium`}
            />
            <Button variant="ghost" className="w-full" onClick={() => setCheckoutPrice(null)}>
              {t("premium.cancelCheckout")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <PlanCard
                name={t("premium.monthly")}
                price="1,00 €"
                per={t("premium.perMonth")}
                note={t("premium.trialMonthly")}
                onSelect={() => start(PRICE_MONTHLY)}
                cta={t("premium.choose")}
              />
              <PlanCard
                name={t("premium.yearly")}
                price="10,00 €"
                per={t("premium.perYear")}
                note={t("premium.trialYearly")}
                badge={t("premium.save")}
                onSelect={() => start(PRICE_YEARLY)}
                cta={t("premium.choose")}
                highlight
              />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {t("premium.cancelAnytime")}
            </p>
          </div>
        )}

        <div className="text-center">
          {user && !isPremium && (
            <div className="mb-2">
              <Button variant="ghost" size="sm" onClick={signOutNow}>
                {t("auth.signOut")}
              </Button>
            </div>
          )}
          <Link to="/" className="text-sm text-muted-foreground underline">
            {t("auth.backToCalendar")}
          </Link>
        </div>
      </div>
    </main>
  );
}

function PlanCard({
  name,
  price,
  per,
  badge,
  note,
  cta,
  onSelect,
  highlight,
}: {
  name: string;
  price: string;
  per: string;
  badge?: string;
  note?: string;
  cta: string;
  onSelect: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "space-y-3 rounded-2xl border p-5 " +
        (highlight ? "border-primary bg-primary/5" : "border-border bg-card")
      }
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{name}</h2>
        {badge && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
            {badge}
          </span>
        )}
      </div>
      <p className="font-display text-3xl">
        {price} <span className="text-sm text-muted-foreground">{per}</span>
      </p>
      {note && <p className="text-sm font-medium text-primary">{note}</p>}
      <Button className="w-full" onClick={onSelect}>
        {cta}
      </Button>
    </div>
  );
}