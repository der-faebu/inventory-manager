'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

function load() {
  const globals = freshGlobals();
  delete globalThis.FileIO;
  const fs = require('fs');
  const path = require('path');
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'file-io.js'), 'utf8');
  // eslint-disable-next-line no-eval
  (0, eval)(code);
  return Object.assign({ FileIO: globalThis.FileIO }, globals);
}

test('suggestFilename uses customer name when present', () => {
  const { FileIO, Schema } = load();
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme Corp';
  assert.equal(FileIO.suggestFilename(doc), 'Bestandsaufnahme Acme Corp.bestand');
});

test('suggestFilename falls back to Kunde when no customer name', () => {
  const { FileIO, Schema } = load();
  const doc = Schema.emptyDocument();
  assert.equal(FileIO.suggestFilename(doc), 'Bestandsaufnahme Kunde.bestand');
});

test('suggestFilename sanitizes illegal filesystem characters', () => {
  const { FileIO, Schema } = load();
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme/Corp: "Special" <Client>|*?';
  assert.equal(FileIO.suggestFilename(doc), 'Bestandsaufnahme Acme_Corp_ _Special_ _Client____.bestand');
});

test('serializeDocument produces parsable JSON matching the document', () => {
  const { FileIO, Schema } = load();
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme';
  const json = FileIO.serializeDocument(doc);
  assert.deepEqual(JSON.parse(json), doc);
});

test('parseDocument accepts a document with the correct format', () => {
  const { FileIO, Schema } = load();
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme';
  const json = FileIO.serializeDocument(doc);
  const parsed = FileIO.parseDocument(json);
  assert.deepEqual(parsed, doc);
});

test('parseDocument rejects invalid JSON', () => {
  const { FileIO } = load();
  assert.throws(() => FileIO.parseDocument('not json'));
});

test('parseDocument rejects a document with the wrong format', () => {
  const { FileIO } = load();
  const json = JSON.stringify({ format: 'something-else' });
  assert.throws(() => FileIO.parseDocument(json));
});
