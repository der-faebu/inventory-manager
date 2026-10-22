'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

test('entityLabel uses the name field for devices/users/network/applications/locations', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.entityLabel('devices', { name: 'PC-1' }), 'PC-1');
  assert.equal(Schema.entityLabel('users', { name: 'Doe John' }), 'Doe John');
  assert.equal(Schema.entityLabel('network', { name: 'Switch-1' }), 'Switch-1');
  assert.equal(Schema.entityLabel('applications', { name: 'App1' }), 'App1');
  assert.equal(Schema.entityLabel('locations', { name: 'HQ' }), 'HQ');
});

test('entityLabel uses product for licenses', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.entityLabel('licenses', { product: 'Office 365 E3' }), 'Office 365 E3');
});

test('entityLabel uses address for mailboxes', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.entityLabel('mailboxes', { address: 'info@example.com' }), 'info@example.com');
});

test('entityLabel uses inventoryNumber, falling back to model, for monitors', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.entityLabel('monitors', { inventoryNumber: 'INV1', model: 'Dell' }), 'INV1');
  assert.equal(Schema.entityLabel('monitors', { inventoryNumber: '', model: 'Dell' }), 'Dell');
});

test('entityLabel falls back to (unnamed) when the title field is blank', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.entityLabel('devices', { name: '' }), '(unnamed)');
  assert.equal(Schema.entityLabel('licenses', { product: '' }), '(unnamed)');
  assert.equal(Schema.entityLabel('monitors', { inventoryNumber: '', model: '' }), '(unnamed)');
});
