import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as Store from '../src/lib/store.ts';
import * as Schema from '../src/lib/schema.ts';
import type { CollectionKey } from '../src/lib/schema.ts';

beforeEach(() => {
  Store.document.value = Schema.emptyDocument();
  Store.revision.value = 0;
  Store.lastSavedRevision.value = 0;
  Store.selectedKey.value = 'customer';
  Store.filename.value = null;
});

const COLLECTIONS: CollectionKey[] = ['users', 'network', 'applications', 'licenses', 'locations', 'mailboxes'];

for (const collectionKey of COLLECTIONS) {
  test(`addEntity adds a ${collectionKey} entity with an id and bumps revision`, () => {
    const before = Store.revision.value;
    const entity = Store.addEntity(collectionKey);
    assert.equal(Store.document.value[collectionKey].length, 1);
    assert.equal(Store.document.value[collectionKey][0], entity);
    assert.ok(typeof entity.id === 'string' && entity.id.length === 8);
    assert.equal(Store.revision.value, before + 1);
    assert.equal(Store.dirty.value, true);
  });

  test(`updateEntity patches an existing ${collectionKey} entity by id and bumps revision`, () => {
    const entity = Store.addEntity(collectionKey);
    const before = Store.revision.value;
    Store.updateEntity(collectionKey, entity.id as string, { name: 'Updated' });
    const updated = Store.document.value[collectionKey].find((e) => e.id === entity.id);
    assert.equal(updated?.name, 'Updated');
    assert.equal(Store.revision.value, before + 1);
    assert.equal(Store.dirty.value, true);
  });

  test(`deleteEntity removes the ${collectionKey} entity, clears selection, and bumps revision`, () => {
    const entity = Store.addEntity(collectionKey);
    Store.selectedKey.value = collectionKey + ':' + entity.id;
    const before = Store.revision.value;
    Store.deleteEntity(collectionKey, entity.id as string);
    assert.equal(Store.document.value[collectionKey].length, 0);
    assert.equal(Store.revision.value, before + 1);
    assert.equal(Store.dirty.value, true);
    assert.equal(Store.selectedKey.value, collectionKey);
  });
}

test('addEntity creates entities with empty default fields matching the schema', () => {
  for (const collectionKey of COLLECTIONS) {
    const entity = Store.addEntity(collectionKey);
    for (const field of Schema.COLLECTION_FIELDS[collectionKey]) {
      assert.equal(entity[field.key], '', `${collectionKey}.${field.key} should default to ''`);
    }
  }
});

test('addMonitorForDevice creates a monitor linked to the device via the device ref field', () => {
  const device = Store.addDevice();
  const before = Store.revision.value;
  const monitor = Store.addMonitorForDevice(device.id as string);
  assert.equal(Store.document.value.monitors.length, 1);
  assert.equal(monitor.device, device.id);
  assert.equal(Store.revision.value, before + 1);
  assert.equal(Store.dirty.value, true);
});

test('a device can have multiple monitors, each linked back to it', () => {
  const deviceA = Store.addDevice();
  const deviceB = Store.addDevice();
  const monitor1 = Store.addMonitorForDevice(deviceA.id as string);
  const monitor2 = Store.addMonitorForDevice(deviceA.id as string);
  const monitor3 = Store.addMonitorForDevice(deviceB.id as string);

  const monitorsForA = Store.document.value.monitors.filter((m) => m.device === deviceA.id);
  assert.equal(monitorsForA.length, 2);
  assert.ok(monitorsForA.some((m) => m.id === monitor1.id));
  assert.ok(monitorsForA.some((m) => m.id === monitor2.id));

  const monitorsForB = Store.document.value.monitors.filter((m) => m.device === deviceB.id);
  assert.equal(monitorsForB.length, 1);
  assert.equal(monitorsForB[0].id, monitor3.id);
});

test('deleting a monitor does not affect its device', () => {
  const device = Store.addDevice();
  const monitor = Store.addMonitorForDevice(device.id as string);
  Store.deleteEntity('monitors', monitor.id as string);
  assert.equal(Store.document.value.monitors.length, 0);
  assert.equal(Store.document.value.devices.length, 1);
});

test('device location ref field resolves against real Locations data by id', () => {
  const location = Store.addEntity('locations', { name: 'Main Office' });
  const device = Store.addDevice();
  Store.updateDevice(device.id as string, { location: location.id });
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  assert.equal(updated?.location, location.id);
  const resolved = Store.document.value.locations.find((loc) => loc.id === updated?.location);
  assert.equal(resolved?.name, 'Main Office');
});

test('device switch ref field resolves against real Network data by id', () => {
  const switchDevice = Store.addEntity('network', { name: 'Core Switch' });
  const device = Store.addDevice();
  Store.updateDevice(device.id as string, { switch: switchDevice.id });
  const updated = Store.document.value.devices.find((d) => d.id === device.id);
  const resolved = Store.document.value.network.find((n) => n.id === updated?.switch);
  assert.equal(resolved?.name, 'Core Switch');
});

test('addOwnerAssociated creates an owner that already links to the target', () => {
  const license = Store.addEntity('licenses');
  const association = Schema.ASSOCIATIONS.find(
    (a) => a.ownerCollection === 'devices' && a.targetCollection === 'licenses',
  ) as Schema.Association;
  const device = Store.addOwnerAssociated(association, license.id as string);
  assert.equal(Store.document.value.devices.length, 1);
  assert.deepEqual(Store.document.value.devices.find((d) => d.id === device.id)?.[association.fieldKey], [license.id]);
});

test('deleteEntity removes the deleted id from other entities\' association lists', () => {
  const license = Store.addEntity('licenses');
  const keep = Store.addEntity('licenses');
  const [deviceAssoc, userAssoc] = ['devices', 'users'].map(
    (owner) =>
      Schema.ASSOCIATIONS.find(
        (a) => a.ownerCollection === owner && a.targetCollection === 'licenses',
      ) as Schema.Association,
  );
  const device = Store.addEntity('devices');
  const user = Store.addEntity('users');
  [license, keep].forEach((l) => {
    Store.toggleAssociation(deviceAssoc, device.id as string, l.id as string);
    Store.toggleAssociation(userAssoc, user.id as string, l.id as string);
  });
  Store.deleteEntity('licenses', license.id as string);
  assert.deepEqual(Store.document.value.devices[0].lizenzen, [keep.id]);
  assert.deepEqual(Store.document.value.users[0].lizenzen, [keep.id]);
});

test('entityLinks reports incoming and outgoing links, ignoring empty ones', () => {
  const license = Store.addEntity('licenses');
  const device = Store.addEntity('devices');
  const assoc = Schema.ASSOCIATIONS.find(
    (a) => a.ownerCollection === 'devices' && a.targetCollection === 'licenses',
  ) as Schema.Association;
  assert.deepEqual(Store.entityLinks('licenses', license.id as string), []);
  assert.deepEqual(Store.entityLinks('devices', device.id as string), []);
  Store.toggleAssociation(assoc, device.id as string, license.id as string);
  assert.deepEqual(Store.entityLinks('licenses', license.id as string), [{ label: 'Devices', count: 1 }]);
  assert.deepEqual(Store.entityLinks('devices', device.id as string), [{ label: 'Licenses', count: 1 }]);
});
