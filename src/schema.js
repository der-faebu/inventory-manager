(function (global) {
  'use strict';

  var TREE_ORDER = [
    'devices',
    'users',
    'network',
    'applications',
    'licenses',
    'locations',
    'mailboxes',
  ];

  var COLLECTIONS = {
    devices: { one: 'Device', many: 'Devices', icon: 'pc', hidden: false },
    users: { one: 'User', many: 'Users', icon: 'user', hidden: false },
    network: { one: 'Network component', many: 'Network', icon: 'net', hidden: false },
    applications: { one: 'Application', many: 'Applications', icon: 'app', hidden: false },
    licenses: { one: 'License', many: 'Licenses', icon: 'lic', hidden: false },
    locations: { one: 'Location', many: 'Locations', icon: 'site', hidden: false },
    mailboxes: { one: 'Mailbox', many: 'Mailboxes', icon: 'mail', hidden: false },
    monitors: { one: 'Monitor', many: 'Monitors', icon: 'mon', hidden: true },
  };

  var ALL_COLLECTION_KEYS = [
    'devices',
    'users',
    'network',
    'applications',
    'licenses',
    'locations',
    'mailboxes',
    'monitors',
  ];

  var CUSTOMER_FIELDS = [
    { key: 'name', label: 'Customer' },
    { key: 'number', label: 'Customer no.' },
    { key: 'contact', label: 'Main contact' },
    { key: 'date', label: 'Inventory date' },
    { key: 'takenBy', label: 'Taken by' },
    { key: 'version', label: 'Version' },
  ];

  var FORMAT = 'inventory-manager-1';

  var DEVICE_TYPES = ['NUC', 'Laptop', 'PC', 'Thin Client', 'Server', 'Printer', 'Other'];
  var CONDITION = ['good', 'fair', 'replace'];
  var NETWORK_CATEGORIES = ['Switch', 'Router', 'Firewall', 'Access Point', 'Other'];
  var YES_NO = ['Yes', 'No'];
  var MAILBOX_TYPES = ['Shared Mailbox', 'Resource', 'Distribution List'];
  var MAILBOX_HOSTING = ['M365', 'Exchange', 'Other'];

  var DEVICE_FIELDS = [
    { key: 'name', label: 'Device name', type: 'text' },
    { key: 'type', label: 'Type', type: 'select', options: DEVICE_TYPES },
    { key: 'model', label: 'Manufacturer / Model', type: 'text' },
    { key: 'serialNumber', label: 'Serial number', type: 'text' },
    { key: 'ip', label: 'IP address', type: 'text' },
    { key: 'mac', label: 'MAC address', type: 'text' },
    { key: 'location', label: 'Location', type: 'ref', collection: 'locations' },
    { key: 'room', label: 'Room', type: 'text' },
    { key: 'deliveryDate', label: 'Delivery date (DD.MM.YYYY)', type: 'text' },
    { key: 'warrantyUntil', label: 'Warranty until (DD.MM.YYYY)', type: 'text' },
    { key: 'condition', label: 'Condition', type: 'select', options: CONDITION },
    { key: 'switch', label: 'Switch', type: 'ref', collection: 'network' },
    { key: 'port', label: 'Switch port', type: 'text' },
    { key: 'remark', label: 'Remark', type: 'text' },
  ];

  var USER_FIELDS = [
    { key: 'name', label: 'Name (Last name First name)', type: 'text' },
    { key: 'login', label: 'Username', type: 'text' },
    { key: 'department', label: 'Department', type: 'text' },
    { key: 'role', label: 'Role', type: 'text' },
    { key: 'email', label: 'Email', type: 'text' },
    { key: 'mfa', label: 'MFA', type: 'select', options: YES_NO },
    { key: 'admin', label: 'Admin rights', type: 'select', options: YES_NO },
    { key: 'remark', label: 'Remark', type: 'text' },
  ];

  var NETWORK_FIELDS = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'category', label: 'Category', type: 'select', options: NETWORK_CATEGORIES },
    { key: 'model', label: 'Manufacturer / Model', type: 'text' },
    { key: 'serialNumber', label: 'Serial number', type: 'text' },
    { key: 'ip', label: 'IP address', type: 'text' },
    { key: 'mac', label: 'MAC address', type: 'text' },
    { key: 'firmware', label: 'Firmware', type: 'text' },
    { key: 'location', label: 'Location', type: 'ref', collection: 'locations' },
    { key: 'rack', label: 'Room / Rack', type: 'text' },
    { key: 'portCount', label: 'Total ports', type: 'text' },
    { key: 'uplink', label: 'Uplink to', type: 'text' },
    { key: 'supportUntil', label: 'Warranty / Support until', type: 'text' },
    { key: 'remark', label: 'Remark', type: 'text' },
  ];

  var APPLICATION_FIELDS = [
    { key: 'name', label: 'Application', type: 'text' },
    { key: 'version', label: 'Version', type: 'text' },
    { key: 'vendor', label: 'Vendor', type: 'text' },
    { key: 'licenseType', label: 'License type', type: 'text' },
    { key: 'businessCritical', label: 'Business-critical', type: 'select', options: YES_NO },
  ];

  var LICENSE_FIELDS = [
    { key: 'product', label: 'License type / Product', type: 'text' },
    { key: 'licenseType', label: 'License type', type: 'text' },
    { key: 'purchasedCount', label: 'Purchased (count)', type: 'text' },
    { key: 'term', label: 'Term / Renewal', type: 'text' },
    { key: 'remark', label: 'Remark', type: 'text' },
  ];

  var LOCATION_FIELDS = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'rooms', label: 'Rooms', type: 'text' },
    { key: 'contact', label: 'Contact / Phone / Email', type: 'text' },
    { key: 'serverRoom', label: 'Server room / Rack', type: 'text' },
  ];

  var MAILBOX_FIELDS = [
    { key: 'address', label: 'Email address', type: 'text' },
    { key: 'type', label: 'Type', type: 'select', options: MAILBOX_TYPES },
    { key: 'owner', label: 'Owner', type: 'text' },
    { key: 'hosting', label: 'Hosting', type: 'select', options: MAILBOX_HOSTING },
  ];

  var MONITOR_FIELDS = [
    { key: 'inventoryNumber', label: 'Inventory no.', type: 'text' },
    { key: 'model', label: 'Manufacturer / Model', type: 'text' },
    { key: 'serialNumber', label: 'Serial number', type: 'text' },
    { key: 'connector', label: 'Connector', type: 'text' },
    { key: 'device', label: 'Connected to', type: 'ref', collection: 'devices' },
  ];

  var COLLECTION_FIELDS = {
    devices: DEVICE_FIELDS,
    users: USER_FIELDS,
    network: NETWORK_FIELDS,
    applications: APPLICATION_FIELDS,
    licenses: LICENSE_FIELDS,
    locations: LOCATION_FIELDS,
    mailboxes: MAILBOX_FIELDS,
    monitors: MONITOR_FIELDS,
  };

  function emptyEntity(collectionKey) {
    var entity = {};
    COLLECTION_FIELDS[collectionKey].forEach(function (field) {
      entity[field.key] = '';
    });
    return entity;
  }

  function makeId() {
    return global.crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }

  function emptyCustomer() {
    return {
      name: '',
      number: '',
      contact: '',
      date: '',
      takenBy: '',
      version: '',
    };
  }

  function emptyDocument() {
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
      mailboxes: [],
      monitors: [],
    };
  }

  global.Schema = {
    FORMAT: FORMAT,
    ALL_COLLECTION_KEYS: ALL_COLLECTION_KEYS,
    TREE_ORDER: TREE_ORDER,
    COLLECTIONS: COLLECTIONS,
    CUSTOMER_FIELDS: CUSTOMER_FIELDS,
    DEVICE_TYPES: DEVICE_TYPES,
    CONDITION: CONDITION,
    NETWORK_CATEGORIES: NETWORK_CATEGORIES,
    YES_NO: YES_NO,
    MAILBOX_TYPES: MAILBOX_TYPES,
    MAILBOX_HOSTING: MAILBOX_HOSTING,
    DEVICE_FIELDS: DEVICE_FIELDS,
    USER_FIELDS: USER_FIELDS,
    NETWORK_FIELDS: NETWORK_FIELDS,
    APPLICATION_FIELDS: APPLICATION_FIELDS,
    LICENSE_FIELDS: LICENSE_FIELDS,
    LOCATION_FIELDS: LOCATION_FIELDS,
    MAILBOX_FIELDS: MAILBOX_FIELDS,
    MONITOR_FIELDS: MONITOR_FIELDS,
    COLLECTION_FIELDS: COLLECTION_FIELDS,
    emptyDocument: emptyDocument,
    emptyCustomer: emptyCustomer,
    emptyEntity: emptyEntity,
    makeId: makeId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
