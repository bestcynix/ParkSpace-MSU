import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "th.ac.msu.parkspace",
  appName: "ParkSpace MSU",
  webDir: "out",
  server: {
    androidScheme: "https",
  },
};

export default config;
