export const TREE_ORDER = [
  'devices',
  'users',
  'network',
  'applications',
  'licenses',
  'locations',
  'rooms',
  'mailboxes',
] as const;

export type CollectionKey =
  | 'devices'
  | 'users'
  | 'network'
  | 'applications'
  | 'licenses'
  | 'locations'
  | 'rooms'
  | 'mailboxes'
  | 'monitors';

export interface CollectionInfo {
  one: string;
  many: string;
  icon: string;
  hidden: boolean;
}

export const COLLECTIONS: Record<CollectionKey, CollectionInfo> = {
  devices: { one: 'Device', many: 'Devices', icon: 'pc', hidden: false },
  users: { one: 'User', many: 'Users', icon: 'user', hidden: false },
  network: { one: 'Network component', many: 'Network', icon: 'net', hidden: false },
  applications: { one: 'Application', many: 'Applications', icon: 'app', hidden: false },
  licenses: { one: 'License', many: 'Licenses', icon: 'lic', hidden: false },
  locations: { one: 'Location', many: 'Locations', icon: 'site', hidden: false },
  rooms: { one: 'Room', many: 'Rooms', icon: 'room', hidden: false },
  mailboxes: { one: 'Mailbox', many: 'Mailboxes', icon: 'mail', hidden: false },
  monitors: { one: 'Monitor', many: 'Monitors', icon: 'mon', hidden: true },
};

export const ALL_COLLECTION_KEYS: CollectionKey[] = [
  'devices',
  'users',
  'network',
  'applications',
  'licenses',
  'locations',
  'rooms',
  'mailboxes',
  'monitors',
];

export interface CustomerField {
  key: string;
  label: string;
}

export const CUSTOMER_FIELDS: CustomerField[] = [
  { key: 'name', label: 'Customer' },
  { key: 'number', label: 'Customer no.' },
  { key: 'contact', label: 'Main contact' },
  { key: 'date', label: 'Inventory date' },
  { key: 'takenBy', label: 'Taken by' },
  { key: 'version', label: 'Version' },
];

export const FORMAT = 'inventory-manager-1';

export const DEVICE_TYPES = ['NUC', 'Laptop', 'PC', 'Thin Client', 'Server', 'Printer','Sonos', 'Other'];
export const CONDITION = ['good', 'fair', 'replace'];
export const NETWORK_CATEGORIES = ['Switch', 'Router', 'Firewall', 'Access Point', 'Other'];
export const YES_NO = ['Yes', 'No'];
export const MAILBOX_TYPES = ['Shared Mailbox', 'Resource', 'Distribution List'];
export const MAILBOX_HOSTING = ['M365', 'Exchange', 'Other'];
export const MANUAL_PORT_STATUSES = ['faulty'];
export const LICENSE_TYPE = ['perpetual','subscription']

export type FieldType = 'text' | 'select' | 'ip' | 'ref' | 'date';

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  collection?: CollectionKey;
}

export const DEVICE_FIELDS: Field[] = [
  { key: 'name', label: 'Device name', type: 'text' },
  { key: 'type', label: 'Type', type: 'select', options: DEVICE_TYPES },
  { key: 'model', label: 'Manufacturer / Model', type: 'text' },
  { key: 'serialNumber', label: 'Serial number', type: 'text' },
  { key: 'ip', label: 'IP address', type: 'ip' },
  { key: 'mac', label: 'MAC address', type: 'text' },
  { key: 'location', label: 'Location', type: 'ref', collection: 'locations' },
  { key: 'room', label: 'Room', type: 'ref', collection: 'rooms' },
  { key: 'deliveryDate', label: 'Delivery date (YYYY.MM.DD)', type: 'date' },
  { key: 'warrantyUntil', label: 'Warranty until (YYYY.MM.DD)', type: 'date' },
  { key: 'condition', label: 'Condition', type: 'select', options: CONDITION },
  { key: 'switch', label: 'Switch', type: 'ref', collection: 'network' },
  { key: 'port', label: 'Switch port', type: 'text' },
  { key: 'remark', label: 'Remark', type: 'text' },
];

