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
  };
})(typeof window !== 'undefined' ? window : globalThis);
