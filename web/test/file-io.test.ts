import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Schema from '../src/lib/schema.ts';
import * as FileIO from '../src/lib/file-io.ts';

test('suggestFilename uses customer name when present', () => {
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme Corp';
  assert.equal(FileIO.suggestFilename(doc), 'Bestandsaufnahme Acme Corp.bestand');
});

test('suggestFilename falls back to Kunde when no customer name', () => {
  const doc = Schema.emptyDocument();
  assert.equal(FileIO.suggestFilename(doc), 'Bestandsaufnahme Kunde.bestand');
});

test('suggestFilename sanitizes illegal filesystem characters', () => {
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme/Corp: "Special" <Client>|*?';
  assert.equal(FileIO.suggestFilename(doc), 'Bestandsaufnahme Acme_Corp_ _Special_ _Client____.bestand');
});

test('serializeDocument produces parsable JSON matching the document', () => {
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme';
  const json = FileIO.serializeDocument(doc);
  assert.deepEqual(JSON.parse(json), doc);
});

test('parseDocument accepts a document with the correct format', () => {
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme';
  const json = FileIO.serializeDocument(doc);
  const parsed = FileIO.parseDocument(json);
  assert.deepEqual(parsed, doc);
});

test('parseDocument rejects invalid JSON', () => {
  assert.throws(() => FileIO.parseDocument('not json'));
});

test('parseDocument rejects a document with the wrong format', () => {
  const json = JSON.stringify({ format: 'something-else' });
  assert.throws(() => FileIO.parseDocument(json));
});
