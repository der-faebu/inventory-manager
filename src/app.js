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

  function entityLabel(key, entity) {
    return entity.name || '(unnamed)';
  }

  function Tree() {
    var doc = Store.document.value;
    var selected = Store.selectedKey.value;
    var expanded = expandedFolders.value;

    var folderNodes = Schema.TREE_ORDER.map(function (key) {
      var info = Schema.COLLECTIONS[key];
      var entities = doc[key] || [];
      var isExpanded = expanded[key] !== false;

      var childNodes = isExpanded
        ? entities.map(function (entity) {
            var nodeKey = key + ':' + entity.id;
            return html`
              <li
                class=${'tree-node tree-leaf' + (selected === nodeKey ? ' selected' : '')}
                onClick=${function () {
                  Store.selectedKey.value = nodeKey;
                }}
              >
                ${entityLabel(key, entity)}
              </li>
            `;
          })
        : [];

      return html`
        <li class="tree-folder">
          <div
            class=${'tree-node tree-folder-label' + (selected === key ? ' selected' : '')}
            onClick=${function () {
              Store.selectedKey.value = key;
              if (expanded[key] === false) {
                toggleFolder(key);
              }
            }}
          >
            <span
              class="tree-caret"
              onClick=${function (e) {
                e.stopPropagation();
                toggleFolder(key);
              }}
              >${isExpanded ? '▾' : '▸'}</span
            >
            <span class="tree-icon" data-icon=${info.icon}></span>
            <span class="tree-label">${info.many}</span>
            <span class="tree-count">${entities.length}</span>
          </div>
          <ul class="tree-children">
            ${childNodes}
          </ul>
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

  function refOptions(collection) {
    return (Store.document.value[collection] || []).map(function (entity) {
      return { value: entity.id, label: entityLabel(collection, entity) };
    });
  }

  function FieldInput(props) {
    var field = props.field;
    var value = props.value;
    var onChange = props.onChange;

    if (field.type === 'select') {
      return html`
        <select onChange=${(e) => onChange(e.target.value)}>
          <option value="">—</option>
          ${field.options.map(
            (option) => html`<option value=${option} selected=${value === option}>${option}</option>`
          )}
        </select>
      `;
    }

    if (field.type === 'ref') {
      var options = refOptions(field.collection);
      return html`
        <select onChange=${(e) => onChange(e.target.value)}>
          <option value="">—</option>
          ${options.map(
            (option) =>
              html`<option value=${option.value} selected=${value === option.value}>${option.label}</option>`
          )}
        </select>
      `;
    }

    return html`
      <input type="text" value=${value || ''} onInput=${(e) => onChange(e.target.value)} />
    `;
  }

  function DeviceList() {
    var devices = Store.document.value.devices;
    return html`
      <div class="detail-grid">
        <h2>Devices</h2>
        <button
          onClick=${function () {
            var device = Store.addDevice();
            Store.selectedKey.value = 'devices:' + device.id;
          }}
        >
          + New: Device
        </button>
        <ul class="entity-list">
          ${devices.map(
            (device) => html`
              <li
                class="entity-list-item"
                onClick=${function () {
                  Store.selectedKey.value = 'devices:' + device.id;
                }}
              >
                ${entityLabel('devices', device)}
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }

  function DeviceDetail(props) {
    var device = props.device;

    function onChange(fieldKey, value) {
      var patch = {};
      patch[fieldKey] = value;
      Store.updateDevice(device.id, patch);
    }

    return html`
      <div class="detail-grid">
        <h2>${entityLabel('devices', device)}</h2>
        <table class="field-grid">
          <tbody>
            ${Schema.DEVICE_FIELDS.map(
              (field) => html`
                <tr>
                  <td class="field-label">${field.label}</td>
                  <td class="field-value">
                    <${FieldInput}
                      field=${field}
                      value=${device[field.key]}
                      onChange=${(value) => onChange(field.key, value)}
                    />
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
        <button
          class="delete-button"
          onClick=${function () {
            Store.deleteDevice(device.id);
          }}
        >
          Delete
        </button>
      </div>
    `;
  }

  function Detail() {
    var selected = Store.selectedKey.value;
    if (selected === 'customer') {
      return html`<${CustomerGrid} />`;
    }
    if (selected === 'devices') {
      return html`<${DeviceList} />`;
    }
    if (selected.indexOf('devices:') === 0) {
      var id = selected.slice('devices:'.length);
      var device = Store.document.value.devices.find(function (d) {
        return d.id === id;
      });
      if (device) {
        return html`<${DeviceDetail} device=${device} />`;
      }
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
