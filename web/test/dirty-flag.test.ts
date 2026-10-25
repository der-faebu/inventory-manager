import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Store from '../src/lib/store.ts';
import * as Schema from '../src/lib/schema.ts';

beforeEach(() => {
  Store.document.value = Schema.emptyDocument();
  Store.revision.value = 0;
  Store.lastSavedRevision.value = 0;
  Store.selectedKey.value = 'customer';
  Store.filename.value = null;
});

test('dirty is false initially', () => {
  assert.equal(Store.dirty.value, false);
});

test('dirty flips true after a direct mutation to revision', () => {
  assert.equal(Store.dirty.value, false);
  Store.bumpRevision();
  assert.equal(Store.dirty.value, true);
});

test('markSaved brings dirty back to false', () => {
  Store.bumpRevision();
  assert.equal(Store.dirty.value, true);
  Store.markSaved();
  assert.equal(Store.dirty.value, false);
});

test('updateCustomer mutates the signal and marks dirty', () => {
  Store.updateCustomer({ name: 'Acme Corp' });
  assert.equal(Store.document.value.customer.name, 'Acme Corp');
  assert.equal(Store.dirty.value, true);
});

test('resetDocument clears dirty state and selection', () => {
  Store.updateCustomer({ name: 'Acme Corp' });
  Store.selectedKey.value = 'devices:abc12345';
  Store.resetDocument();
  assert.equal(Store.dirty.value, false);
  assert.equal(Store.selectedKey.value, 'customer');
  assert.equal(Store.document.value.customer.name, '');
});
