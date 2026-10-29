import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Schema from '../src/lib/schema.ts';

test('emptyDocument has the full root document shape', () => {
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
  assert.equal(Schema.ALL_COLLECTION_KEYS.length, 9);
});

test('monitors is hidden, the other 8 collections are visible in tree order', () => {
  assert.equal(Schema.COLLECTIONS.monitors.hidden, true);
  assert.equal(Schema.TREE_ORDER.length, 8);
  assert.ok(!Schema.TREE_ORDER.includes('monitors' as never));
  for (const key of Schema.TREE_ORDER) {
    assert.equal(Schema.COLLECTIONS[key].hidden, false);
  }
});

test('fieldError accepts an empty value for date and ip fields', () => {
  assert.equal(Schema.fieldError({ type: 'date' }, ''), '');
  assert.equal(Schema.fieldError({ type: 'ip' }, ''), '');
});

test('fieldError validates YYYY.MM.DD dates', () => {
  assert.equal(Schema.fieldError({ type: 'date' }, '2026.10.25'), '');
  assert.notEqual(Schema.fieldError({ type: 'date' }, '2026.13.01'), '');
  assert.notEqual(Schema.fieldError({ type: 'date' }, '2026.02.30'), '');
  assert.notEqual(Schema.fieldError({ type: 'date' }, '25.10.2026'), '');
  assert.notEqual(Schema.fieldError({ type: 'date' }, 'not a date'), '');
});

test('fieldError validates IPv4 addresses', () => {
  assert.equal(Schema.fieldError({ type: 'ip' }, '192.168.1.1'), '');
  assert.equal(Schema.fieldError({ type: 'ip' }, '0.0.0.0'), '');
  assert.notEqual(Schema.fieldError({ type: 'ip' }, '256.0.0.1'), '');
  assert.notEqual(Schema.fieldError({ type: 'ip' }, '192.168.1'), '');
  assert.notEqual(Schema.fieldError({ type: 'ip' }, 'not an ip'), '');
});

test('dateToInputValue converts a valid stored date to the native picker format', () => {
  assert.equal(Schema.dateToInputValue('2026.10.25'), '2026-10-25');
  assert.equal(Schema.dateToInputValue(''), '');
  assert.equal(Schema.dateToInputValue('not a date'), '');
});

test('dateFromInputValue converts the native picker format back to the stored format', () => {
  assert.equal(Schema.dateFromInputValue('2026-10-25'), '2026.10.25');
  assert.equal(Schema.dateFromInputValue(''), '');
});

test('device and network ip/date fields are typed in the schema', () => {
  const deviceIp = Schema.DEVICE_FIELDS.find((f) => f.key === 'ip');
  const deviceDelivery = Schema.DEVICE_FIELDS.find((f) => f.key === 'deliveryDate');
  const networkIp = Schema.NETWORK_FIELDS.find((f) => f.key === 'ip');
  const networkSupport = Schema.NETWORK_FIELDS.find((f) => f.key === 'supportUntil');

  assert.equal(deviceIp?.type, 'ip');
  assert.equal(deviceDelivery?.type, 'date');
  assert.equal(networkIp?.type, 'ip');
  assert.equal(networkSupport?.type, 'date');
});

test('entityLabel uses the name field for devices/users/network/applications/locations', () => {
  assert.equal(Schema.entityLabel('devices', { name: 'PC-1' }), 'PC-1');
  assert.equal(Schema.entityLabel('users', { name: 'Doe John' }), 'Doe John');
  assert.equal(Schema.entityLabel('network', { name: 'Switch-1' }), 'Switch-1');
  assert.equal(Schema.entityLabel('applications', { name: 'App1' }), 'App1');
  assert.equal(Schema.entityLabel('locations', { name: 'HQ' }), 'HQ');
});

test('entityLabel uses product for licenses', () => {
  assert.equal(Schema.entityLabel('licenses', { product: 'Office 365 E3' }), 'Office 365 E3');
});

test('entityLabel uses address for mailboxes', () => {
  assert.equal(Schema.entityLabel('mailboxes', { address: 'info@example.com' }), 'info@example.com');
});

test('entityLabel uses inventoryNumber, falling back to model, for monitors', () => {
  assert.equal(Schema.entityLabel('monitors', { inventoryNumber: 'INV1', model: 'Dell' }), 'INV1');
  assert.equal(Schema.entityLabel('monitors', { inventoryNumber: '', model: 'Dell' }), 'Dell');
});

test('entityLabel falls back to (unnamed) when the title field is blank', () => {
  assert.equal(Schema.entityLabel('devices', { name: '' }), '(unnamed)');
  assert.equal(Schema.entityLabel('licenses', { product: '' }), '(unnamed)');
  assert.equal(Schema.entityLabel('monitors', { inventoryNumber: '', model: '' }), '(unnamed)');
});

test('emptyEntity seeds every field key plus owning association array fields', () => {
  const device = Schema.emptyEntity('devices');
  for (const field of Schema.DEVICE_FIELDS) {
    assert.equal(device[field.key], '');
  }
  assert.deepEqual(device.users, []);
  assert.deepEqual(device.apps, []);
  assert.deepEqual(device.lizenzen, []);
});

test('normalizeDocument backfills missing collection arrays', () => {
  const doc = Schema.normalizeDocument({ format: Schema.FORMAT, customer: Schema.emptyCustomer(), portInfo: {} });
  for (const key of Schema.ALL_COLLECTION_KEYS) {
    assert.deepEqual(doc[key], []);
  }
});

test('portStatus reflects occupied/faulty/free', () => {
  assert.equal(Schema.portStatus({ id: 'x' }, null), 'occupied');
  assert.equal(Schema.portStatus(null, { status: 'faulty' }), 'faulty');
  assert.equal(Schema.portStatus(null, null), 'free');
});

test('makeId returns an 8-character id', () => {
  const id = Schema.makeId();
  assert.equal(id.length, 8);
  assert.notEqual(id, Schema.makeId());
});
