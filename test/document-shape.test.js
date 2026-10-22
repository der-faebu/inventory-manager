'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

test('emptyDocument has the full root signal shape', () => {
  const { Schema } = freshGlobals();
  const doc = Schema.emptyDocument();

  assert.equal(doc.format, 'inventory-manager-1');
  assert.deepEqual(doc.customer, {
    name: '',
    number: '',
    contact: '',
    date: '',
    takenBy: '',
    version: '',
  });
  assert.deepEqual(doc.portInfo, {});

  for (const key of Schema.ALL_COLLECTION_KEYS) {
    assert.ok(Array.isArray(doc[key]), `${key} should be an array`);
    assert.equal(doc[key].length, 0);
  }
  assert.equal(Schema.ALL_COLLECTION_KEYS.length, 8);
});

test('monitors is hidden, the other 7 collections are visible in tree order', () => {
  const { Schema } = freshGlobals();

  assert.equal(Schema.COLLECTIONS.monitors.hidden, true);
  assert.equal(Schema.TREE_ORDER.length, 7);
  assert.ok(!Schema.TREE_ORDER.includes('monitors'));
  for (const key of Schema.TREE_ORDER) {
    assert.equal(Schema.COLLECTIONS[key].hidden, false);
  }
});

test('Store.document starts as the empty document', () => {
  const { Store, Schema } = freshGlobals();
  assert.deepEqual(Store.document.value, Schema.emptyDocument());
});
