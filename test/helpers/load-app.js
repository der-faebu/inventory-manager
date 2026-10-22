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

function loadXLSX() {
  // lib/xlsx.full.min.js is a UMD build: in a browser <script> tag it attaches to window.XLSX,
  // but under Node's CommonJS it exports via module.exports instead. require() it directly here
  // and mirror the browser's global so code under test can keep reading a plain global.XLSX.
  globalThis.XLSX = require('../../lib/xlsx.full.min.js');
  return globalThis.XLSX;
}

module.exports = { freshGlobals, loadXLSX };
