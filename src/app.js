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

  function EntityList(props) {
    var collectionKey = props.collectionKey;
    var info = Schema.COLLECTIONS[collectionKey];
    var entities = Store.document.value[collectionKey];
    return html`
      <div class="detail-grid">
        <h2>${info.many}</h2>
        <button
          onClick=${function () {
            var entity = Store.addEntity(collectionKey);
            Store.selectedKey.value = collectionKey + ':' + entity.id;
          }}
        >
          + New: ${info.one}
        </button>
        <ul class="entity-list">
          ${entities.map(
            (entity) => html`
              <li
                class="entity-list-item"
                onClick=${function () {
                  Store.selectedKey.value = collectionKey + ':' + entity.id;
                }}
              >
                ${entityLabel(collectionKey, entity)}
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }

  function DeviceMonitors(props) {
    var device = props.device;
    var monitors = Store.document.value.monitors.filter(function (monitor) {
      return monitor.device === device.id;
    });

    return html`
      <div class="device-monitors">
        <h3>Monitors</h3>
        <button
          onClick=${function () {
            var monitor = Store.addMonitorForDevice(device.id);
            Store.selectedKey.value = 'monitors:' + monitor.id;
          }}
        >
          + Monitor
        </button>
        <ul class="entity-list">
          ${monitors.map(
            (monitor) => html`
              <li
                class="entity-list-item"
                onClick=${function () {
                  Store.selectedKey.value = 'monitors:' + monitor.id;
                }}
              >
                ${entityLabel('monitors', monitor)}
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }

  function AssociationChecklist(props) {
    var association = props.association;
    var owner = props.owner;
    var targetEntities = Store.document.value[association.targetCollection];
    var assignedIds = owner[association.fieldKey] || [];

    return html`
      <div class="association-checklist">
        <h3>${association.label}</h3>
        <button
          onClick=${function () {
            var entity = Store.addEntityAssociated(association, owner.id);
            Store.selectedKey.value = association.targetCollection + ':' + entity.id;
          }}
        >
          + New
        </button>
        <ul class="checklist">
          ${targetEntities.map(
            (entity) => html`
              <li class="checklist-item">
                <label>
                  <input
                    type="checkbox"
                    checked=${assignedIds.includes(entity.id)}
                    onChange=${function () {
                      Store.toggleAssociation(association, owner.id, entity.id);
                    }}
                  />
                  ${entityLabel(association.targetCollection, entity)}
                </label>
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }

  function ReverseAssociationList(props) {
    var association = props.association;
    var target = props.target;
    var owners = Store.document.value[association.ownerCollection];
    var ownerInfo = Schema.COLLECTIONS[association.ownerCollection];

    return html`
      <div class="association-checklist">
        <h3>${ownerInfo.many}</h3>
        <ul class="checklist">
          ${owners.map(
            (owner) => html`
              <li class="checklist-item">
                <label>
                  <input
                    type="checkbox"
                    checked=${(owner[association.fieldKey] || []).includes(target.id)}
                    onChange=${function () {
                      Store.toggleAssociation(association, owner.id, target.id);
                    }}
                  />
                  ${entityLabel(association.ownerCollection, owner)}
                </label>
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }

  function EntityAssociations(props) {
    var collectionKey = props.collectionKey;
    var entity = props.entity;

    var forward = Schema.ASSOCIATIONS.filter(function (association) {
      return association.ownerCollection === collectionKey;
    });
    var reverse = Schema.ASSOCIATIONS.filter(function (association) {
      return association.targetCollection === collectionKey;
    });

    if (forward.length === 0 && reverse.length === 0) {
      return '';
    }

    return html`
      <div class="entity-associations">
        ${forward.map((association) => html`<${AssociationChecklist} association=${association} owner=${entity} />`)}
        ${reverse.map(
          (association) => html`<${ReverseAssociationList} association=${association} target=${entity} />`
        )}
      </div>
    `;
  }

  function EntityDetail(props) {
    var collectionKey = props.collectionKey;
    var entity = props.entity;
    var fields = Schema.COLLECTION_FIELDS[collectionKey];

    function onChange(fieldKey, value) {
      var patch = {};
      patch[fieldKey] = value;
      Store.updateEntity(collectionKey, entity.id, patch);
    }

    return html`
      <div class="detail-grid">
        <h2>${entityLabel(collectionKey, entity)}</h2>
        <table class="field-grid">
          <tbody>
            ${fields.map(
              (field) => html`
                <tr>
                  <td class="field-label">${field.label}</td>
                  <td class="field-value">
                    <${FieldInput}
                      field=${field}
                      value=${entity[field.key]}
                      onChange=${(value) => onChange(field.key, value)}
                    />
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
        ${collectionKey === 'devices' ? html`<${DeviceMonitors} device=${entity} />` : ''}
        <${EntityAssociations} collectionKey=${collectionKey} entity=${entity} />
        <button
          class="delete-button"
          onClick=${function () {
            Store.deleteEntity(collectionKey, entity.id);
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

    var collectionKey = Schema.ALL_COLLECTION_KEYS.find(function (key) {
      return selected === key || selected.indexOf(key + ':') === 0;
    });

    if (collectionKey && selected === collectionKey) {
      return html`<${EntityList} collectionKey=${collectionKey} />`;
    }

    if (collectionKey) {
      var id = selected.slice((collectionKey + ':').length);
      var entity = Store.document.value[collectionKey].find(function (e) {
        return e.id === id;
      });
      if (entity) {
        return html`<${EntityDetail} collectionKey=${collectionKey} entity=${entity} />`;
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
