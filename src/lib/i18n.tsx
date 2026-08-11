import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setDateLocale } from "./dates";

export const LANGS = {
  de: "Deutsch",
  en: "English",
  ar: "العربية",
  sq: "Shqip",
} as const;

export type Lang = keyof typeof LANGS;

type Dict = Record<string, string>;

const de: Dict = {
  "app.title": "Muslimischer Terminkalender",
  "app.subtitle": "Termine planen – im Einklang mit den Gebetszeiten.",
  "nav.settings": "Einstellungen",
  "nav.newEvent": "Termin",
  "nav.prev": "Zurück",
  "nav.next": "Weiter",
  "nav.today": "Heute",
  "view.day": "Tag",
  "view.week": "Woche",
  "view.month": "Monat",
  "legend.prayer": "Gebetszeit",
  "legend.conflict": "Kollision mit Gebet",
  "lang.label": "Sprache",
  "prayer.times": "Gebetszeiten",
  "prayer.at": "{name} um {time}",
  "prayer.in": "in",
  "time.hours": "Std.",
  "time.minutes": "Min.",
  "month.more": "+{n} weitere",
  "grid.createAria": "Termin am {date} um {hour}:00 anlegen",
  "cal.personal": "Privat",
  "cal.work": "Arbeit",
  "cal.family": "Familie",
  "cal.mosque": "Moschee / Verein",
  "event.title": "Termin",
  "event.desc": "Plane deinen Termin rund um die Gebetszeiten.",
  "event.untitled": "Neuer Termin",
  "field.title": "Titel",
  "field.titlePlaceholder": "z. B. Teammeeting",
  "field.start": "Beginn",
  "field.end": "Ende",
  "field.calendar": "Kalender",
  "field.reminder": "Erinnerung",
  "field.notes": "Notiz",
  "reminder.none": "Keine",
  "reminder.before": "{m} Min. vorher",
  "conflict.title": "Überschneidung mit Gebetszeit",
  "conflict.shift": "Termin nach dem Gebet legen",
  "action.delete": "Löschen",
  "action.save": "Speichern",
  "settings.title": "Einstellungen",
  "settings.desc": "Standort, Berechnungsmethode und Erinnerungen anpassen.",
  "field.method": "Berechnungsmethode",
  "field.madhab": "Asr-Berechnung (Madhab)",
  "madhab.shafi": "Shafi'i / Maliki / Hanbali",
  "madhab.hanafi": "Hanafi",
  "field.duration": "Gebetsdauer (Min.)",
  "loc.auto": "Standort automatisch erkennen",
  "loc.autoHint": "Nutzt die Standortfreigabe des Browsers.",
  "field.lat": "Breitengrad",
  "field.lon": "Längengrad",
  "field.locName": "Ortsname",
  "loc.detect": "Standort jetzt ermitteln",
  "loc.detecting": "Suche Standort…",
  "field.timezone": "Zeitzone",
  "field.prayerReminder": "Gebetserinnerung",
  "toast.geoUnsupported": "Standortermittlung wird nicht unterstützt.",
  "toast.located": "Gebetszeiten für deinen Standort aktualisiert.",
  "toast.geoFailed": "Standort nicht verfügbar – bitte manuell eintragen.",
  "loc.current": "Aktueller Standort",
  "notif.event": "Termin: {title}",
  "notif.eventBody": "Beginnt um {time} Uhr.",
  "notif.prayerSoon": "{label} bald",
  "notif.prayerBody": "Gebetsbeginn um {time} Uhr.",
};

