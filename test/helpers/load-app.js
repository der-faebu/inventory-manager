'use strict';

const fs = require('fs');
const path = require('path');

function loadGlobalScript(relPath) {
  const fullPath = path.join(__dirname, '..', '..', relPath);
  const code = fs.readFileSync(fullPath, 'utf8');
  // eslint-disable-next-line no-eval
  (0, eval)(code);
}

function freshGlobals() {
  delete globalThis.Schema;
  delete globalThis.Store;
  globalThis.preactSignalsCore = require('../../lib/preact-signals-core.js');

  loadGlobalScript('src/schema.js');
  loadGlobalScript('src/store.js');

  return { Schema: globalThis.Schema, Store: globalThis.Store };
}

module.exports = { freshGlobals };
