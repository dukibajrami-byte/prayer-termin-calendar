import { LocateFixed } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { METHODS, type MethodKey, type MadhabKey } from "@/lib/prayer";
import type { Settings } from "@/lib/store";
import { LANGS, useI18n, type Lang } from "@/lib/i18n";

const TIMEZONES = [
  "Europe/Berlin",
  "Europe/London",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Jakarta",
  "America/New_York",
  "America/Los_Angeles",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onLocate: () => void;
  locating: boolean;
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  onLocate,
  locating,
}: Props) {
  const { t, lang, setLang } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("settings.title")}</DialogTitle>
          <DialogDescription>
            {t("settings.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("lang.label")}</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANGS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("field.method")}</Label>
            <Select
              value={settings.method}
              onValueChange={(v) => onChange({ method: v as MethodKey })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHODS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("field.madhab")}</Label>
              <Select
                value={settings.madhab}
                onValueChange={(v) => onChange({ madhab: v as MadhabKey })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shafi">{t("madhab.shafi")}</SelectItem>
                  <SelectItem value="hanafi">{t("madhab.hanafi")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dur">{t("field.duration")}</Label>
              <Input
                id="dur"
                type="number"
                min={5}
                max={90}
                value={settings.durationMinutes}
                onChange={(e) => onChange({ durationMinutes: Number(e.target.value) || 25 })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("loc.auto")}</Label>
                <p className="text-xs text-muted-foreground">{t("loc.autoHint")}</p>
              </div>
              <Switch
                checked={settings.autoLocation}
                onCheckedChange={(v) => onChange({ autoLocation: v })}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lat">{t("field.lat")}</Label>
                <Input
                  id="lat"
                  type="number"
                  step="0.0001"
                  value={settings.latitude}
                  onChange={(e) => onChange({ latitude: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lon">{t("field.lon")}</Label>
                <Input
                  id="lon"
                  type="number"
                  step="0.0001"
                  value={settings.longitude}
                  onChange={(e) => onChange({ longitude: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="locname">{t("field.locName")}</Label>
              <Input
                id="locname"
                value={settings.locationName}
                onChange={(e) => onChange({ locationName: e.target.value })}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={onLocate}
              disabled={locating}
            >
              <LocateFixed className="mr-1 h-4 w-4" />
              {locating ? t("loc.detecting") : t("loc.detect")}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("field.timezone")}</Label>
              <Select value={settings.timeZone} onValueChange={(v) => onChange({ timeZone: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("field.prayerReminder")}</Label>
              <Select
                value={String(settings.prayerReminderMinutes)}
                onValueChange={(v) => onChange({ prayerReminderMinutes: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[-1, 5, 10, 15, 30].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m < 0 ? t("reminder.none") : t("reminder.before", { m })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}