'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

function findAssociation(Schema, ownerCollection, fieldKey) {
  return Schema.ASSOCIATIONS.find((a) => a.ownerCollection === ownerCollection && a.fieldKey === fieldKey);
}

test('toggleAssociation adds a target id to an owner entity array field', () => {
  const { Store, Schema } = freshGlobals();
  const device = Store.addDevice();
  const app = Store.addEntity('applications');
  const association = findAssociation(Schema, 'devices', 'apps');
  Store.toggleAssociation(association, device.id, app.id);
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.deepEqual(updated.apps, [app.id]);
  assert.equal(Store.dirty.value, true);
});

test('toggleAssociation removes a target id when called again (toggle off)', () => {
  const { Store, Schema } = freshGlobals();
  const device = Store.addDevice();
  const app = Store.addEntity('applications');
  const association = findAssociation(Schema, 'devices', 'apps');
  Store.toggleAssociation(association, device.id, app.id);
  Store.toggleAssociation(association, device.id, app.id);
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.deepEqual(updated.apps, []);
});

test('toggleAssociation does not affect other devices sharing the same target', () => {
  const { Store, Schema } = freshGlobals();
  const deviceA = Store.addDevice();
  const deviceB = Store.addDevice();
  const app = Store.addEntity('applications');
  const association = findAssociation(Schema, 'devices', 'apps');
  Store.toggleAssociation(association, deviceA.id, app.id);
  const a = Store.document.value.devices.find((d) => d.id === deviceA.id);
  const b = Store.document.value.devices.find((d) => d.id === deviceB.id);
  assert.deepEqual(a.apps, [app.id]);
  assert.deepEqual(b.apps, []);
});

test('device.lizenzen and user.lizenzen each toggle independently against licenses', () => {
  const { Store, Schema } = freshGlobals();
  const device = Store.addDevice();
  const user = Store.addEntity('users');
  const license = Store.addEntity('licenses');
  const deviceLicenses = findAssociation(Schema, 'devices', 'lizenzen');
  const userLicenses = findAssociation(Schema, 'users', 'lizenzen');
  Store.toggleAssociation(deviceLicenses, device.id, license.id);
  Store.toggleAssociation(userLicenses, user.id, license.id);
  const updatedDevice = Store.document.value.devices.find((d) => d.id === device.id);
  const updatedUser = Store.document.value.users.find((u) => u.id === user.id);
  assert.deepEqual(updatedDevice.lizenzen, [license.id]);
  assert.deepEqual(updatedUser.lizenzen, [license.id]);
});

test('reverse lookup: an application finds the devices that reference it via apps', () => {
  const { Store, Schema } = freshGlobals();
  const device = Store.addDevice();
  const app = Store.addEntity('applications');
  const association = findAssociation(Schema, 'devices', 'apps');
  Store.toggleAssociation(association, device.id, app.id);
  const referencingDevices = Store.document.value.devices.filter((d) => (d.apps || []).includes(app.id));
  assert.equal(referencingDevices.length, 1);
  assert.equal(referencingDevices[0].id, device.id);
});

test('addEntityAssociated creates a new entity in the target collection and associates it with the owner', () => {
  const { Store, Schema } = freshGlobals();
  const device = Store.addDevice();
  const association = findAssociation(Schema, 'devices', 'lizenzen');
  const license = Store.addEntityAssociated(association, device.id, { product: 'Office' });
  assert.equal(Store.document.value.licenses.length, 1);
  assert.equal(license.product, 'Office');
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.deepEqual(updated.lizenzen, [license.id]);
});

test('addEntity creates devices and users with empty association arrays by default', () => {
  const { Store } = freshGlobals();
  const device = Store.addDevice();
  const user = Store.addEntity('users');
  assert.deepEqual(device.users, []);
  assert.deepEqual(device.apps, []);
  assert.deepEqual(device.lizenzen, []);
  assert.deepEqual(user.lizenzen, []);
});

test('toggleAssociation on the reverse direction (checking an unassociated owner) adds the association', () => {
  const { Store, Schema } = freshGlobals();
  const device = Store.addDevice();
  const user = Store.addEntity('users');
  const association = findAssociation(Schema, 'devices', 'users');
  // Simulates checking a box in the reverse checklist on the user's detail view:
  // the owner (device) is not yet associated with the target (user).
  const beforeDevice = Store.document.value.devices.find((d) => d.id === device.id);
  assert.deepEqual(beforeDevice.users, []);
  Store.toggleAssociation(association, device.id, user.id);
  const afterDevice = Store.document.value.devices.find((d) => d.id === device.id);
  assert.deepEqual(afterDevice.users, [user.id]);
});
