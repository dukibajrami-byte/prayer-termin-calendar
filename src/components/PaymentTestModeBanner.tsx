import { useI18n } from "@/lib/i18n";

const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'];

export function PaymentTestModeBanner() {
  const { t } = useI18n();

  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm text-destructive">
        {t("banner.prodMissing")}
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-warning/40 bg-warning/10 px-4 py-2 text-center text-sm text-warning-foreground">
        {t("banner.testMode")}{" "}
        <a
          href="https://docs.lovable.dev/features/payments#test-and-live-environments"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline"
        >
          {t("banner.more")}
        </a>
      </div>
    );
  }
  return null;
}
