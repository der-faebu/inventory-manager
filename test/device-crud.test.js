'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

test('addDevice adds a device with an id and bumps revision', () => {
  const { Store } = freshGlobals();
  const before = Store.revision.value;
  const device = Store.addDevice();
  assert.equal(Store.document.value.devices.length, 1);
  assert.equal(Store.document.value.devices[0], device);
  assert.ok(typeof device.id === 'string' && device.id.length === 8);
  assert.equal(Store.revision.value, before + 1);
  assert.equal(Store.dirty.value, true);
});

test('addDevice creates a device with empty default fields', () => {
  const { Store } = freshGlobals();
  const device = Store.addDevice();
  assert.equal(device.name, '');
  assert.equal(device.type, '');
  assert.equal(device.location, '');
  assert.equal(device.switch, '');
});

test('updateDevice patches an existing device by id and bumps revision', () => {
  const { Store } = freshGlobals();
  const device = Store.addDevice();
  const before = Store.revision.value;
  Store.updateDevice(device.id, { name: 'Laptop 1', type: 'Laptop' });
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.equal(updated.name, 'Laptop 1');
  assert.equal(updated.type, 'Laptop');
  assert.equal(Store.revision.value, before + 1);
  assert.equal(Store.dirty.value, true);
});

test('updateDevice does not affect other devices', () => {
  const { Store } = freshGlobals();
  const a = Store.addDevice();
  const b = Store.addDevice();
  Store.updateDevice(a.id, { name: 'A' });
  const refreshedB = Store.document.value.devices.find((d) => d.id === b.id);
  assert.equal(refreshedB.name, '');
});

test('deleteDevice removes the device and bumps revision', () => {
  const { Store } = freshGlobals();
  const device = Store.addDevice();
  const before = Store.revision.value;
  Store.deleteDevice(device.id);
  assert.equal(Store.document.value.devices.length, 0);
  assert.equal(Store.revision.value, before + 1);
  assert.equal(Store.dirty.value, true);
});

test('deleteDevice clears selection if the deleted device was selected', () => {
  const { Store } = freshGlobals();
  const device = Store.addDevice();
  Store.selectedKey.value = 'devices:' + device.id;
  Store.deleteDevice(device.id);
  assert.equal(Store.selectedKey.value, 'devices');
});

test('deleteDevice leaves selection untouched if a different device was selected', () => {
  const { Store } = freshGlobals();
  const a = Store.addDevice();
  const b = Store.addDevice();
  Store.selectedKey.value = 'devices:' + b.id;
  Store.deleteDevice(a.id);
  assert.equal(Store.selectedKey.value, 'devices:' + b.id);
});
