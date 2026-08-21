import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LANGS, dirFor, useI18n, type Lang } from "@/lib/i18n";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LanguageDialog({ open, onOpenChange }: Props) {
  const { t, lang, setLang } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("lang.select")}</DialogTitle>
          <DialogDescription className="sr-only">{t("lang.label")}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1" role="listbox" aria-label={t("lang.select")}>
          {(Object.keys(LANGS) as Lang[]).map((code) => {
            const active = code === lang;
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  dir={dirFor(code)}
                  onClick={() => {
                    setLang(code);
                    onOpenChange(false);
                  }}
                  className={
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-start text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                    (active
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border hover:bg-secondary")
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {active ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    ) : (
                      <span className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{LANGS[code]}</span>
                  </span>
                  <span className="shrink-0 text-xs uppercase text-muted-foreground">{code}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
