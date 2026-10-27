import { effect } from '@preact/signals';
import * as Store from '../lib/store.ts';
import { applyThemePreference, themePopoverOpen, themePreference } from '../state/theme.ts';
import { doNew, doSave, doSaveAs, triggerOpenFilePicker } from './file.ts';

function handleKeydown(e: KeyboardEvent): void {
  const ctrlOrCmd = e.ctrlKey || e.metaKey;
  if (!ctrlOrCmd) {
    return;
  }
  const key = e.key.toLowerCase();
  if (key === 's') {
    e.preventDefault();
    if (e.shiftKey) {
      doSaveAs();
    } else {
      doSave();
    }
  } else if (key === 'o') {
    e.preventDefault();
    triggerOpenFilePicker();
  } else if (key === 'n') {
    e.preventDefault();
    doNew();
  }
}

let globalListenersAttached = false;

export function attachGlobalListeners(): void {
  if (globalListenersAttached) {
    return;
  }
  globalListenersAttached = true;

  globalThis.document.addEventListener('keydown', handleKeydown);

  globalThis.document.addEventListener('click', () => {
    if (themePopoverOpen.value) {
      themePopoverOpen.value = false;
    }
  });

  globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePreference.value.mode === 'system') {
      applyThemePreference();
    }
  });

  globalThis.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
    if (Store.dirty.value) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  effect(() => {
    themePreference.value;
    themePopoverOpen.value;
    Store.dirty.value;
    applyThemePreference();
  });
}