export const USER_FIELDS: Field[] = [
  { key: 'display_name', label: 'Display name', type: 'text' },
  { key: 'first_name', label: 'First Name', type: 'text' },
  { key: 'last_name', label: 'Last Name', type: 'text' },
  { key: 'login', label: 'Username', type: 'text' },
  { key: 'department', label: 'Department', type: 'text' },
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'mfa', label: 'MFA', type: 'select', options: YES_NO },
  { key: 'admin', label: 'Admin rights', type: 'select', options: YES_NO },
  { key: 'remark', label: 'Remark', type: 'text' },
];

export const NETWORK_FIELDS: Field[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: NETWORK_CATEGORIES },
  { key: 'model', label: 'Manufacturer / Model', type: 'text' },
  { key: 'serialNumber', label: 'Serial number', type: 'text' },
  { key: 'ip', label: 'IP address', type: 'ip' },
  { key: 'mac', label: 'MAC address', type: 'text' },
  { key: 'firmware', label: 'Firmware', type: 'text' },
  { key: 'location', label: 'Location', type: 'ref', collection: 'locations' },
  { key: 'rack', label: 'Room / Rack', type: 'text' },
  { key: 'portCount', label: 'Total ports', type: 'text' },
  { key: 'uplink', label: 'Uplink to', type: 'text' },
  { key: 'supportUntil', label: 'Warranty / Support until (YYYY.MM.DD)', type: 'date' },
  { key: 'remark', label: 'Remark', type: 'text' },
];

export const APPLICATION_FIELDS: Field[] = [
  { key: 'name', label: 'Application', type: 'text' },
  { key: 'version', label: 'Version', type: 'text' },
  { key: 'vendor', label: 'Vendor', type: 'text' },
  { key: 'licenseType', label: 'License type', type: 'select',options: LICENSE_TYPE },
  { key: 'businessCritical', label: 'Business-critical', type: 'select', options: YES_NO },
];

export const LICENSE_FIELDS: Field[] = [
  { key: 'product', label: 'License type / Product', type: 'text' },
  { key: 'licenseType', label: 'License type', type: 'select',options: LICENSE_TYPE },
  { key: 'purchasedCount', label: 'Purchased (count)', type: 'text' },
  { key: 'term', label: 'Term / Renewal', type: 'text' },
  { key: 'remark', label: 'Remark', type: 'text' },
];

export const LOCATION_FIELDS: Field[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'rooms', label: 'Rooms', type: 'text' },
  { key: 'contact', label: 'Contact / Phone / Email', type: 'text' },
  { key: 'serverRoom', label: 'Server room / Rack', type: 'text' },
];

export const ROOM_FIELDS: Field[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'location', label: 'Location', type: 'ref', collection: 'locations' },
];

export const MAILBOX_FIELDS: Field[] = [
  { key: 'address', label: 'Email address', type: 'text' },
  { key: 'type', label: 'Type', type: 'select', options: MAILBOX_TYPES },
  { key: 'owner', label: 'Owner', type: 'text' },
  { key: 'hosting', label: 'Hosting', type: 'select', options: MAILBOX_HOSTING },
];

export const MONITOR_FIELDS: Field[] = [
  { key: 'inventoryNumber', label: 'Inventory no.', type: 'text' },
  { key: 'model', label: 'Manufacturer / Model', type: 'text' },
  { key: 'serialNumber', label: 'Serial number', type: 'text' },
  { key: 'connector', label: 'Connector', type: 'text' },
  { key: 'device', label: 'Connected to', type: 'ref', collection: 'devices' },
];

export const COLLECTION_FIELDS: Record<CollectionKey, Field[]> = {
  devices: DEVICE_FIELDS,
  users: USER_FIELDS,
  network: NETWORK_FIELDS,
  applications: APPLICATION_FIELDS,
  licenses: LICENSE_FIELDS,
  locations: LOCATION_FIELDS,
  rooms: ROOM_FIELDS,
  mailboxes: MAILBOX_FIELDS,
  monitors: MONITOR_FIELDS,
};

export interface Association {
  ownerCollection: CollectionKey;
  fieldKey: string;
  targetCollection: CollectionKey;
  label: string;
}

// Each entry: owner holds an array field (fieldKey) of ids into the target collection.
export const ASSOCIATIONS: Association[] = [
  { ownerCollection: 'devices', fieldKey: 'users', targetCollection: 'users', label: 'Users' },
  { ownerCollection: 'devices', fieldKey: 'apps', targetCollection: 'applications', label: 'Applications' },
  { ownerCollection: 'devices', fieldKey: 'lizenzen', targetCollection: 'licenses', label: 'Licenses' },
  { ownerCollection: 'users', fieldKey: 'lizenzen', targetCollection: 'licenses', label: 'Licenses' },
];

