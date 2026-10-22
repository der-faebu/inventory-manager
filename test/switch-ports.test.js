'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

test('getPortInfo returns an empty object for a port with no stored info', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  assert.deepEqual(Store.getPortInfo(net.id, 1), {});
});

test('setPortInfo stores jack/remark/status for a given network+port and bumps revision', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  const before = Store.revision.value;
  Store.setPortInfo(net.id, 3, { jack: 'A12', remark: 'near window' });
  assert.deepEqual(Store.getPortInfo(net.id, 3), { jack: 'A12', remark: 'near window' });
  assert.equal(Store.revision.value, before + 1);
  assert.equal(Store.dirty.value, true);
});

test('setPortInfo merges into existing port info rather than replacing it', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  Store.setPortInfo(net.id, 3, { jack: 'A12' });
  Store.setPortInfo(net.id, 3, { remark: 'near window' });
  assert.deepEqual(Store.getPortInfo(net.id, 3), { jack: 'A12', remark: 'near window' });
});

test('setPortInfo for one port does not affect another port on the same network', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  Store.setPortInfo(net.id, 1, { jack: 'A1' });
  Store.setPortInfo(net.id, 2, { jack: 'A2' });
  assert.deepEqual(Store.getPortInfo(net.id, 1), { jack: 'A1' });
  assert.deepEqual(Store.getPortInfo(net.id, 2), { jack: 'A2' });
});

test('assignDevicePort sets the device switch/port fields', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  const device = Store.addDevice();
  Store.assignDevicePort(net.id, 5, device.id);
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.equal(updated.switch, net.id);
  assert.equal(updated.port, '5');
});

test('assignDevicePort clears any other device previously on that port', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  const deviceA = Store.addDevice();
  const deviceB = Store.addDevice();
  Store.assignDevicePort(net.id, 5, deviceA.id);
  Store.assignDevicePort(net.id, 5, deviceB.id);
  const a = Store.document.value.devices.find((d) => d.id === deviceA.id);
  const b = Store.document.value.devices.find((d) => d.id === deviceB.id);
  assert.equal(a.switch, '');
  assert.equal(a.port, '');
  assert.equal(b.switch, net.id);
  assert.equal(b.port, '5');
});

test('assignDevicePort with an empty deviceId unassigns the current device from the port', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  const device = Store.addDevice();
  Store.assignDevicePort(net.id, 5, device.id);
  Store.assignDevicePort(net.id, 5, '');
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.equal(updated.switch, '');
  assert.equal(updated.port, '');
});

test('assignDevicePort called from the device side (switch+port both set) clears any other device previously on that port', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  const deviceA = Store.addDevice();
  const deviceB = Store.addDevice();
  Store.assignDevicePort(net.id, 7, deviceA.id);
  Store.assignDevicePort(net.id, 7, deviceB.id);
  const a = Store.document.value.devices.find((d) => d.id === deviceA.id);
  const b = Store.document.value.devices.find((d) => d.id === deviceB.id);
  assert.equal(a.switch, '');
  assert.equal(a.port, '');
  assert.equal(b.switch, net.id);
  assert.equal(b.port, '7');
});

test('assignDevicePort moving a device to a different port does not clear itself from the old port incorrectly', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  const device = Store.addDevice();
  Store.assignDevicePort(net.id, 1, device.id);
  Store.assignDevicePort(net.id, 2, device.id);
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.equal(updated.port, '2');
});

test('getPortsForNetwork returns one row per port up to the network portCount, each with device/status/info', () => {
  const { Store, Schema } = freshGlobals();
  const net = Store.addEntity('network', { portCount: '3' });
  const device = Store.addDevice();
  Store.assignDevicePort(net.id, 2, device.id);
  Store.setPortInfo(net.id, 3, { status: 'faulty' });

  const rows = Store.getPortsForNetwork(net.id);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].port, 1);
  assert.equal(rows[0].device, null);
  assert.equal(Schema.portStatus(rows[0].device, rows[0].info), 'free');

  assert.equal(rows[1].port, 2);
  assert.equal(rows[1].device.id, device.id);
  assert.equal(Schema.portStatus(rows[1].device, rows[1].info), 'occupied');

  assert.equal(rows[2].port, 3);
  assert.equal(rows[2].device, null);
  assert.deepEqual(rows[2].info, { status: 'faulty' });
  assert.equal(Schema.portStatus(rows[2].device, rows[2].info), 'faulty');
});

test('getPortsForNetwork extends beyond portCount when a device references a higher port number', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network', { portCount: '2' });
  const device = Store.addDevice();
  Store.assignDevicePort(net.id, 5, device.id);
  const rows = Store.getPortsForNetwork(net.id);
  assert.equal(rows.length, 5);
  assert.equal(rows[4].device.id, device.id);
});

test('jack on a device is derived from the linked port record, not stored on the device', () => {
  const { Store } = freshGlobals();
  const net = Store.addEntity('network');
  const device = Store.addDevice();
  Store.assignDevicePort(net.id, 4, device.id);
  Store.setPortInfo(net.id, 4, { jack: 'B7' });
  assert.equal(Store.getPortInfo(net.id, 4).jack, 'B7');
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.equal(updated.jack, undefined);
});
