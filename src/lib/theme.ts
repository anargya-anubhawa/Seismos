export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_KEY = 'seismos-theme';
export const THEME_CHANGE_EVENT = 'seismos-theme-change';

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return preference;
}

/** Terapkan tema dan beri tahu komponen lain, termasuk tombol tema di header. */
export function applyTheme(preference: ThemePreference): void {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(preference);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  try { localStorage.setItem(THEME_KEY, preference); } catch { /* penyimpanan diblokir */ }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, {
    detail: { preference, resolved },
  }));
}
