import type { JSX } from 'preact';
import * as Store from '../lib/store.ts';
import { doExportExcel, doNew, doOpen, doSave, doSaveAs, triggerOpenFilePicker } from '../actions/file.ts';
import { statusMessage } from '../state/ui.ts';
import { ThemePicker } from './ThemePicker.tsx';
import { Button } from './ui/Button.tsx';

export function Toolbar(): JSX.Element {
  return (
    <div class="flex items-center gap-2 border-b-[3px] border-[var(--accent-darker)] bg-gradient-to-b from-[var(--accent)] to-[var(--accent-dark)] px-3 py-2">
      <Button variant="toolbar" onClick={doNew}>
        New
      </Button>
      <Button variant="toolbar" onClick={doSave}>
        Save
      </Button>
      <Button variant="toolbar" onClick={doSaveAs}>
        Save As…
      </Button>
      <Button variant="toolbar" onClick={triggerOpenFilePicker}>
        Open…
      </Button>
      <Button variant="toolbar" onClick={doExportExcel}>
        Export to Excel…
      </Button>
      <input
        id="open-file-input"
        type="file"
        accept=".bestand,application/json"
        style="display: none"
        onChange={(e: Event & { currentTarget: HTMLInputElement }) => {
          doOpen(e.currentTarget.files?.[0] || null);
        }}
      />
      <span class="ml-3 font-semibold text-white/85">
        {Store.filename.value || '(unsaved)'}
        {Store.dirty.value ? ' •' : ''}
      </span>
      <span class="font-semibold text-white">{statusMessage.value}</span>
      <div class="ml-auto"></div>
      <ThemePicker />
    </div>
  );
}
