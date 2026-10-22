(function (global) {
  'use strict';

  var Schema = global.Schema;

  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, '_');
  }

  function suggestFilename(doc) {
    var customerName = (doc.customer && doc.customer.name) || '';
    var base = customerName.trim() ? customerName : 'Kunde';
    return 'Bestandsaufnahme ' + sanitizeFilename(base) + '.bestand';
  }

  function serializeDocument(doc) {
    return JSON.stringify(doc, null, 2);
  }

  function parseDocument(json) {
    var parsed;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      throw new Error('File is not valid JSON.');
    }
    if (!parsed || parsed.format !== Schema.FORMAT) {
      throw new Error('File is not a recognized inventory document.');
    }
    return parsed;
  }

  global.FileIO = {
    sanitizeFilename: sanitizeFilename,
    suggestFilename: suggestFilename,
    serializeDocument: serializeDocument,
    parseDocument: parseDocument,
  };
})(typeof window !== 'undefined' ? window : globalThis);
