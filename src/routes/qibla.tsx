import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Compass, Crown, LocateFixed } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useSubscription } from "@/hooks/useSubscription";
import { useLocalState, DEFAULT_SETTINGS, type Settings } from "@/lib/store";
import { resolveLocationName } from "@/lib/location";
import { compassPoint, distanceToKaaba, qiblaBearing } from "@/lib/qibla";

export const Route = createFileRoute("/qibla")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Qibla-Richtung – Muslim Appointment Calendar" },
      {
        name: "description",
        content:
          "Qibla-Kompass: Richtung nach Mekka auf Basis deines Standorts, inklusive Peilung ab Norden und Entfernung zur Kaaba.",
      },
      { property: "og:title", content: "Qibla-Richtung – Muslim Appointment Calendar" },
      {
        property: "og:description",
        content: "Gebetsrichtung nach Mekka mit Kompass und Peilung ab Norden.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QiblaPage,
});

type OrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function QiblaPage() {
  const { t } = useI18n();
  const { isPremium, loading } = useSubscription();
  const [settings] = useLocalState<Settings>("mtk.settings", DEFAULT_SETTINGS);
  const [heading, setHeading] = useState<number | null>(null);
  const [compassOn, setCompassOn] = useState(false);
  const [supported, setSupported] = useState(true);

  const bearing = qiblaBearing(settings.latitude, settings.longitude);
  const distance = distanceToKaaba(settings.latitude, settings.longitude);

  useEffect(() => {
    if (typeof window !== "undefined" && !("DeviceOrientationEvent" in window)) {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!compassOn) return;
    const handler = (e: DeviceOrientationEvent) => {
      const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof webkit === "number") setHeading(webkit);
      else if (typeof e.alpha === "number") setHeading(360 - e.alpha);
    };
    window.addEventListener("deviceorientationabsolute", handler as EventListener);
    window.addEventListener("deviceorientation", handler as EventListener);
    return () => {
      window.removeEventListener("deviceorientationabsolute", handler as EventListener);
      window.removeEventListener("deviceorientation", handler as EventListener);
    };
  }, [compassOn]);

  const enableCompass = async () => {
    const ctor = window.DeviceOrientationEvent as OrientationEventCtor | undefined;
    if (ctor?.requestPermission) {
      try {
        const res = await ctor.requestPermission();
        if (res !== "granted") return setSupported(false);
      } catch {
        return setSupported(false);
      }
    }
    setCompassOn(true);
  };

  const rotation = heading === null ? bearing : bearing - heading;

  return (
    <main className="min-h-screen bg-background">
      <Toaster />
      <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
              <Compass className="h-6 w-6 text-primary" /> {t("qibla.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("qibla.subtitle")}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <CalendarDays className="mr-1 h-4 w-4" /> {t("qibla.back")}
            </Link>
          </Button>
        </header>

        {!loading && !isPremium ? (
          <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center">
            <p className="flex items-center justify-center gap-2 font-medium">
              <Crown className="h-4 w-4 text-primary" /> {t("qibla.locked")}
            </p>
            <Button asChild>
              <Link to="/premium">{t("premium.upgrade")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="relative mx-auto aspect-square w-full max-w-xs rounded-full border-2 border-border">
                {["N", "E", "S", "W"].map((p, i) => (
                  <span
                    key={p}
                    className="absolute left-1/2 top-1/2 text-xs font-medium text-muted-foreground"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${i * 90 + (heading === null ? 0 : -heading)}deg) translateY(-45%) `,
                    }}
                  >
                    {p}
                  </span>
                ))}
                <div
                  className="absolute inset-0 transition-transform duration-200"
                  style={{ transform: `rotate(${rotation}deg)` }}
                >
                  <div className="absolute left-1/2 top-[8%] h-[42%] w-1 -translate-x-1/2 rounded-full bg-primary" />
                  <div className="absolute left-1/2 top-[5%] h-3 w-3 -translate-x-1/2 rotate-45 rounded-sm bg-primary" />
                </div>
                <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground" />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">{t("qibla.bearing")}</p>
                  <p className="font-display text-xl">
                    {bearing.toFixed(1)}° {compassPoint(bearing)}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-xs text-muted-foreground">{t("qibla.distance")}</p>
                  <p className="font-display text-xl">{distance.toLocaleString()} km</p>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                <LocateFixed className="h-3.5 w-3.5" />
                {resolveLocationName(
                  settings.locationName,
                  t,
                  settings.latitude,
                  settings.longitude,
                )}
              </p>
            </div>

            {!compassOn && supported && (
              <Button className="w-full" onClick={enableCompass}>
                <Compass className="mr-1 h-4 w-4" /> {t("qibla.enableCompass")}
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {supported ? t("qibla.compassHint") : t("qibla.noCompass")}
            </p>
            {compassOn && (
              <p className="text-center text-xs text-muted-foreground">{t("qibla.calibrate")}</p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
