import type { MethodKey } from "@/lib/prayer";

/** Ohne Premium nutzbare Berechnungsmethoden */
export const FREE_METHODS: MethodKey[] = ["MuslimWorldLeague", "NorthAmerica"];

/** Maximale Anzahl aktiver Termin-Erinnerungen im Gratis-Tarif */
export const FREE_REMINDER_LIMIT = 3;

export const PRICE_MONTHLY = "premium_monthly";
export const PRICE_YEARLY = "premium_yearly";

export function isFreeMethod(method: MethodKey) {
  return FREE_METHODS.includes(method);
}

/** Premium-Feature: Cloud-Sync und geteilte Kalender für Familie/Moschee/Verein */
export const CLOUD_FEATURES_REQUIRE_PREMIUM = true;

/** Maximale Anzahl To-Do-Aufgaben im Gratis-Tarif */
export const FREE_TODO_LIMIT = 5;
