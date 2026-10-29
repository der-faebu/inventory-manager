import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Store from '../src/lib/store.ts';
import * as Schema from '../src/lib/schema.ts';

test('filename starts unset', () => {
  assert.equal(Store.filename.value, null);
});

test('loadDocument replaces the document, resets dirty, and sets filename', () => {
  Store.updateCustomer({ name: 'Old' });
  const incoming = Schema.emptyDocument();
  incoming.customer.name = 'New Co';

  Store.loadDocument(incoming, 'client.bestand');

  assert.equal(Store.document.value.customer.name, 'New Co');
  assert.equal(Store.dirty.value, false);
  assert.equal(Store.filename.value, 'client.bestand');
  assert.equal(Store.selectedKey.value, 'customer');
});

test('markSaved can record the filename used for this save', () => {
  Store.updateCustomer({ name: 'Acme' });
  Store.markSaved('Bestandsaufnahme Acme.bestand');
  assert.equal(Store.dirty.value, false);
  assert.equal(Store.filename.value, 'Bestandsaufnahme Acme.bestand');
});

test('resetDocument clears the filename', () => {
  Store.loadDocument(Schema.emptyDocument(), 'client.bestand');
  Store.resetDocument();
  assert.equal(Store.filename.value, null);
});
