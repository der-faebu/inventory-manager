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

  function addDevice() {
    var device = Object.assign({ id: Schema.makeId() }, Schema.emptyDevice());
    document.value = Object.assign({}, document.value, {
      devices: document.value.devices.concat([device]),
    });
    bumpRevision();
    return device;
  }

  function updateDevice(id, patch) {
    document.value = Object.assign({}, document.value, {
      devices: document.value.devices.map(function (device) {
        return device.id === id ? Object.assign({}, device, patch) : device;
      }),
    });
    bumpRevision();
  }

  function deleteDevice(id) {
    document.value = Object.assign({}, document.value, {
      devices: document.value.devices.filter(function (device) {
        return device.id !== id;
      }),
    });
    if (selectedKey.value === 'devices:' + id) {
      selectedKey.value = 'devices';
    }
    bumpRevision();
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
    addDevice: addDevice,
    updateDevice: updateDevice,
    deleteDevice: deleteDevice,
  };
})(typeof window !== 'undefined' ? window : globalThis);
