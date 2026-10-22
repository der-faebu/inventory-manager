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

  function emptyDevice() {
    var device = {};
    DEVICE_FIELDS.forEach(function (field) {
      device[field.key] = '';
    });
    return device;
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
    DEVICE_FIELDS: DEVICE_FIELDS,
    emptyDocument: emptyDocument,
    emptyCustomer: emptyCustomer,
    emptyDevice: emptyDevice,
    makeId: makeId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
