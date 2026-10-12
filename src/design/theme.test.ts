import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getStoredThemePreference, resolveTheme, setThemePreference, useThemePreference } from './theme';

const STORAGE_KEY = 'atlas-fit-theme';

type SchemeListener = (event: MediaQueryListEvent) => void;

/** Installs a controllable matchMedia stub so OS colour-scheme tests stay deterministic. */
function stubSystemScheme(startsDark = false) {
  const state = { dark: startsDark };
  const listeners = new Set<SchemeListener>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return state.dark; },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: SchemeListener) => { listeners.add(listener); },
    removeEventListener: (_type: string, listener: SchemeListener) => { listeners.delete(listener); },
    addListener: (listener: SchemeListener) => { listeners.add(listener); },
    removeListener: (listener: SchemeListener) => { listeners.delete(listener); },
    dispatchEvent: () => true,
  }) as unknown as MediaQueryList);
  return {
    get subscriberCount() { return listeners.size; },
    setDark(dark: boolean) {
      state.dark = dark;
      listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent));
    },
  };
}

describe('theme preference', () => {
  let scheme: ReturnType<typeof stubSystemScheme>;
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    scheme = stubSystemScheme();
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('defaults to system when nothing is stored', () => {
    expect(getStoredThemePreference()).toBe('system');
  });

  it('persists an explicit preference and reads it back', () => {
    setThemePreference('dark');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(getStoredThemePreference()).toBe('dark');
    setThemePreference('light');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(getStoredThemePreference()).toBe('light');
    setThemePreference('system');
    expect(getStoredThemePreference()).toBe('system');
  });

  it('falls back to system for a malformed stored value', () => {
    window.localStorage.setItem(STORAGE_KEY, 'midnight');
    expect(getStoredThemePreference()).toBe('system');
    window.localStorage.setItem(STORAGE_KEY, 'DARK');
    expect(getStoredThemePreference()).toBe('system');
    window.localStorage.setItem(STORAGE_KEY, '{"mode":"dark"}');
    expect(getStoredThemePreference()).toBe('system');
  });

  it('tolerates unavailable storage instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(getStoredThemePreference()).toBe('system');
    expect(() => setThemePreference('light')).not.toThrow();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('resolves dark and light explicitly regardless of the device setting', () => {
    scheme.setDark(true);
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
    scheme.setDark(false);
    expect(resolveTheme('dark')).toBe('dark');
    expect(resolveTheme('light')).toBe('light');
  });

  it('resolves system from the mocked device colour scheme', () => {
    scheme.setDark(true);
    expect(resolveTheme('system')).toBe('dark');
    scheme.setDark(false);
    expect(resolveTheme('system')).toBe('light');
  });

  it('writes data-theme on the document element', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    scheme.setDark(true);
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
    scheme.setDark(false);
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('exposes and applies a preference through the hook', () => {
    const { result } = renderHook(() => useThemePreference());
    expect(result.current[0]).toBe('system');
    act(() => { result.current[1]('dark'); });
    expect(result.current[0]).toBe('dark');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('follows device scheme changes only while set to system', () => {
    const { result } = renderHook(() => useThemePreference());
    act(() => { scheme.setDark(true); });
    expect(document.documentElement.dataset.theme).toBe('dark');
    act(() => { result.current[1]('light'); });
    expect(scheme.subscriberCount).toBe(0);
    act(() => { scheme.setDark(false); });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(result.current[0]).toBe('light');
  });

  it('subscribes to matchMedia only while set to system', () => {
    const { unmount } = renderHook(() => useThemePreference());
    expect(scheme.subscriberCount).toBe(1);
    unmount();
    expect(scheme.subscriberCount).toBe(0);
  });

  it('picks up preference changes from other tabs via storage events', () => {
    const { result } = renderHook(() => useThemePreference());
    window.localStorage.setItem(STORAGE_KEY, 'dark');
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: 'dark' })); });
    expect(result.current[0]).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
