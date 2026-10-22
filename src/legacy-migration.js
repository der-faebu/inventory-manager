(function (global) {
  'use strict';

  var Schema = global.Schema;

  var YES_NO_MAP = { Ja: 'Yes', Nein: 'No' };
  var CONDITION_MAP = { gut: 'good', mittel: 'fair', ersetzen: 'replace' };
  var DEVICE_TYPE_MAP = {
    NUC: 'NUC',
    Notebook: 'Laptop',
    PC: 'PC',
    'Thin Client': 'Thin Client',
    Server: 'Server',
    Drucker: 'Printer',
    Andere: 'Other',
    'Desktop-PC': 'PC',
  };
  var NETWORK_CATEGORY_MAP = {
    Switch: 'Switch',
    Router: 'Router',
    Firewall: 'Firewall',
    'Access Point': 'Access Point',
    Andere: 'Other',
  };
  var MAILBOX_TYPE_MAP = {
    'Shared Mailbox': 'Shared Mailbox',
    Ressource: 'Resource',
    Verteilerliste: 'Distribution List',
  };
  var MAILBOX_HOSTING_MAP = { M365: 'M365', Exchange: 'Exchange', andere: 'Other' };
  var PORT_STATUS_MAP = { defekt: 'faulty' };

  function mapEnum(map, value) {
    if (value === undefined || value === null || value === '') {
      return value;
    }
    return map.hasOwnProperty(value) ? map[value] : value;
  }

  // Each field entry: [legacyKey, newKey, optional enum map]
  var CUSTOMER_FIELD_MAP = [
    ['name', 'name'],
    ['nr', 'number'],
    ['kontakt', 'contact'],
    ['datum', 'date'],
    ['durch', 'takenBy'],
    ['version', 'version'],
  ];

  var DEVICE_FIELD_MAP = [
    ['name', 'name'],
    ['typ', 'type', DEVICE_TYPE_MAP],
    ['modell', 'model'],
    ['sn', 'serialNumber'],
    ['ip', 'ip'],
    ['mac', 'mac'],
    ['standort', 'location'],
    ['raum', 'room'],
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

  var USER_FIELD_MAP = [
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

  var NETWORK_FIELD_MAP = [
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

  var APPLICATION_FIELD_MAP = [
    ['name', 'name'],
    ['version', 'version'],
    ['hersteller', 'vendor'],
    ['lizenzart', 'licenseType'],
    ['kritisch', 'businessCritical', YES_NO_MAP],
  ];

  var LICENSE_FIELD_MAP = [
    ['produkt', 'product'],
    ['art', 'licenseType'],
    ['gekauft', 'purchasedCount'],
    ['laufzeit', 'term'],
    ['bemerkung', 'remark'],
  ];

  var LOCATION_FIELD_MAP = [
    ['name', 'name'],
    ['adresse', 'address'],
    ['raeume', 'rooms'],
    ['kontakt', 'contact'],
    ['serverraum', 'serverRoom'],
  ];

  var MAILBOX_FIELD_MAP = [
    ['adresse', 'address'],
    ['typ', 'type', MAILBOX_TYPE_MAP],
    ['besitzer', 'owner'],
    ['hosting', 'hosting', MAILBOX_HOSTING_MAP],
  ];

  var MONITOR_FIELD_MAP = [
    ['inv', 'inventoryNumber'],
    ['modell', 'model'],
    ['sn', 'serialNumber'],
    ['anschluss', 'connector'],
    ['geraet', 'device'],
  ];

  var PORT_INFO_FIELD_MAP = [
    ['status', 'status', PORT_STATUS_MAP],
    ['dose', 'jack'],
    ['bemerkung', 'remark'],
  ];
  // 'dev' is intentionally dropped: device/port linkage lives on the device's own switch/port fields.
  var PORT_INFO_DROPPED_KEYS = { dev: true };

  var COLLECTION_MIGRATIONS = [
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
      afterMigrate: function (location, legacyLocation) {
        if (!location.name && legacyLocation.kurz) {
          location.name = legacyLocation.kurz;
        }
      },
    },
    { legacyKey: 'postfaecher', newKey: 'mailboxes', fieldMap: MAILBOX_FIELD_MAP },
    { legacyKey: 'monitore', newKey: 'monitors', fieldMap: MONITOR_FIELD_MAP },
  ];

  function detectFormat(doc) {
    if (!doc || typeof doc !== 'object') {
      return 'rejected';
    }
    if (doc.format === Schema.FORMAT) {
      return 'current';
    }
    if (Array.isArray(doc.geraete) || Array.isArray(doc.devices)) {
      return 'legacy';
    }
    return 'rejected';
  }

  // Walks fieldMap over legacyEntity, mapping recognized keys and collecting the rest as unmapped.
  // options: { ignoredKeys, keepId, omitUndefined }
  function migrateEntity(legacyEntity, fieldMap, unmappedFields, entityLabel, options) {
    var opts = options || {};
    var mapped = {};
    var seenLegacyKeys = Object.assign({}, opts.ignoredKeys);

    fieldMap.forEach(function (entry) {
      var legacyKey = entry[0];
      var newKey = entry[1];
      var enumMap = entry[2];
      seenLegacyKeys[legacyKey] = true;
      var value = legacyEntity[legacyKey];
      if (opts.omitUndefined && value === undefined) {
        return;
      }
      mapped[newKey] = enumMap ? mapEnum(enumMap, value) : value;
    });

    if (opts.keepId && legacyEntity.id !== undefined) {
      mapped.id = legacyEntity.id;
    }

    Object.keys(legacyEntity).forEach(function (key) {
      if ((opts.keepId && key === 'id') || seenLegacyKeys[key]) {
        return;
      }
      unmappedFields.push(entityLabel + '.' + key);
    });

    return mapped;
  }

  function migrateCustomer(legacyCustomer, unmappedFields) {
    var source = legacyCustomer || {};
    return migrateEntity(source, CUSTOMER_FIELD_MAP, unmappedFields, 'customer', { keepId: false });
  }

  function migratePortInfo(legacyPortInfo, unmappedFields) {
    var result = {};
    Object.keys(legacyPortInfo || {}).forEach(function (networkId) {
      var ports = legacyPortInfo[networkId];
      var migratedPorts = {};
      Object.keys(ports).forEach(function (portNumber) {
        var legacyRecord = ports[portNumber] || {};
        var label = 'portInfo.' + networkId + '.' + portNumber;
        migratedPorts[portNumber] = migrateEntity(legacyRecord, PORT_INFO_FIELD_MAP, unmappedFields, label, {
          ignoredKeys: PORT_INFO_DROPPED_KEYS,
          omitUndefined: true,
        });
      });
      result[networkId] = migratedPorts;
    });
    return result;
  }

  function migrate(legacyDoc) {
    var format = detectFormat(legacyDoc);
    if (format !== 'legacy') {
      throw new Error('Document does not match the minimal legacy shape (no geraete/devices array found).');
    }

    var unmappedFields = [];
    var document = Schema.emptyDocument();
    document.customer = migrateCustomer(legacyDoc.kunde, unmappedFields);
    document.portInfo = migratePortInfo(legacyDoc.portInfo, unmappedFields);

    COLLECTION_MIGRATIONS.forEach(function (collection) {
      var legacyEntities = legacyDoc[collection.legacyKey] || [];
      document[collection.newKey] = legacyEntities.map(function (legacyEntity, index) {
        var migrated = migrateEntity(legacyEntity, collection.fieldMap, unmappedFields, collection.newKey + '[' + index + ']', {
          ignoredKeys: collection.ignoredKeys,
          keepId: true,
        });
        if (collection.afterMigrate) {
          collection.afterMigrate(migrated, legacyEntity);
        }
        return migrated;
      });
    });

    return { document: document, unmappedFields: unmappedFields };
  }

  global.LegacyMigration = {
    detectFormat: detectFormat,
    migrate: migrate,
  };
})(typeof window !== 'undefined' ? window : globalThis);