export type Entity = Record<string, unknown> & { id?: string };

export function emptyEntity(collectionKey: CollectionKey): Entity {
  const entity: Entity = {};
  COLLECTION_FIELDS[collectionKey].forEach((field) => {
    entity[field.key] = '';
  });
  ASSOCIATIONS.forEach((association) => {
    if (association.ownerCollection === collectionKey) {
      entity[association.fieldKey] = [];
    }
  });
  return entity;
}

// Per-collection title field(s), in fallback order. Default is 'name' when a collection isn't listed.
const TITLE_FIELDS: Partial<Record<CollectionKey, string[]>> = {
  licenses: ['product'],
  mailboxes: ['address'],
  monitors: ['inventoryNumber', 'model'],
};

export function entityLabel(collectionKey: CollectionKey, entity: Entity): string {
  const fields = TITLE_FIELDS[collectionKey] || ['name'];
  for (const field of fields) {
    const value = entity[field];
    if (value) {
      return String(value);
    }
  }
  return '(unnamed)';
}

const DATE_PATTERN = /^\d{4}\.\d{2}\.\d{2}$/;
const IP_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const parts = value.split('.');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function isValidIp(value: string): boolean {
  const match = IP_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  for (let i = 1; i <= 4; i++) {
    if (parseInt(match[i], 10) > 255) {
      return false;
    }
  }
  return true;
}

// Converts a stored YYYY.MM.DD value to the YYYY-MM-DD an <input type="date"> expects.
export function dateToInputValue(value: string): string {
  return isValidDate(value) ? value.replace(/\./g, '-') : '';
}

// Converts an <input type="date"> YYYY-MM-DD value back to the stored YYYY.MM.DD format.
export function dateFromInputValue(value: string): string {
  return value ? value.replace(/-/g, '.') : '';
}

// Returns an error message for the field's value, or '' if valid/empty (fields are optional).
export function fieldError(field: Pick<Field, 'type'>, value: string): string {
  if (!value) {
    return '';
  }
  if (field.type === 'date' && !isValidDate(value)) {
    return 'Expected date format YYYY.MM.DD';
  }
  if (field.type === 'ip' && !isValidIp(value)) {
    return 'Expected a valid IP address, e.g. 192.168.1.1';
  }
  return '';
}

export interface PortInfo {
  jack?: string;
  remark?: string;
  status?: string;
}

export function portStatus(device: Entity | null | undefined, portInfo: PortInfo | null | undefined): string {
  if (device) {
    return 'occupied';
  }
  if (portInfo && portInfo.status === 'faulty') {
    return 'faulty';
  }
  return 'free';
}

export function makeId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export interface Customer {
  name: string;
  number: string;
  contact: string;
  date: string;
  takenBy: string;
  version: string;
}

export function emptyCustomer(): Customer {
  return {
    name: '',
    number: '',
    contact: '',
    date: '',
    takenBy: '',
    version: '',
  };
}

export interface Document {
  format: string;
  customer: Customer;
  portInfo: Record<string, Record<string, PortInfo>>;
  devices: Entity[];
  users: Entity[];
  network: Entity[];
  applications: Entity[];
  licenses: Entity[];
  locations: Entity[];
  rooms: Entity[];
  mailboxes: Entity[];
  monitors: Entity[];
}

export function emptyDocument(): Document {
  return {
    format: FORMAT,
    customer: emptyCustomer(),
    portInfo: {},
    devices: [],
    users: [],
    network: [],
    applications: [],
    licenses: [],
    locations: [],
    rooms: [],
    mailboxes: [],
    monitors: [],
  };
}

// Backfills any collection arrays missing from a document (e.g. one saved before a
// collection was added to the schema), so older saved/autosaved documents keep loading.
export function normalizeDocument(doc: Document | Record<string, unknown>): Document {
  ALL_COLLECTION_KEYS.forEach((key) => {
    if (!Array.isArray(doc[key])) {
      doc[key] = [];
    }
  });
  return doc as unknown as Document;
}
