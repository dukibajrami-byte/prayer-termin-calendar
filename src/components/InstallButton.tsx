import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallButton() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    setIsIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || (!deferred && !isIos)) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        if (deferred) {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          if (choice.outcome === "accepted") setInstalled(true);
          setDeferred(null);
        } else {
          toast(t("pwa.install"), { description: t("pwa.iosHint") });
        }
      }}
    >
      <Download className="mr-1 h-4 w-4" /> {t("pwa.install")}
    </Button>
  );
}