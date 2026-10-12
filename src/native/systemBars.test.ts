import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncNativeSystemBars } from './systemBars';

const mocks = vi.hoisted(() => ({ native: vi.fn(), style: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mocks.native },
  SystemBars: { setStyle: mocks.style },
  SystemBarsStyle: { Dark: 'DARK', Light: 'LIGHT' },
}));
beforeEach(() => { vi.resetAllMocks(); mocks.style.mockResolvedValue(undefined); });

describe('Native system bar theme', () => {
  it('does not call native plugins in the browser', () => {
    mocks.native.mockReturnValue(false);
    syncNativeSystemBars('dark');
    expect(mocks.style).not.toHaveBeenCalled();
  });
  it.each(['dark', 'light'] as const)('matches the resolved %s app theme', (theme) => {
    mocks.native.mockReturnValue(true);
    syncNativeSystemBars(theme);
    expect(mocks.style).toHaveBeenCalledWith({ style: theme.toUpperCase() });
  });
  it('tolerates an unavailable native host', async () => {
    mocks.native.mockReturnValue(true);
    mocks.style.mockRejectedValue(new Error('Unavailable'));
    syncNativeSystemBars('light');
    await Promise.resolve();
  });
});
