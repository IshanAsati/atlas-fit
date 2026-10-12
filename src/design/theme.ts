import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'atlas-fit-theme';
const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'dark' || value === 'light';

/** Returns the OS colour-scheme query, or null when there is no usable window/matchMedia (SSR, old engines). */
function systemSchemeQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  try { return window.matchMedia(DARK_SCHEME_QUERY); } catch { /* matchMedia unusable → treat as light */ }
  return null;
}

/** Turns a preference into the concrete theme that the CSS tokens understand. */
export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'dark' || preference === 'light') return preference;
  try { if (systemSchemeQuery()?.matches) return 'dark'; } catch { /* unreadable scheme → light */ }
  return 'light';
}

/** Reads the stored preference. Corrupt values, denied storage, or a missing window all mean 'system'. */
export function getStoredThemePreference(): ThemePreference {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isThemePreference(stored)) return stored;
    }
  } catch { /* storage unavailable or unreadable → system */ }
  return 'system';
}

/** Writes `document.documentElement.dataset.theme` so tokens.css picks the matching token set. */
export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;
  root.dataset.theme = resolveTheme(preference);
}

/** Persists the preference (best effort) and applies it immediately. */
export function setThemePreference(preference: ThemePreference): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, preference);
  } catch { /* storage unavailable: the theme still applies for this session */ }
  applyTheme(preference);
}

/**
 * Returns `[preference, setPreference]`.
 * Re-applies the theme when the preference changes, follows the OS colour scheme while in 'system' mode,
 * and listens for `storage` events so other tabs stay in sync.
 */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredThemePreference());

  useEffect(() => { applyTheme(preference); }, [preference]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      const next = getStoredThemePreference();
      setPreferenceState(next);
      applyTheme(next);
    };
    window.addEventListener('storage', onStorage);
    let query: MediaQueryList | null = null;
    const onSchemeChange = () => applyTheme('system');
    if (preference === 'system') {
      query = systemSchemeQuery();
      query?.addEventListener('change', onSchemeChange);
    }
    return () => {
      window.removeEventListener('storage', onStorage);
      query?.removeEventListener('change', onSchemeChange);
    };
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setThemePreference(next);
    setPreferenceState(next);
  }, []);

  return [preference, setPreference];
}
