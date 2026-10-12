import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/** Keep Android's status/navigation icons readable when overriding device theme. */
export function syncNativeSystemBars(theme: 'dark' | 'light'): void {
  if (!Capacitor.isNativePlatform()) return;
  void SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light })
    .catch(() => { /* Older native hosts can retain their system default. */ });
}
