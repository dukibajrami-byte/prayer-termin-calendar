import { useEffect, useRef, useState } from "react";
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
  requestPermission?: (absolute?: boolean) => Promise<"granted" | "denied">;
};

const norm360 = (a: number) => ((a % 360) + 360) % 360;
/** shortest signed difference from b to a, in (-180, 180] */
const shortestDiff = (a: number, b: number) => {
  let d = norm360(a - b);
  if (d > 180) d -= 360;
  return d;
};

function QiblaPage() {
  const { t } = useI18n();
  const { isPremium, loading } = useSubscription();
  const [settings] = useLocalState<Settings>("mtk.settings", DEFAULT_SETTINGS);
  const [rawHeading, setRawHeading] = useState<number | null>(null);
  const [smoothHeading, setSmoothHeading] = useState<number | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [compassOn, setCompassOn] = useState(false);
  const [supported, setSupported] = useState(true);
  const smoothRef = useRef<number | null>(null);
  const rotationRef = useRef<number>(0);

  const bearing = qiblaBearing(settings.latitude, settings.longitude);
  const distance = distanceToKaaba(settings.latitude, settings.longitude);
  const bearingRef = useRef(bearing);
  bearingRef.current = bearing;

  useEffect(() => {
    if (typeof window !== "undefined" && !("DeviceOrientationEvent" in window)) {
      setSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!compassOn) return;

    const apply = (h: number) => {
      const heading = norm360(h);
      setRawHeading(heading);
      // circular exponential smoothing
      const prev = smoothRef.current;
      const next = prev === null ? heading : norm360(prev + 0.15 * shortestDiff(heading, prev));
      smoothRef.current = next;
      setSmoothHeading(next);
      // continuous needle rotation (never takes the long way around)
      const target = bearingRef.current - next;
      const nextRot = rotationRef.current + shortestDiff(target, rotationRef.current);
      rotationRef.current = nextRot;
      setRotation(nextRot);
    };

    const handler = (e: DeviceOrientationEvent) => {
      const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof webkit === "number" && !Number.isNaN(webkit)) return apply(webkit);
      if (e.absolute === true && typeof e.alpha === "number") return apply(360 - e.alpha);
    };

    // Prefer absolute orientation; only fall back to `deviceorientation`
    // (which may still be absolute on iOS via webkitCompassHeading).
    const useAbsolute = "ondeviceorientationabsolute" in window;
    const eventName = useAbsolute ? "deviceorientationabsolute" : "deviceorientation";
    window.addEventListener(eventName, handler as EventListener);
    return () => window.removeEventListener(eventName, handler as EventListener);
  }, [compassOn]);

  const enableCompass = async () => {
    const ctor = window.DeviceOrientationEvent as OrientationEventCtor | undefined;
    if (ctor?.requestPermission) {
      try {
        const res = await ctor.requestPermission(true);
        if (res !== "granted") return setSupported(false);
      } catch {
        return setSupported(false);
      }
    }
    setCompassOn(true);
  };

  const heading = smoothHeading;
  const needleRotation = heading === null ? bearing : rotation;
  const aligned = heading !== null && Math.abs(shortestDiff(bearing, heading)) <= 5;

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
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div
                className={cn(
                  "relative mx-auto aspect-square w-full max-w-xs rounded-full p-[3px] transition-colors",
                  aligned ? "bg-primary/70" : "bg-border",
                )}
              >
                <div className="relative h-full w-full overflow-hidden rounded-full bg-gradient-to-b from-secondary to-card">
                  {/* rotating dial: ticks + cardinal points */}
                  <div
                    className="absolute inset-0"
                    style={{ transform: `rotate(${heading === null ? 0 : -heading}deg)` }}
                  >
                    {Array.from({ length: 72 }, (_, i) => {
                      const major = i % 6 === 0;
                      return (
                        <div
                          key={i}
                          className="absolute inset-0"
                          style={{ transform: `rotate(${i * 5}deg)` }}
                        >
                          <span
                            className={cn(
                              "absolute left-1/2 top-[3%] -translate-x-1/2 rounded-full",
                              major ? "bg-foreground/50" : "bg-foreground/15",
                            )}
                            style={{ width: major ? 2 : 1, height: major ? "7%" : "4%" }}
                          />
                        </div>
                      );
                    })}
                    {["N", "E", "S", "W"].map((p, i) => (
                      <span
                        key={p}
                        className={cn(
                          "absolute left-1/2 top-1/2 text-sm font-semibold",
                          i === 0 ? "text-primary" : "text-muted-foreground",
                        )}
                        style={{
                          transform: `translate(-50%, -50%) rotate(${i * 90}deg) translateY(-38%) rotate(${-i * 90}deg)`,
                        }}
                      >
                        {p}
                      </span>
                    ))}
                  </div>

                  {/* qibla needle */}
                  <div className="absolute inset-0" style={{ transform: `rotate(${needleRotation}deg)` }}>
                    <div
                      className={cn(
                        "absolute left-1/2 top-[16%] h-[34%] w-[3px] -translate-x-1/2 rounded-full",
                        aligned ? "bg-primary" : "bg-primary/70",
                      )}
                    />
                    <div
                      className={cn(
                        "absolute left-1/2 top-[7%] grid h-7 w-7 -translate-x-1/2 place-items-center rounded-md text-[13px]",
                        aligned ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary",
                      )}
                    >
                      🕋
                    </div>
                    <div className="absolute bottom-[20%] left-1/2 h-[24%] w-[2px] -translate-x-1/2 rounded-full bg-muted-foreground/30" />
                  </div>

                  <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground" />

                  {/* fixed top marker */}
                  <div className="absolute left-1/2 top-0 h-3 w-[2px] -translate-x-1/2 rounded-b-full bg-accent" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl border border-border/60 bg-secondary/70 p-3">
                  <p className="text-xs text-muted-foreground">{t("qibla.bearing")}</p>
                  <p className="font-display text-xl">
                    {bearing.toFixed(1)}° {compassPoint(bearing)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-secondary/70 p-3">
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