const en: Dict = {
  "app.title": "Muslim Calendar & Planner",
  "app.subtitle": "Plan your schedule in harmony with prayer times.",
  "nav.settings": "Settings",
  "nav.newEvent": "Event",
  "nav.prev": "Previous",
  "nav.next": "Next",
  "nav.today": "Today",
  "view.day": "Day",
  "view.week": "Week",
  "view.month": "Month",
  "legend.prayer": "Prayer time",
  "legend.conflict": "Conflict with prayer",
  "lang.label": "Language",
  "prayer.times": "Prayer times",
  "prayer.at": "{name} at {time}",
  "prayer.in": "in",
  "time.hours": "h",
  "time.minutes": "min",
  "month.more": "+{n} more",
  "grid.createAria": "Create event on {date} at {hour}:00",
  "cal.personal": "Personal",
  "cal.work": "Work",
  "cal.family": "Family",
  "cal.mosque": "Mosque / Community",
  "event.title": "Event",
  "event.desc": "Plan your event around the prayer times.",
  "event.untitled": "New event",
  "field.title": "Title",
  "field.titlePlaceholder": "e.g. Team meeting",
  "field.start": "Start",
  "field.end": "End",
  "field.calendar": "Calendar",
  "field.reminder": "Reminder",
  "field.notes": "Notes",
  "reminder.none": "None",
  "reminder.before": "{m} min before",
  "conflict.title": "Overlaps with prayer time",
  "conflict.shift": "Move event after the prayer",
  "action.delete": "Delete",
  "action.save": "Save",
  "settings.title": "Settings",
  "settings.desc": "Adjust location, calculation method and reminders.",
  "field.method": "Calculation method",
  "field.madhab": "Asr calculation (madhab)",
  "madhab.shafi": "Shafi'i / Maliki / Hanbali",
  "madhab.hanafi": "Hanafi",
  "field.duration": "Prayer duration (min)",
  "loc.auto": "Detect location automatically",
  "loc.autoHint": "Uses your browser's location permission.",
  "field.lat": "Latitude",
  "field.lon": "Longitude",
  "field.locName": "Location name",
  "loc.detect": "Detect location now",
  "loc.detecting": "Detecting location…",
  "field.timezone": "Time zone",
  "field.prayerReminder": "Prayer reminder",
  "toast.geoUnsupported": "Location detection is not supported.",
  "toast.located": "Prayer times updated for your location.",
  "toast.geoFailed": "Location unavailable – please enter it manually.",
  "loc.current": "Current location",
  "notif.event": "Event: {title}",
  "notif.eventBody": "Starts at {time}.",
  "notif.prayerSoon": "{label} soon",
  "notif.prayerBody": "Prayer begins at {time}.",
};

const ar: Dict = {
  "app.title": "تقويم ومنظّم مواعيد المسلم",
  "app.subtitle": "خطّط مواعيدك بما ينسجم مع أوقات الصلاة.",
  "nav.settings": "الإعدادات",
  "nav.newEvent": "موعد",
  "nav.prev": "السابق",
  "nav.next": "التالي",
  "nav.today": "اليوم",
  "view.day": "يوم",
  "view.week": "أسبوع",
  "view.month": "شهر",
  "legend.prayer": "وقت الصلاة",
  "legend.conflict": "تعارض مع الصلاة",
  "lang.label": "اللغة",
  "prayer.times": "أوقات الصلاة",
  "prayer.at": "{name} في {time}",
  "prayer.in": "خلال",
  "time.hours": "س",
  "time.minutes": "د",
  "month.more": "+{n} أخرى",
  "grid.createAria": "إنشاء موعد في {date} الساعة {hour}:00",
  "cal.personal": "شخصي",
  "cal.work": "العمل",
  "cal.family": "العائلة",
  "cal.mosque": "المسجد / الجمعية",
  "event.title": "موعد",
  "event.desc": "خطّط موعدك حول أوقات الصلاة.",
  "event.untitled": "موعد جديد",
  "field.title": "العنوان",
  "field.titlePlaceholder": "مثال: اجتماع الفريق",
  "field.start": "البداية",
  "field.end": "النهاية",
  "field.calendar": "التقويم",
  "field.reminder": "تذكير",
  "field.notes": "ملاحظات",
  "reminder.none": "بدون",
  "reminder.before": "قبل {m} دقيقة",
  "conflict.title": "تعارض مع وقت الصلاة",
  "conflict.shift": "نقل الموعد بعد الصلاة",
  "action.delete": "حذف",
  "action.save": "حفظ",
  "settings.title": "الإعدادات",
  "settings.desc": "اضبط الموقع وطريقة الحساب والتذكيرات.",
  "field.method": "طريقة الحساب",
  "field.madhab": "حساب العصر (المذهب)",
  "madhab.shafi": "الشافعي / المالكي / الحنبلي",
  "madhab.hanafi": "الحنفي",
  "field.duration": "مدة الصلاة (دقيقة)",
  "loc.auto": "تحديد الموقع تلقائياً",
  "loc.autoHint": "يستخدم إذن الموقع في المتصفح.",
  "field.lat": "خط العرض",
  "field.lon": "خط الطول",
  "field.locName": "اسم المكان",
  "loc.detect": "تحديد الموقع الآن",
  "loc.detecting": "جارٍ تحديد الموقع…",
  "field.timezone": "المنطقة الزمنية",
  "field.prayerReminder": "تذكير الصلاة",
  "toast.geoUnsupported": "تحديد الموقع غير مدعوم.",
  "toast.located": "تم تحديث أوقات الصلاة حسب موقعك.",
  "toast.geoFailed": "الموقع غير متاح – الرجاء إدخاله يدوياً.",
  "loc.current": "الموقع الحالي",
  "notif.event": "موعد: {title}",
  "notif.eventBody": "يبدأ الساعة {time}.",
  "notif.prayerSoon": "{label} قريباً",
  "notif.prayerBody": "تبدأ الصلاة الساعة {time}.",
};

