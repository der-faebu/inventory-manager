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
    emptyDocument: emptyDocument,
    emptyCustomer: emptyCustomer,
  };
})(typeof window !== 'undefined' ? window : globalThis);
