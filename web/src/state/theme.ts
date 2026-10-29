import { signal } from '@preact/signals';

const THEME_STORAGE_KEY = 'inventory-manager.theme';
const DEFAULT_SATURATION = 68;
const DEFAULT_LIGHTNESS = 48;
export const THEME_PRESETS: { name: string; h: number; s?: number; l?: number }[] = [
  { name: 'olive', h: 68, s: 39, l: 30 },
  { name: 'violet', h: 264 },
  { name: 'amber', h: 25 },
  { name: 'teal', h: 175 },
  { name: 'indigo', h: 235 },
];

export interface ThemePreference {
  hue: number;
  mode: 'system' | 'light' | 'dark';
}

function loadThemePreference(): ThemePreference {
  try {
    const stored = JSON.parse(globalThis.localStorage.getItem(THEME_STORAGE_KEY) as string);
    return Object.assign({ hue: 68, mode: 'system' }, stored || {});
  } catch {
    return { hue: 68, mode: 'system' };
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
  const preset = THEME_PRESETS.find((p) => p.h === pref.hue);
  root.style.setProperty('--accent-h', String(pref.hue));
  root.style.setProperty('--accent-s', (preset?.s ?? DEFAULT_SATURATION) + '%');
  root.style.setProperty('--accent-l', (preset?.l ?? DEFAULT_LIGHTNESS) + '%');
  const isDark =
    pref.mode === 'dark' ||
    (pref.mode === 'system' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}
