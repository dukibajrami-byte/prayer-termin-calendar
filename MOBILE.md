# Android- & iOS-App (Capacitor)

Die App ist als native Hülle (Capacitor) vorbereitet. Die native App lädt die
veröffentlichte Web-App (`https://muslimtermin.com`), Updates am Web-Code sind
damit sofort auch in der App sichtbar – ohne neuen Store-Release.

## Einmalige Einrichtung (auf deinem eigenen Rechner)

1. Projekt per GitHub exportieren und lokal klonen (Button "Export to GitHub" in Lovable).
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. Plattformen hinzufügen:
   ```bash
   npx cap add android
   npx cap add ios
   ```
4. Web-Build erzeugen und synchronisieren:
   ```bash
   npm run build
   npx cap sync
   ```

## App starten

```bash
npx cap run android   # benötigt Android Studio
npx cap run ios       # benötigt macOS + Xcode
```

## Veröffentlichen

- **Android:** In Android Studio ein signiertes AAB bauen (`Build > Generate Signed Bundle`)
  und im Google Play Console hochladen.
- **iOS:** In Xcode ein Archive erstellen und über App Store Connect einreichen
  (Apple Developer Program erforderlich).

App-ID: `com.muslimtermin.app` · App-Name: `Muslimischer Terminkalender`
Icons liegen unter `public/icon-192.png` und `public/icon-512.png`.