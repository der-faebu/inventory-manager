'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');
const fs = require('fs');
const path = require('path');

function load() {
  const globals = freshGlobals();
  delete globalThis.FileIO;
  delete globalThis.LegacyMigration;
  const fileIoCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'file-io.js'), 'utf8');
  // eslint-disable-next-line no-eval
  (0, eval)(fileIoCode);
  const migrationCode = fs.readFileSync(path.join(__dirname, '..', 'src', 'legacy-migration.js'), 'utf8');
  // eslint-disable-next-line no-eval
  (0, eval)(migrationCode);
  return Object.assign({ FileIO: globalThis.FileIO, LegacyMigration: globalThis.LegacyMigration }, globals);
}

function emptyLegacyDoc() {
  return {
    format: 'bestandsaufnahme-1',
    kunde: {},
    portInfo: {},
    geraete: [],
    benutzer: [],
    netzwerk: [],
    applikationen: [],
    lizenzen: [],
    standorte: [],
    postfaecher: [],
    monitore: [],
  };
}

// --- format detection ---

test('detectFormat identifies current-format documents', () => {
  const { LegacyMigration, Schema } = load();
  const doc = { format: Schema.FORMAT };
  assert.equal(LegacyMigration.detectFormat(doc), 'current');
});

test('detectFormat identifies legacy documents by a geraete array', () => {
  const { LegacyMigration } = load();
  assert.equal(LegacyMigration.detectFormat({ geraete: [] }), 'legacy');
});

test('detectFormat identifies legacy documents by a devices array (post-migration shape without format tag)', () => {
  const { LegacyMigration } = load();
  assert.equal(LegacyMigration.detectFormat({ devices: [] }), 'legacy');
});

test('detectFormat rejects documents with neither a recognized format nor a geraete/devices array', () => {
  const { LegacyMigration } = load();
  assert.equal(LegacyMigration.detectFormat({ foo: 'bar' }), 'rejected');
});

test('detectFormat rejects non-object input', () => {
  const { LegacyMigration } = load();
  assert.equal(LegacyMigration.detectFormat(null), 'rejected');
  assert.equal(LegacyMigration.detectFormat('a string'), 'rejected');
});

// --- customer + top-level ---

test('migrate maps customer fields and sets the new format tag', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.kunde = { name: 'Acme', nr: '123', kontakt: 'Jane', datum: '01.01.2026', durch: 'Bob', version: '1' };

  const result = LegacyMigration.migrate(legacy);

  assert.equal(result.document.format, 'inventory-manager-1');
  assert.deepEqual(result.document.customer, {
    name: 'Acme',
    number: '123',
    contact: 'Jane',
    date: '01.01.2026',
    takenBy: 'Bob',
    version: '1',
  });
});

// --- devices ---

test('migrate maps device fields, enums, and associations', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.geraete = [
    {
      id: 'dev1',
      name: 'PC-1',
      typ: 'Notebook',
      modell: 'Dell XPS',
      sn: 'SN1',
      ip: '10.0.0.1',
      mac: 'AA:BB',
      standort: 'loc1',
      raum: 'R1',
      lieferdatum: '01.01.2020',
      garantie: '01.01.2023',
      zustand: 'gut',
      switch: 'net1',
      port: '3',
      bemerkung: 'note',
      benutzer: ['u1'],
      apps: ['a1'],
      lizenzen: ['l1'],
    },
  ];

  const result = LegacyMigration.migrate(legacy);
  const device = result.document.devices[0];

  assert.equal(device.id, 'dev1');
  assert.equal(device.name, 'PC-1');
  assert.equal(device.type, 'Laptop');
  assert.equal(device.model, 'Dell XPS');
  assert.equal(device.serialNumber, 'SN1');
  assert.equal(device.ip, '10.0.0.1');
  assert.equal(device.mac, 'AA:BB');
  assert.equal(device.location, 'loc1');
  const room = result.document.rooms.find((r) => r.id === device.room);
  assert.ok(room, 'migrated device.room should reference a synthesized room entity');
  assert.equal(room.name, 'R1');
  assert.equal(room.location, 'loc1');
  assert.equal(device.deliveryDate, '01.01.2020');
  assert.equal(device.warrantyUntil, '01.01.2023');
  assert.equal(device.condition, 'good');
  assert.equal(device.switch, 'net1');
  assert.equal(device.port, '3');
  assert.equal(device.remark, 'note');
  assert.deepEqual(device.users, ['u1']);
  assert.deepEqual(device.apps, ['a1']);
  assert.deepEqual(device.lizenzen, ['l1']);
});

