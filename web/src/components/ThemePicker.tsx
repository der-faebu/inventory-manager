import type { JSX } from 'preact';
import { THEME_PRESETS, setThemeHue, setThemeMode, themePopoverOpen, themePreference } from '../state/theme.ts';

export function ThemePicker(): JSX.Element {
  const pref = themePreference.value;
  const isOpen = themePopoverOpen.value;

  return (
    <div class="relative">
      <button
        class="flex h-[34px] w-[34px] items-center justify-center rounded-full border-none bg-[var(--surface)] p-0 text-base shadow-[0_1px_2px_rgba(0,0,0,0.15)] hover:bg-[var(--surface-sunk)]"
        title="Theme"
        aria-label="Theme settings"
        onClick={(e: Event) => {
          e.stopPropagation();
          themePopoverOpen.value = !themePopoverOpen.value;
        }}
      >
        🎨
      </button>
      {isOpen ? (
        <div
          class="absolute right-0 top-11 z-50 w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
          onClick={(e: Event) => e.stopPropagation()}
        >
          <h4 class="mb-2 mt-0 text-xs uppercase tracking-wide text-[color:var(--accent-text)]">Accent color</h4>
          <div class="mb-3.5 flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                class={
                  'h-7 w-7 rounded-full border-2 border-[var(--border)] p-0' +
                  (pref.hue === preset.h
                    ? ' border-[color:var(--ink)] shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--accent)]'
                    : '')
                }
                title={preset.name}
                style={'background: hsl(' + preset.h + ' ' + (preset.s ?? 68) + '% ' + (preset.l ?? 48) + '%)'}
                onClick={() => {
                  setThemeHue(preset.h);
                }}
              ></button>
            ))}
          </div>
          <div class="mb-3.5 flex items-center gap-2">
            <span style="font-size: 12px">custom</span>
            <input
              class="min-w-0 flex-1"
              type="range"
              min="0"
              max="360"
              value={pref.hue}
              onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
                setThemeHue(Number(e.currentTarget.value));
              }}
            />
          </div>
          <h4 class="mb-2 mt-0 text-xs uppercase tracking-wide text-[color:var(--accent-text)]">Appearance</h4>
          <div class="flex overflow-hidden rounded-lg border border-[var(--border)]">
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                class={
                  'border-l border-l-[var(--border)] px-2.5 py-1 text-xs font-medium text-[color:var(--ink)] first:border-l-0' +
                  (pref.mode === mode ? ' bg-[var(--accent)] font-bold text-white' : ' bg-[var(--surface)]')
                }
                onClick={() => {
                  setThemeMode(mode);
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        ''
      )}
    </div>
  );
}
