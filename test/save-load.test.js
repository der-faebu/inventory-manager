'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

test('filename starts unset', () => {
  const { Store } = freshGlobals();
  assert.equal(Store.filename.value, null);
});

test('loadDocument replaces the document, resets dirty, and sets filename', () => {
  const { Store, Schema } = freshGlobals();
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
  const { Store } = freshGlobals();
  Store.updateCustomer({ name: 'Acme' });
  Store.markSaved('Bestandsaufnahme Acme.bestand');
  assert.equal(Store.dirty.value, false);
  assert.equal(Store.filename.value, 'Bestandsaufnahme Acme.bestand');
});

test('resetDocument clears the filename', () => {
  const { Store, Schema } = freshGlobals();
  Store.loadDocument(Schema.emptyDocument(), 'client.bestand');
  Store.resetDocument();
  assert.equal(Store.filename.value, null);
});
