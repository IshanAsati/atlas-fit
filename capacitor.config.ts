import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ishanasati.atlasfit',
  appName: 'Atlas Fit',
  webDir: 'dist',
  // Ship the UI and catalogue in the APK; never depend on a live website.
  server: { androidScheme: 'https' },
  android: { allowMixedContent: false },
};

export default config;
