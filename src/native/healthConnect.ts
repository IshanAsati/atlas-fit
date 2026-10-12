import { Capacitor, registerPlugin } from '@capacitor/core';

export interface HealthConnectStatus {
  status: 'available' | 'install-required' | 'unavailable';
  /** Steps read access; distance and active energy remain optional. */
  permissionsGranted: boolean;
}

export interface TodayHealthSummary {
  date: string;
  steps: number | null;
  distanceKm: number | null;
  activeCalories: number | null;
}

interface AtlasHealthPlugin {
  getStatus(): Promise<HealthConnectStatus>;
  requestAccess(): Promise<{ granted: boolean }>;
  getTodaySummary(): Promise<TodayHealthSummary>;
  openHealthConnect(): Promise<void>;
}

const AtlasHealth = registerPlugin<AtlasHealthPlugin>('AtlasHealth');

export function nativeHealthAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function getHealthConnectStatus(): Promise<HealthConnectStatus> {
  if (!nativeHealthAvailable()) return { status: 'unavailable', permissionsGranted: false };
  return AtlasHealth.getStatus();
}

/** User action only. Reading status or a summary never requests OS permission. */
export async function requestHealthAccess(): Promise<boolean> {
  if (!nativeHealthAvailable()) return false;
  return (await AtlasHealth.requestAccess()).granted;
}

/** Null means no recorded data or no optional permission, never an invented zero. */
export async function getTodayHealthSummary(): Promise<TodayHealthSummary | null> {
  const status = await getHealthConnectStatus();
  if (status.status !== 'available' || !status.permissionsGranted) return null;
  return AtlasHealth.getTodaySummary();
}

/** User action only: opens settings or the provider’s install/update page. */
export async function openHealthConnect(): Promise<void> {
  if (nativeHealthAvailable()) await AtlasHealth.openHealthConnect();
}
