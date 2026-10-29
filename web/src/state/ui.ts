import { signal } from '@preact/signals';
import type { CollectionKey } from '../lib/schema.ts';

export const expandedFolders = signal<Record<string, boolean>>({});
export const statusMessage = signal('');
export const errorMessage = signal('');
export const saveAsPrompt = signal<{ defaultName: string } | null>(null);
export const unsavedChangesPrompt = signal<{ pendingAction: 'new' | 'open' } | null>(null);
export const pendingOpenFile = signal<File | null>(null);
export const deletePrompt = signal<{
  collectionKey: CollectionKey;
  id: string;
  links: { label: string; count: number }[];
} | null>(null);
export const migrationWarning = signal<string[] | null>(null);

export function showStatus(message: string): void {
  statusMessage.value = message;
  globalThis.setTimeout(() => {
    if (statusMessage.value === message) {
      statusMessage.value = '';
    }
  }, 3000);
}

export function showError(message: string): void {
  errorMessage.value = message;
}

export function toggleFolder(key: string): void {
  const current = expandedFolders.value;
  const isExpanded = current[key] !== false;
  expandedFolders.value = Object.assign({}, current, { [key]: !isExpanded });
}
