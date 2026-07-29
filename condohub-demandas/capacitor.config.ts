import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? "https://condohub-app.onrender.com";

const config: CapacitorConfig = {
  appId: "com.condohub.app",
  appName: "CondoHub",
  webDir: "capacitor-web",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    allowNavigation: ["*.clerk.accounts.dev"],
  },
  android: {
    backgroundColor: "#f4f7fb",
  },
};

export default config;
