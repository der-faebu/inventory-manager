import { signal } from '@preact/signals';

const THEME_STORAGE_KEY = 'inventory-manager.theme';
export const THEME_PRESETS = [
  { name: 'amber', h: 25 },
  { name: 'teal', h: 175 },
  { name: 'indigo', h: 235 },
  { name: 'rose', h: 345 },
  { name: 'olive', h: 95 },
];

export interface ThemePreference {
  hue: number;
  mode: 'system' | 'light' | 'dark';
}

function loadThemePreference(): ThemePreference {
  try {
    const stored = JSON.parse(globalThis.localStorage.getItem(THEME_STORAGE_KEY) as string);
    return Object.assign({ hue: 25, mode: 'system' }, stored || {});
  } catch {
    return { hue: 25, mode: 'system' };
  }
}

export const themePreference = signal<ThemePreference>(loadThemePreference());
export const themePopoverOpen = signal(false);

function saveThemePreference(next: ThemePreference): void {
  themePreference.value = next;
  globalThis.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
}

export function setThemeHue(hue: number): void {
  saveThemePreference(Object.assign({}, themePreference.value, { hue: Number(hue) }));
}

export function setThemeMode(mode: ThemePreference['mode']): void {
  saveThemePreference(Object.assign({}, themePreference.value, { mode }));
}

export function applyThemePreference(): void {
  const pref = themePreference.value;
  const root = globalThis.document.documentElement;
  root.style.setProperty('--accent-h', String(pref.hue));
  const isDark =
    pref.mode === 'dark' ||
    (pref.mode === 'system' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}
