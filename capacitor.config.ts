import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.trendequity.app',
  appName: 'Trend Equity',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
