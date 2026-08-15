/** Shown in the system browser after native OAuth if Chrome blocks the auto-redirect. */
export function NativeReturnBanner({ url }: { url: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
      <span className="text-sm text-muted-foreground">Signed in successfully.</span>
      <a
        href={url}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Return to app
      </a>
    </div>
  );
}