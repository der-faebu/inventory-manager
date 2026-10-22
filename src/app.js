(function (global) {
  'use strict';

  var preact = global.preact;
  var html = global.htm.bind(preact.h);
  var Schema = global.Schema;
  var Store = global.Store;
  var signalsCore = global.preactSignalsCore;

  var expandedFolders = signalsCore.signal({});

  function toggleFolder(key) {
    var current = expandedFolders.value;
    var isExpanded = current[key] !== false;
    expandedFolders.value = Object.assign({}, current, { [key]: !isExpanded });
  }

  function Tree() {
    var doc = Store.document.value;
    var selected = Store.selectedKey.value;
    var expanded = expandedFolders.value;

    var folderNodes = Schema.TREE_ORDER.map(function (key) {
      var info = Schema.COLLECTIONS[key];
      var count = (doc[key] || []).length;
      var isExpanded = expanded[key] !== false;
      return html`
        <li class="tree-folder">
          <div
            class="tree-node tree-folder-label"
            onClick=${function () {
              toggleFolder(key);
            }}
          >
            <span class="tree-caret">${isExpanded ? '▾' : '▸'}</span>
            <span class="tree-icon" data-icon=${info.icon}></span>
            <span class="tree-label">${info.many}</span>
            <span class="tree-count">${count}</span>
          </div>
        </li>
      `;
    });

    return html`
      <ul class="tree">
        <li
          class=${'tree-node tree-root' + (selected === 'customer' ? ' selected' : '')}
          onClick=${function () {
            Store.selectedKey.value = 'customer';
          }}
        >
          ${doc.customer.name || 'Customer'}
        </li>
        <ul class="tree-children">
          ${folderNodes}
        </ul>
      </ul>
    `;
  }

  function CustomerGrid() {
    var customer = Store.document.value.customer;

    function onChange(fieldKey, value) {
      var patch = {};
      patch[fieldKey] = value;
      Store.updateCustomer(patch);
    }

    return html`
      <div class="detail-grid">
        <h2>Customer</h2>
        <table class="field-grid">
          <tbody>
            ${Schema.CUSTOMER_FIELDS.map(
              (field) => html`
                <tr>
                  <td class="field-label">${field.label}</td>
                  <td class="field-value">
                    <input
                      type="text"
                      value=${customer[field.key] || ''}
                      onInput=${function (e) {
                        onChange(field.key, e.target.value);
                      }}
                    />
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    `;
  }

  function Detail() {
    var selected = Store.selectedKey.value;
    if (selected === 'customer') {
      return html`<${CustomerGrid} />`;
    }
    return html`<div class="detail-grid"><p>Nothing to show yet.</p></div>`;
  }

  function App() {
    return html`
      <div class="app-shell">
        <div class="tree-pane"><${Tree} /></div>
        <div class="detail-pane"><${Detail} /></div>
      </div>
    `;
  }

  function rerender() {
    preact.render(html`<${App} />`, global.document.getElementById('app'));
  }

  signalsCore.effect(function () {
    Store.document.value;
    Store.selectedKey.value;
    expandedFolders.value;
    rerender();
  });
})(typeof window !== 'undefined' ? window : globalThis);
