import * as Schema from './schema.ts';
import type { Document } from './schema.ts';

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

export function suggestFilename(doc: Document): string {
  const customerName = doc.customer?.name || '';
  const base = customerName.trim() ? customerName : 'Kunde';
  return 'Bestandsaufnahme ' + sanitizeFilename(base) + '.bestand';
}

export function serializeDocument(doc: Document): string {
  return JSON.stringify(doc, null, 2);
}

export function parseDocument(json: string): Document {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!parsed || (parsed as Document).format !== Schema.FORMAT) {
    throw new Error('File is not a recognized inventory document.');
  }
  return parsed as Document;
}

export async function listServerFiles(): Promise<string[]> {
  const response = await fetch('/api/files');
  if (!response.ok) {
    throw new Error(`Failed to list files: ${response.status}`);
  }
  return (await response.json()) as string[];
}

export async function saveDocumentToServer(doc: Document, name: string): Promise<void> {
  const response = await fetch(`/api/files/${encodeURIComponent(name)}`, {
    method: 'PUT',
    body: serializeDocument(doc),
  });
  if (!response.ok) {
    throw new Error(`Failed to save ${name}: ${response.status}`);
  }
}

export async function loadDocumentFromServer(name: string): Promise<Document> {
  const response = await fetch(`/api/files/${encodeURIComponent(name)}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${name}: ${response.status}`);
  }
  return parseDocument(await response.text());
}
