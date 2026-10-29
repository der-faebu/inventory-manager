import * as Schema from './schema.ts';
import type { CollectionKey, Document, Entity, PortInfo } from './schema.ts';

const YES_NO_MAP: Record<string, string> = { Ja: 'Yes', Nein: 'No' };
const CONDITION_MAP: Record<string, string> = { gut: 'good', mittel: 'fair', ersetzen: 'replace' };
const DEVICE_TYPE_MAP: Record<string, string> = {
  NUC: 'NUC',
  Notebook: 'Laptop',
  PC: 'PC',
  'Thin Client': 'Thin Client',
  Server: 'Server',
  Drucker: 'Printer',
  Andere: 'Other',
  'Desktop-PC': 'PC',
};
const NETWORK_CATEGORY_MAP: Record<string, string> = {
  Switch: 'Switch',
  Router: 'Router',
  Firewall: 'Firewall',
  'Access Point': 'Access Point',
  Andere: 'Other',
};
const MAILBOX_TYPE_MAP: Record<string, string> = {
  'Shared Mailbox': 'Shared Mailbox',
  Ressource: 'Resource',
  Verteilerliste: 'Distribution List',
};
const MAILBOX_HOSTING_MAP: Record<string, string> = { M365: 'M365', Exchange: 'Exchange', andere: 'Other' };
const PORT_STATUS_MAP: Record<string, string> = { defekt: 'faulty' };

function mapEnum(map: Record<string, string>, value: unknown): unknown {
  if (value === undefined || value === null || value === '') {
    return value;
  }
  return Object.prototype.hasOwnProperty.call(map, value as string) ? map[value as string] : value;
}

type FieldMapEntry = [legacyKey: string, newKey: string, enumMap?: Record<string, string>];

// Each field entry: [legacyKey, newKey, optional enum map]
const CUSTOMER_FIELD_MAP: FieldMapEntry[] = [
  ['name', 'name'],
  ['nr', 'number'],
  ['kontakt', 'contact'],
  ['datum', 'date'],
  ['durch', 'takenBy'],
  ['version', 'version'],
];

const DEVICE_FIELD_MAP: FieldMapEntry[] = [
  ['name', 'name'],
  ['typ', 'type', DEVICE_TYPE_MAP],
  ['modell', 'model'],
  ['sn', 'serialNumber'],
  ['ip', 'ip'],
  ['mac', 'mac'],
  ['standort', 'location'],
  ['raum', 'room'], // remapped to a room id by resolveRooms after migration
  ['lieferdatum', 'deliveryDate'],
  ['garantie', 'warrantyUntil'],
  ['zustand', 'condition', CONDITION_MAP],
  ['switch', 'switch'],
  ['port', 'port'],
  ['bemerkung', 'remark'],
  ['benutzer', 'users'],
  ['apps', 'apps'],
  ['lizenzen', 'lizenzen'],
];

const USER_FIELD_MAP: FieldMapEntry[] = [
  ['name', 'name'],
  ['login', 'login'],
  ['abteilung', 'department'],
  ['funktion', 'role'],
  ['email', 'email'],
  ['mfa', 'mfa', YES_NO_MAP],
  ['admin', 'admin', YES_NO_MAP],
  ['bemerkung', 'remark'],
  ['lizenzen', 'lizenzen'],
];

const NETWORK_FIELD_MAP: FieldMapEntry[] = [
  ['name', 'name'],
  ['kategorie', 'category', NETWORK_CATEGORY_MAP],
  ['modell', 'model'],
  ['sn', 'serialNumber'],
  ['ip', 'ip'],
  ['mac', 'mac'],
  ['firmware', 'firmware'],
  ['standort', 'location'],
  ['rack', 'rack'],
  ['ports', 'portCount'],
  ['uplink', 'uplink'],
  ['support', 'supportUntil'],
  ['bemerkung', 'remark'],
];

const APPLICATION_FIELD_MAP: FieldMapEntry[] = [
  ['name', 'name'],
  ['version', 'version'],
  ['hersteller', 'vendor'],
  ['lizenzart', 'licenseType'],
  ['kritisch', 'businessCritical', YES_NO_MAP],
];

