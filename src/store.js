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

  function updateDevice(id, patch) {
    updateEntity('devices', id, patch);
  }

  function deleteDevice(id) {
    deleteEntity('devices', id);
  }

  function addMonitorForDevice(deviceId) {
    return addEntity('monitors', { device: deviceId });
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
  };
})(typeof window !== 'undefined' ? window : globalThis);