test('migrate applies the Desktop-PC quirk-fix on device type', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.geraete = [{ id: 'dev1', typ: 'Desktop-PC' }];

  const result = LegacyMigration.migrate(legacy);

  assert.equal(result.document.devices[0].type, 'PC');
});

test('migrate maps all device condition enum values', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.geraete = [
    { id: 'd1', zustand: 'gut' },
    { id: 'd2', zustand: 'mittel' },
    { id: 'd3', zustand: 'ersetzen' },
  ];

  const result = LegacyMigration.migrate(legacy);

  assert.equal(result.document.devices[0].condition, 'good');
  assert.equal(result.document.devices[1].condition, 'fair');
  assert.equal(result.document.devices[2].condition, 'replace');
});

// --- users ---

test('migrate maps user fields and Ja/Nein enums', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.benutzer = [
    {
      id: 'u1',
      name: 'Doe John',
      login: 'jdoe',
      abteilung: 'IT',
      funktion: 'Admin',
      email: 'j@example.com',
      mfa: 'Ja',
      admin: 'Nein',
      bemerkung: 'note',
      lizenzen: ['l1'],
    },
  ];

  const result = LegacyMigration.migrate(legacy);
  const user = result.document.users[0];

  assert.equal(user.department, 'IT');
  assert.equal(user.role, 'Admin');
  assert.equal(user.mfa, 'Yes');
  assert.equal(user.admin, 'No');
  assert.equal(user.remark, 'note');
  assert.deepEqual(user.lizenzen, ['l1']);
});

// --- network ---

test('migrate maps network fields', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.netzwerk = [
    {
      id: 'n1',
      name: 'Switch-1',
      kategorie: 'Switch',
      modell: 'Cisco X',
      sn: 'SN2',
      ip: '10.0.0.2',
      mac: 'CC:DD',
      firmware: '1.0',
      standort: 'loc1',
      rack: 'Rack 1',
      ports: '24',
      uplink: 'core',
      support: '01.01.2025',
      bemerkung: 'note',
    },
  ];

  const result = LegacyMigration.migrate(legacy);
  const network = result.document.network[0];

  assert.equal(network.category, 'Switch');
  assert.equal(network.rack, 'Rack 1');
  assert.equal(network.portCount, '24');
  assert.equal(network.supportUntil, '01.01.2025');
  assert.equal(network.remark, 'note');
});

// --- applications ---

test('migrate maps application fields', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.applikationen = [
    { id: 'a1', name: 'App1', version: '2.0', hersteller: 'Vendor', lizenzart: 'Subscription', kritisch: 'Ja' },
  ];

  const result = LegacyMigration.migrate(legacy);
  const app = result.document.applications[0];

  assert.equal(app.vendor, 'Vendor');
  assert.equal(app.licenseType, 'Subscription');
  assert.equal(app.businessCritical, 'Yes');
});

// --- licenses ---

test('migrate maps license fields', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.lizenzen = [
    { id: 'l1', produkt: 'Office', art: 'Subscription', gekauft: '10', laufzeit: '1 year', bemerkung: 'note' },
  ];

  const result = LegacyMigration.migrate(legacy);
  const license = result.document.licenses[0];

  assert.equal(license.product, 'Office');
  assert.equal(license.licenseType, 'Subscription');
  assert.equal(license.purchasedCount, '10');
  assert.equal(license.term, '1 year');
  assert.equal(license.remark, 'note');
});

// --- locations ---

test('migrate maps location fields', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.standorte = [
    { id: 's1', name: 'HQ', adresse: 'Main St', raeume: '10', kontakt: 'contact', serverraum: 'Rack A' },
  ];

  const result = LegacyMigration.migrate(legacy);
  const location = result.document.locations[0];

  assert.equal(location.address, 'Main St');
  assert.equal(location.rooms, '10');
  assert.equal(location.contact, 'contact');
  assert.equal(location.serverRoom, 'Rack A');
});

test('migrate applies the kurz->name fallback quirk-fix on locations', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.standorte = [{ id: 's1', kurz: 'HQ Short' }];

  const result = LegacyMigration.migrate(legacy);

  assert.equal(result.document.locations[0].name, 'HQ Short');
});