const LICENSE_FIELD_MAP: FieldMapEntry[] = [
  ['produkt', 'product'],
  ['art', 'licenseType'],
  ['gekauft', 'purchasedCount'],
  ['laufzeit', 'term'],
  ['bemerkung', 'remark'],
];

const LOCATION_FIELD_MAP: FieldMapEntry[] = [
  ['name', 'name'],
  ['adresse', 'address'],
  ['raeume', 'rooms'],
  ['kontakt', 'contact'],
  ['serverraum', 'serverRoom'],
];

const MAILBOX_FIELD_MAP: FieldMapEntry[] = [
  ['adresse', 'address'],
  ['typ', 'type', MAILBOX_TYPE_MAP],
  ['besitzer', 'owner'],
  ['hosting', 'hosting', MAILBOX_HOSTING_MAP],
];

const MONITOR_FIELD_MAP: FieldMapEntry[] = [
  ['inv', 'inventoryNumber'],
  ['modell', 'model'],
  ['sn', 'serialNumber'],
  ['anschluss', 'connector'],
  ['geraet', 'device'],
];

const PORT_INFO_FIELD_MAP: FieldMapEntry[] = [
  ['status', 'status', PORT_STATUS_MAP],
  ['dose', 'jack'],
  ['bemerkung', 'remark'],
];
// 'dev' is intentionally dropped: device/port linkage lives on the device's own switch/port fields.
const PORT_INFO_DROPPED_KEYS: Record<string, boolean> = { dev: true };

interface CollectionMigration {
  legacyKey: string;
  newKey: CollectionKey;
  fieldMap: FieldMapEntry[];
  ignoredKeys?: Record<string, boolean>;
  afterMigrate?: (entity: Entity, legacyEntity: Record<string, unknown>) => void;
}

const COLLECTION_MIGRATIONS: CollectionMigration[] = [
  { legacyKey: 'geraete', newKey: 'devices', fieldMap: DEVICE_FIELD_MAP },
  { legacyKey: 'benutzer', newKey: 'users', fieldMap: USER_FIELD_MAP },
  { legacyKey: 'netzwerk', newKey: 'network', fieldMap: NETWORK_FIELD_MAP },
  { legacyKey: 'applikationen', newKey: 'applications', fieldMap: APPLICATION_FIELD_MAP },
  { legacyKey: 'lizenzen', newKey: 'licenses', fieldMap: LICENSE_FIELD_MAP },
  {
    legacyKey: 'standorte',
    newKey: 'locations',
    fieldMap: LOCATION_FIELD_MAP,
    // Quirk-fix: 'kurz' (short name) is not a plain field mapping, it only backfills 'name' when unset.
    ignoredKeys: { kurz: true },
    afterMigrate: (location, legacyLocation) => {
      if (!location.name && legacyLocation.kurz) {
        location.name = legacyLocation.kurz;
      }
    },
  },
  { legacyKey: 'postfaecher', newKey: 'mailboxes', fieldMap: MAILBOX_FIELD_MAP },
  { legacyKey: 'monitore', newKey: 'monitors', fieldMap: MONITOR_FIELD_MAP },
];

export type DocumentFormat = 'current' | 'legacy' | 'rejected';

export function detectFormat(doc: unknown): DocumentFormat {
  if (!doc || typeof doc !== 'object') {
    return 'rejected';
  }
  const record = doc as Record<string, unknown>;
  if (record.format === Schema.FORMAT) {
    return 'current';
  }
  if (Array.isArray(record.geraete) || Array.isArray(record.devices)) {
    return 'legacy';
  }
  return 'rejected';
}

interface MigrateEntityOptions {
  ignoredKeys?: Record<string, boolean>;
  keepId?: boolean;
  omitUndefined?: boolean;
}

