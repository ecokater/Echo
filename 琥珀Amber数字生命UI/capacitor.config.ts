import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.amber.app",
  appName: "琥珀 Amber",
  webDir: "dist",
  // For on-device dev against a backend on your dev machine, point server.url
  // at your LAN IP (e.g. http://192.168.1.10:5173) and run `npx vite --host`.
  // For production, ship the bundled dist/ and set VITE_API_BASE_URL to the cloud API.
  server: {
    androidScheme: "http",
    // url: process.env.CAP_SERVER_URL,  // uncomment for live-reload on device
    cleartext: true,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