test('migrate does not override an existing location name with kurz', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.standorte = [{ id: 's1', name: 'HQ', kurz: 'HQ Short' }];

  const result = LegacyMigration.migrate(legacy);

  assert.equal(result.document.locations[0].name, 'HQ');
});

// --- mailboxes ---

test('migrate maps mailbox fields and enums', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.postfaecher = [
    { id: 'm1', adresse: 'info@example.com', typ: 'Ressource', besitzer: 'IT', hosting: 'andere' },
  ];

  const result = LegacyMigration.migrate(legacy);
  const mailbox = result.document.mailboxes[0];

  assert.equal(mailbox.address, 'info@example.com');
  assert.equal(mailbox.type, 'Resource');
  assert.equal(mailbox.owner, 'IT');
  assert.equal(mailbox.hosting, 'Other');
});

test('migrate maps Verteilerliste mailbox type', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.postfaecher = [{ id: 'm1', typ: 'Verteilerliste' }];

  const result = LegacyMigration.migrate(legacy);

  assert.equal(result.document.mailboxes[0].type, 'Distribution List');
});

// --- monitors ---

test('migrate maps monitor fields', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.monitore = [{ id: 'mo1', inv: 'INV1', modell: 'Dell', sn: 'SN3', anschluss: 'HDMI', geraet: 'dev1' }];

  const result = LegacyMigration.migrate(legacy);
  const monitor = result.document.monitors[0];

  assert.equal(monitor.inventoryNumber, 'INV1');
  assert.equal(monitor.connector, 'HDMI');
  assert.equal(monitor.device, 'dev1');
});

// --- portInfo ---

test('migrate maps portInfo record fields and faulty status', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.portInfo = { net1: { 3: { status: 'defekt', dose: 'J1', bemerkung: 'note', dev: 'dev1' } } };

  const result = LegacyMigration.migrate(legacy);
  const record = result.document.portInfo.net1['3'];

  assert.equal(record.status, 'faulty');
  assert.equal(record.jack, 'J1');
  assert.equal(record.remark, 'note');
  assert.equal(record.device, undefined);
});

test('migrate drops the redundant dev field from portInfo without an unmapped-field warning', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.portInfo = { net1: { 1: { dev: 'dev1' } } };

  const result = LegacyMigration.migrate(legacy);

  assert.deepEqual(result.unmappedFields, []);
});

test('migrate leaves an empty portInfo status unset', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.portInfo = { net1: { 1: { dose: 'J1' } } };

  const result = LegacyMigration.migrate(legacy);

  assert.equal(result.document.portInfo.net1['1'].status, undefined);
});

// --- unmapped fields ---

test('migrate collects unmapped stray fields per entity without failing', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.geraete = [{ id: 'dev1', name: 'PC-1', strangeField: 'xyz' }];

  const result = LegacyMigration.migrate(legacy);

  assert.equal(result.document.devices[0].name, 'PC-1');
  assert.ok(result.unmappedFields.some((entry) => entry.includes('strangeField')));
});

test('migrate reports no unmapped fields for a clean legacy document', () => {
  const { LegacyMigration } = load();
  const legacy = emptyLegacyDoc();
  legacy.geraete = [{ id: 'dev1', name: 'PC-1', typ: 'PC' }];

  const result = LegacyMigration.migrate(legacy);

  assert.deepEqual(result.unmappedFields, []);
});

test('migrate rejects documents that fail the minimal shape check', () => {
  const { LegacyMigration } = load();
  assert.throws(() => LegacyMigration.migrate({ foo: 'bar' }));
});

// --- integration with Store, mirroring the Open flow in app.js ---

test('a successful legacy migration loaded into Store ends up dirty with no working filename', () => {
  const { LegacyMigration, Store } = load();
  const legacy = emptyLegacyDoc();
  legacy.kunde = { name: 'Acme' };

  const result = LegacyMigration.migrate(legacy);
  Store.loadDocument(result.document, null);
  Store.bumpRevision();

  assert.equal(Store.document.value.customer.name, 'Acme');
  assert.equal(Store.dirty.value, true);
  assert.equal(Store.filename.value, null);
});

test('detectFormat reports rejected for a document the Open flow must block on, without touching Store', () => {
  const { LegacyMigration, Store } = load();
  const before = Store.document.value;

  const format = LegacyMigration.detectFormat({ foo: 'bar' });

  assert.equal(format, 'rejected');
  assert.equal(Store.document.value, before);
});
