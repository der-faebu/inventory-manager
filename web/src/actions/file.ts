import * as Store from '../lib/store.ts';
import * as FileIO from '../lib/file-io.ts';
import * as LegacyMigration from '../lib/legacy-migration.ts';
import * as ExcelExport from '../lib/excel-export.ts';
import type { Document } from '../lib/schema.ts';
import {
  migrationWarning,
  pendingOpenFile,
  saveAsPrompt,
  showError,
  showStatus,
  unsavedChangesPrompt,
} from '../state/ui.ts';

function downloadBlob(blob: Blob, name: string): void {
  const url = globalThis.URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = name;
  globalThis.document.body.appendChild(link);
  link.click();
  globalThis.document.body.removeChild(link);
  globalThis.URL.revokeObjectURL(url);
}

function downloadDocument(doc: Document, name: string): void {
  const json = FileIO.serializeDocument(doc);
  downloadBlob(new Blob([json], { type: 'application/json' }), name);
}

export function doExportExcel(): void {
  try {
    const workbook = ExcelExport.buildWorkbook(Store.document.value);
    const binary = ExcelExport.writeBuffer(workbook);
    const blob = new Blob([binary], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const customerName = Store.document.value.customer.name || 'Kunde';
    const name = 'Bestandsaufnahme ' + FileIO.sanitizeFilename(customerName) + '.xlsx';
    downloadBlob(blob, name);
    showStatus('Exported ' + name);
  } catch (e) {
    showError('Export failed: ' + (e as Error).message);
  }
}

function performSave(name: string): boolean {
  try {
    downloadDocument(Store.document.value, name);
    Store.markSaved(name);
    showStatus('Saved ' + name);
    return true;
  } catch (e) {
    showError('Save failed: ' + (e as Error).message);
    return false;
  }
}

function resolveSaveName(): string {
  return Store.filename.value || FileIO.suggestFilename(Store.document.value);
}

export function doSave(): void {
  performSave(resolveSaveName());
}

export function doSaveAs(): void {
  saveAsPrompt.value = { defaultName: resolveSaveName() };
}

export function confirmSaveAs(name: string): void {
  saveAsPrompt.value = null;
  if (name) {
    performSave(name);
  }
}

export function doNew(): void {
  if (Store.dirty.value) {
    unsavedChangesPrompt.value = { pendingAction: 'new' };
    return;
  }
  Store.resetDocument();
  showStatus('New document created');
}

function loadFile(file: File): void {
  const reader = new globalThis.FileReader();
  reader.onload = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(reader.result as string);
    } catch {
      showError('Open failed: file is not valid JSON.');
      return;
    }

    const format = LegacyMigration.detectFormat(parsed);
    try {
      if (format === 'current') {
        Store.loadDocument(parsed as unknown as Document, file.name);
        showStatus('Opened ' + file.name);
      } else if (format === 'legacy') {
        const result = LegacyMigration.migrate(parsed);
        Store.loadDocument(result.document, null);
        Store.bumpRevision();
        showStatus('Migrated legacy file ' + file.name);
        if (result.unmappedFields.length > 0) {
          migrationWarning.value = result.unmappedFields;
        }
      } else {
        showError('Open failed: file is not a recognized inventory document.');
      }
    } catch (e) {
      showError('Open failed: ' + (e as Error).message);
    }
  };
  reader.onerror = () => {
    showError('Open failed: could not read the file.');
  };
  reader.readAsText(file);
}

export function doOpen(file: File | null): void {
  if (!file) {
    return;
  }
  if (Store.dirty.value) {
    pendingOpenFile.value = file;
    unsavedChangesPrompt.value = { pendingAction: 'open' };
    return;
  }
  loadFile(file);
}

export function resolveUnsavedChanges(choice: 'save' | 'discard' | 'cancel'): void {
  const prompt = unsavedChangesPrompt.value;
  if (!prompt) {
    return;
  }
  if (choice === 'cancel') {
    unsavedChangesPrompt.value = null;
    pendingOpenFile.value = null;
    return;
  }
  if (choice === 'save') {
    if (!performSave(resolveSaveName())) {
      return;
    }
  }
  unsavedChangesPrompt.value = null;
  if (prompt.pendingAction === 'new') {
    Store.resetDocument();
    showStatus('New document created');
  } else if (prompt.pendingAction === 'open') {
    const file = pendingOpenFile.value;
    pendingOpenFile.value = null;
    if (file) {
      loadFile(file);
    }
  }
}

export function triggerOpenFilePicker(): void {
  const input = globalThis.document.getElementById('open-file-input') as HTMLInputElement | null;
  if (input) {
    input.value = '';
    input.click();
  }
}