// Walks fieldMap over legacyEntity, mapping recognized keys and collecting the rest as unmapped.
function migrateEntity(
  legacyEntity: Record<string, unknown>,
  fieldMap: FieldMapEntry[],
  unmappedFields: string[],
  entityLabel: string,
  options?: MigrateEntityOptions,
): Entity {
  const opts = options || {};
  const mapped: Entity = {};
  const seenLegacyKeys: Record<string, boolean> = Object.assign({}, opts.ignoredKeys);

  fieldMap.forEach(([legacyKey, newKey, enumMap]) => {
    seenLegacyKeys[legacyKey] = true;
    const value = legacyEntity[legacyKey];
    if (opts.omitUndefined && value === undefined) {
      return;
    }
    mapped[newKey] = enumMap ? mapEnum(enumMap, value) : value;
  });

  if (opts.keepId && legacyEntity.id !== undefined) {
    mapped.id = legacyEntity.id as string;
  }

  Object.keys(legacyEntity).forEach((key) => {
    if ((opts.keepId && key === 'id') || seenLegacyKeys[key]) {
      return;
    }
    unmappedFields.push(entityLabel + '.' + key);
  });

  return mapped;
}

function migrateCustomer(legacyCustomer: Record<string, unknown> | undefined, unmappedFields: string[]) {
  const source = legacyCustomer || {};
  return migrateEntity(source, CUSTOMER_FIELD_MAP, unmappedFields, 'customer', { keepId: false }) as unknown as Document['customer'];
}

function migratePortInfo(
  legacyPortInfo: Record<string, Record<string, Record<string, unknown>>> | undefined,
  unmappedFields: string[],
): Record<string, Record<string, PortInfo>> {
  const result: Record<string, Record<string, PortInfo>> = {};
  Object.keys(legacyPortInfo || {}).forEach((networkId) => {
    const ports = (legacyPortInfo as Record<string, Record<string, Record<string, unknown>>>)[networkId];
    const migratedPorts: Record<string, PortInfo> = {};
    Object.keys(ports).forEach((portNumber) => {
      const legacyRecord = ports[portNumber] || {};
      const label = 'portInfo.' + networkId + '.' + portNumber;
      migratedPorts[portNumber] = migrateEntity(legacyRecord, PORT_INFO_FIELD_MAP, unmappedFields, label, {
        ignoredKeys: PORT_INFO_DROPPED_KEYS,
        omitUndefined: true,
      }) as unknown as PortInfo;
    });
    result[networkId] = migratedPorts;
  });
  return result;
}

// Legacy 'raum' was a free-text room name scoped to the device's location. Synthesize a
// rooms entity per distinct (location, name) pair and remap device.room to its new id.
function resolveRooms(document: Document): void {
  const roomIdByKey: Record<string, string> = {};
  document.devices.forEach((device) => {
    const name = device.room as string;
    if (!name) {
      return;
    }
    const key = ((device.location as string) || '') + ' ' + name;
    if (!Object.prototype.hasOwnProperty.call(roomIdByKey, key)) {
      const room = Schema.emptyEntity('rooms');
      room.id = Schema.makeId();
      room.name = name;
      room.location = (device.location as string) || '';
      document.rooms.push(room);
      roomIdByKey[key] = room.id as string;
    }
    device.room = roomIdByKey[key];
  });
}

export interface MigrationResult {
  document: Document;
  unmappedFields: string[];
}

export function migrate(legacyDoc: unknown): MigrationResult {
  const format = detectFormat(legacyDoc);
  if (format !== 'legacy') {
    throw new Error('Document does not match the minimal legacy shape (no geraete/devices array found).');
  }
  const legacy = legacyDoc as Record<string, unknown>;

  const unmappedFields: string[] = [];
  const document = Schema.emptyDocument();
  document.customer = migrateCustomer(legacy.kunde as Record<string, unknown> | undefined, unmappedFields);
  document.portInfo = migratePortInfo(
    legacy.portInfo as Record<string, Record<string, Record<string, unknown>>> | undefined,
    unmappedFields,
  );

  COLLECTION_MIGRATIONS.forEach((collection) => {
    const legacyEntities = (legacy[collection.legacyKey] as Record<string, unknown>[]) || [];
    document[collection.newKey] = legacyEntities.map((legacyEntity, index) => {
      const migrated = migrateEntity(
        legacyEntity,
        collection.fieldMap,
        unmappedFields,
        collection.newKey + '[' + index + ']',
        { ignoredKeys: collection.ignoredKeys, keepId: true },
      );
      if (collection.afterMigrate) {
        collection.afterMigrate(migrated, legacyEntity);
      }
      return migrated;
    });
  });

  resolveRooms(document);

  return { document, unmappedFields };
}
