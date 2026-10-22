(function (global) {
  'use strict';

  var signal = global.preactSignalsCore.signal;
  var computed = global.preactSignalsCore.computed;
  var Schema = global.Schema;

  var document = signal(Schema.emptyDocument());
  var revision = signal(0);
  var lastSavedRevision = signal(0);
  var dirty = computed(function () {
    return revision.value !== lastSavedRevision.value;
  });

  var selectedKey = signal('customer');

  function bumpRevision() {
    revision.value = revision.value + 1;
  }

  function markSaved() {
    lastSavedRevision.value = revision.value;
  }

  function resetDocument() {
    document.value = Schema.emptyDocument();
    revision.value = 0;
    lastSavedRevision.value = 0;
    selectedKey.value = 'customer';
  }

  function updateCustomer(patch) {
    document.value = Object.assign({}, document.value, {
      customer: Object.assign({}, document.value.customer, patch),
    });
    bumpRevision();
  }

  function addEntity(collectionKey, overrides) {
    var entity = Object.assign({ id: Schema.makeId() }, Schema.emptyEntity(collectionKey), overrides || {});
    var patch = {};
    patch[collectionKey] = document.value[collectionKey].concat([entity]);
    document.value = Object.assign({}, document.value, patch);
    bumpRevision();
    return entity;
  }

  function updateEntity(collectionKey, id, patch) {
    var collectionPatch = {};
    collectionPatch[collectionKey] = document.value[collectionKey].map(function (entity) {
      return entity.id === id ? Object.assign({}, entity, patch) : entity;
    });
    document.value = Object.assign({}, document.value, collectionPatch);
    bumpRevision();
  }

  function deleteEntity(collectionKey, id) {
    var collectionPatch = {};
    collectionPatch[collectionKey] = document.value[collectionKey].filter(function (entity) {
      return entity.id !== id;
    });
    document.value = Object.assign({}, document.value, collectionPatch);
    if (selectedKey.value === collectionKey + ':' + id) {
      selectedKey.value = collectionKey;
    }
    bumpRevision();
  }

  function addDevice() {
    return addEntity('devices');
  }

  function clearDeviceFromPort(networkId, port, exceptDeviceId) {
    document.value.devices.forEach(function (device) {
      if (device.id !== exceptDeviceId && device.switch === networkId && device.port === String(port)) {
        updateEntity('devices', device.id, { switch: '', port: '' });
      }
    });
  }

  function updateDevice(id, patch) {
    updateEntity('devices', id, patch);
  }

  function getPortInfo(networkId, port) {
    var all = document.value.portInfo[networkId];
    return (all && all[String(port)]) || {};
  }

  function setPortInfo(networkId, port, patch) {
    var networkPortInfo = Object.assign({}, document.value.portInfo[networkId]);
    networkPortInfo[String(port)] = Object.assign({}, networkPortInfo[String(port)], patch);
    var portInfoPatch = Object.assign({}, document.value.portInfo);
    portInfoPatch[networkId] = networkPortInfo;
    document.value = Object.assign({}, document.value, { portInfo: portInfoPatch });
    bumpRevision();
  }

  function assignDevicePort(networkId, port, deviceId) {
    clearDeviceFromPort(networkId, port, deviceId || null);
    if (deviceId) {
      updateEntity('devices', deviceId, { switch: networkId, port: String(port) });
    }
  }

  function getPortsForNetwork(networkId) {
    var devicesOnNetwork = document.value.devices.filter(function (device) {
      return device.switch === networkId;
    });
    var maxPortFromDevices = devicesOnNetwork.reduce(function (max, device) {
      return Math.max(max, parseInt(device.port, 10) || 0);
    }, 0);
    var network = document.value.network.find(function (n) {
      return n.id === networkId;
    });
    var portCount = Math.max(parseInt((network && network.portCount) || '0', 10) || 0, maxPortFromDevices);

    var rows = [];
    for (var p = 1; p <= portCount; p++) {
      rows.push(getPortRow(networkId, p, devicesOnNetwork));
    }
    return rows;
  }

  function getPortRow(networkId, port, devicesOnNetwork) {
    var candidates = devicesOnNetwork || document.value.devices.filter(function (device) {
      return device.switch === networkId;
    });
    var device = candidates.find(function (d) {
      return d.port === String(port);
    });
    return { port: port, device: device || null, info: getPortInfo(networkId, port) };
  }

  function deleteDevice(id) {
    deleteEntity('devices', id);
  }

  function addMonitorForDevice(deviceId) {
    return addEntity('monitors', { device: deviceId });
  }

  function toggleAssociation(association, ownerId, targetId) {
    var owner = document.value[association.ownerCollection].find(function (entity) {
      return entity.id === ownerId;
    });
    var current = owner[association.fieldKey] || [];
    var next = current.includes(targetId)
      ? current.filter(function (id) {
          return id !== targetId;
        })
      : current.concat([targetId]);
    var patch = {};
    patch[association.fieldKey] = next;
    updateEntity(association.ownerCollection, ownerId, patch);
  }

  function addEntityAssociated(association, ownerId, overrides) {
    var entity = addEntity(association.targetCollection, overrides);
    toggleAssociation(association, ownerId, entity.id);
    return entity;
  }

  global.Store = {
    document: document,
    revision: revision,
    lastSavedRevision: lastSavedRevision,
    dirty: dirty,
    selectedKey: selectedKey,
    bumpRevision: bumpRevision,
    markSaved: markSaved,
    resetDocument: resetDocument,
    updateCustomer: updateCustomer,
    addEntity: addEntity,
    updateEntity: updateEntity,
    deleteEntity: deleteEntity,
    addDevice: addDevice,
    updateDevice: updateDevice,
    deleteDevice: deleteDevice,
    addMonitorForDevice: addMonitorForDevice,
    toggleAssociation: toggleAssociation,
    addEntityAssociated: addEntityAssociated,
    getPortInfo: getPortInfo,
    setPortInfo: setPortInfo,
    assignDevicePort: assignDevicePort,
    getPortsForNetwork: getPortsForNetwork,
    getPortRow: getPortRow,
  };
})(typeof window !== 'undefined' ? window : globalThis);
