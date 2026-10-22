'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

test('dirty is false initially', () => {
  const { Store } = freshGlobals();
  assert.equal(Store.dirty.value, false);
});

test('dirty flips true after a direct mutation to revision', () => {
  const { Store } = freshGlobals();
  assert.equal(Store.dirty.value, false);
  Store.bumpRevision();
  assert.equal(Store.dirty.value, true);
});

test('markSaved brings dirty back to false', () => {
  const { Store } = freshGlobals();
  Store.bumpRevision();
  assert.equal(Store.dirty.value, true);
  Store.markSaved();
  assert.equal(Store.dirty.value, false);
});

test('updateCustomer mutates the signal and marks dirty', () => {
  const { Store } = freshGlobals();
  Store.updateCustomer({ name: 'Acme Corp' });
  assert.equal(Store.document.value.customer.name, 'Acme Corp');
  assert.equal(Store.dirty.value, true);
});

test('resetDocument clears dirty state and selection', () => {
  const { Store } = freshGlobals();
  Store.updateCustomer({ name: 'Acme Corp' });
  Store.selectedKey.value = 'devices:abc12345';
  Store.resetDocument();
  assert.equal(Store.dirty.value, false);
  assert.equal(Store.selectedKey.value, 'customer');
  assert.equal(Store.document.value.customer.name, '');
});
