import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHealthConnectStatus, getTodayHealthSummary, nativeHealthAvailable, openHealthConnect, requestHealthAccess,
} from './healthConnect';

const mocks = vi.hoisted(() => ({
  native: vi.fn(), platform: vi.fn(), pluginName: '',
  plugin: { getStatus: vi.fn(), requestAccess: vi.fn(), getTodaySummary: vi.fn(), openHealthConnect: vi.fn() },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native, getPlatform: mocks.platform },
  registerPlugin: (name: string) => { mocks.pluginName = name; return mocks.plugin; },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.native.mockReturnValue(true);
  mocks.platform.mockReturnValue('android');
  mocks.plugin.getStatus.mockResolvedValue({ status: 'available', permissionsGranted: true });
  mocks.plugin.requestAccess.mockResolvedValue({ granted: true });
});

describe('Read-only Health Connect bridge', () => {
  it('registers the exact native plugin name', () => {
    expect(mocks.pluginName).toBe('AtlasHealth');
    expect(Object.keys(mocks.plugin)).toEqual(['getStatus', 'requestAccess', 'getTodaySummary', 'openHealthConnect']);
    expect(nativeHealthAvailable()).toBe(true);
  });
  it('does not call native methods in a browser', async () => {
    mocks.native.mockReturnValue(false);
    expect(await getHealthConnectStatus()).toEqual({ status: 'unavailable', permissionsGranted: false });
    expect(await getTodayHealthSummary()).toBeNull();
    expect(await requestHealthAccess()).toBe(false);
    await openHealthConnect();
    for (const method of Object.values(mocks.plugin)) expect(method).not.toHaveBeenCalled();
  });
  it('does not attempt Health Connect on iOS', async () => {
    mocks.platform.mockReturnValue('ios');
    expect(await getTodayHealthSummary()).toBeNull();
    expect(mocks.plugin.getStatus).not.toHaveBeenCalled();
  });
  it.each(['unavailable', 'install-required'])('preserves %s and does not install or prompt automatically', async (status) => {
    mocks.plugin.getStatus.mockResolvedValue({ status, permissionsGranted: false });
    expect((await getHealthConnectStatus()).status).toBe(status);
    expect(await getTodayHealthSummary()).toBeNull();
    expect(mocks.plugin.getTodaySummary).not.toHaveBeenCalled();
    expect(mocks.plugin.requestAccess).not.toHaveBeenCalled();
    expect(mocks.plugin.openHealthConnect).not.toHaveBeenCalled();
  });
  it('does not read or prompt when steps permission is denied', async () => {
    mocks.plugin.getStatus.mockResolvedValue({ status: 'available', permissionsGranted: false });
    expect(await getTodayHealthSummary()).toBeNull();
    expect(mocks.plugin.getTodaySummary).not.toHaveBeenCalled();
    expect(mocks.plugin.requestAccess).not.toHaveBeenCalled();
  });
  it('preserves missing optional metrics and real recorded zero', async () => {
    const data = { date: '2026-10-12', steps: 0, distanceKm: null, activeCalories: null };
    mocks.plugin.getTodaySummary.mockResolvedValue(data);
    expect(await getTodayHealthSummary()).toEqual(data);
    expect(mocks.plugin.requestAccess).not.toHaveBeenCalled();
  });
  it('preserves missing steps instead of fabricating zero', async () => {
    const data = { date: '2026-10-12', steps: null, distanceKm: null, activeCalories: null };
    mocks.plugin.getTodaySummary.mockResolvedValue(data);
    expect(await getTodayHealthSummary()).toEqual(data);
  });
  it('returns permission denial from an explicit request', async () => {
    mocks.plugin.requestAccess.mockResolvedValue({ granted: false });
    expect(await requestHealthAccess()).toBe(false);
  });
  it('opens Health Connect only through the explicit method', async () => {
    await openHealthConnect();
    expect(mocks.plugin.openHealthConnect).toHaveBeenCalledOnce();
  });
  it('surfaces provider failure rather than inventing data', async () => {
    mocks.plugin.getTodaySummary.mockRejectedValue(new Error('Provider failed'));
    await expect(getTodayHealthSummary()).rejects.toThrow('Provider failed');
  });
});
