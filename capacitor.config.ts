import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.muslimtermin.app",
  appName: "Muslimischer Terminkalender",
  webDir: "dist",
  server: {
    // Die App ist serverseitig gerendert, daher lädt die native Hülle die Live-Seite.
    url: "https://muslim-calendar.com",
    cleartext: false,
  },
  android: {
    backgroundColor: "#ffffff",
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#ffffff",
  },
};

export default config;