const sq: Dict = {
  "app.title": "Kalendari mysliman i takimeve",
  "app.subtitle": "Planifiko takimet në harmoni me kohët e namazit.",
  "nav.settings": "Cilësimet",
  "nav.newEvent": "Takim",
  "nav.prev": "Mbrapa",
  "nav.next": "Përpara",
  "nav.today": "Sot",
  "view.day": "Ditë",
  "view.week": "Javë",
  "view.month": "Muaj",
  "legend.prayer": "Koha e namazit",
  "legend.conflict": "Përplasje me namazin",
  "lang.label": "Gjuha",
  "prayer.times": "Kohët e namazit",
  "prayer.at": "{name} në {time}",
  "prayer.in": "për",
  "time.hours": "orë",
  "time.minutes": "min",
  "month.more": "+{n} të tjera",
  "grid.createAria": "Krijo takim më {date} në orën {hour}:00",
  "cal.personal": "Personale",
  "cal.work": "Punë",
  "cal.family": "Familje",
  "cal.mosque": "Xhami / Shoqatë",
  "event.title": "Takim",
  "event.desc": "Planifiko takimin rreth kohëve të namazit.",
  "event.untitled": "Takim i ri",
  "field.title": "Titulli",
  "field.titlePlaceholder": "p.sh. Mbledhje ekipi",
  "field.start": "Fillimi",
  "field.end": "Mbarimi",
  "field.calendar": "Kalendari",
  "field.reminder": "Kujtesë",
  "field.notes": "Shënime",
  "reminder.none": "Asnjë",
  "reminder.before": "{m} min para",
  "conflict.title": "Përplaset me kohën e namazit",
  "conflict.shift": "Zhvendos takimin pas namazit",
  "action.delete": "Fshi",
  "action.save": "Ruaj",
  "settings.title": "Cilësimet",
  "settings.desc": "Rregullo vendndodhjen, metodën e llogaritjes dhe kujtesat.",
  "field.method": "Metoda e llogaritjes",
  "field.madhab": "Llogaritja e Asrit (medhhebi)",
  "madhab.shafi": "Shafi'i / Maliki / Hanbeli",
  "madhab.hanafi": "Hanefi",
  "field.duration": "Kohëzgjatja e namazit (min)",
  "loc.auto": "Zbulo vendndodhjen automatikisht",
  "loc.autoHint": "Përdor lejen e vendndodhjes së shfletuesit.",
  "field.lat": "Gjerësia gjeografike",
  "field.lon": "Gjatësia gjeografike",
  "field.locName": "Emri i vendit",
  "loc.detect": "Zbulo vendndodhjen tani",
  "loc.detecting": "Duke kërkuar vendndodhjen…",
  "field.timezone": "Zona kohore",
  "field.prayerReminder": "Kujtesa e namazit",
  "toast.geoUnsupported": "Zbulimi i vendndodhjes nuk mbështetet.",
  "toast.located": "Kohët e namazit u përditësuan për vendndodhjen tënde.",
  "toast.geoFailed": "Vendndodhja s'është e disponueshme – shkruaje manualisht.",
  "loc.current": "Vendndodhja aktuale",
  "notif.event": "Takim: {title}",
  "notif.eventBody": "Fillon në {time}.",
  "notif.prayerSoon": "{label} së shpejti",
  "notif.prayerBody": "Namazi fillon në {time}.",
};

const DICTS: Record<Lang, Dict> = { de, en, ar, sq };

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface Ctx {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
  dir: "ltr" | "rtl";
}

const I18nContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "mtk.lang";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && stored in DICTS) {
      setLangState(stored);
      return;
    }
    const nav = window.navigator.language.slice(0, 2) as Lang;
    if (nav in DICTS) setLangState(nav);
  }, []);

  useEffect(() => {
    setDateLocale(lang);
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => {
      const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
      if (!vars) return raw;
      return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
    },
    [lang],
  );

  const value = useMemo<Ctx>(
    () => ({ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
