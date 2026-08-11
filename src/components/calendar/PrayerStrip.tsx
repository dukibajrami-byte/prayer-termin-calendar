import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/dates";
import { useI18n } from "@/lib/i18n";
import type { PrayerSlot } from "@/lib/prayer";

interface Props {
  slots: PrayerSlot[];
  next: PrayerSlot | null;
  locationName: string;
  countdown: string;
}

export function PrayerStrip({ slots, next, locationName, countdown }: Props) {
  const { t } = useI18n();
  return (
    <section className="hero-gradient rounded-2xl p-5 text-primary-foreground shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1 text-xs opacity-80">
            <MapPin className="h-3.5 w-3.5" /> {locationName}
          </p>
          <h2 className="font-display text-2xl font-semibold">
            {next
              ? t("prayer.at", { name: t(`prayer.${next.name}`), time: fmt(next.start, "HH:mm") })
              : t("prayer.times")}
          </h2>
        </div>
        {next && (
          <p className="text-sm opacity-90">
            {t("prayer.in")} <span className="font-semibold">{countdown}</span>
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {slots.map((p) => (
          <div
            key={p.name}
            className={cn(
              "rounded-xl px-2 py-2 text-center",
              next?.name === p.name ? "bg-primary-foreground/20" : "bg-primary-foreground/8",
            )}
          >
            <div className="text-[11px] uppercase tracking-wide opacity-80">{t(`prayer.${p.name}`)}</div>
            <div className="font-display text-base font-semibold">{fmt(p.start, "HH:mm")}</div>
          </div>
        ))}
      </div>
    </section>
  );
}