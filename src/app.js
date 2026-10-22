(function (global) {
  'use strict';

  var preact = global.preact;
  var html = global.htm.bind(preact.h);
  var Schema = global.Schema;
  var Store = global.Store;
  var FileIO = global.FileIO;
  var LegacyMigration = global.LegacyMigration;
  var ExcelExport = global.ExcelExport;
  var signalsCore = global.preactSignalsCore;

  var expandedFolders = signalsCore.signal({});
  var statusMessage = signalsCore.signal('');
  var errorMessage = signalsCore.signal('');
  var saveAsPrompt = signalsCore.signal(null); // { defaultName } or null
  var unsavedChangesPrompt = signalsCore.signal(null); // { pendingAction: 'new' | 'open' } or null
  var pendingOpenFile = signalsCore.signal(null); // File object staged while the unsaved-changes modal is open
  var migrationWarning = signalsCore.signal(null); // array of unmapped-field strings, or null

  function showStatus(message) {
    statusMessage.value = message;
    global.setTimeout(function () {
      if (statusMessage.value === message) {
        statusMessage.value = '';
      }
    }, 3000);
  }

  function showError(message) {
    errorMessage.value = message;
  }

  function downloadBlob(blob, name) {
    var url = global.URL.createObjectURL(blob);
    var link = global.document.createElement('a');
    link.href = url;
    link.download = name;
    global.document.body.appendChild(link);
    link.click();
    global.document.body.removeChild(link);
    global.URL.revokeObjectURL(url);
  }

  function downloadDocument(doc, name) {
    var json = FileIO.serializeDocument(doc);
    downloadBlob(new global.Blob([json], { type: 'application/json' }), name);
  }

  function doExportExcel() {
    try {
      var workbook = ExcelExport.buildWorkbook(Store.document.value);
      var binary = ExcelExport.writeBuffer(workbook);
      var blob = new global.Blob([binary], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var customerName = Store.document.value.customer.name || 'Kunde';
      var name = 'Bestandsaufnahme ' + FileIO.sanitizeFilename(customerName) + '.xlsx';
      downloadBlob(blob, name);
      showStatus('Exported ' + name);
    } catch (e) {
      showError('Export failed: ' + e.message);
    }
  }

  function performSave(name) {
    try {
      downloadDocument(Store.document.value, name);
      Store.markSaved(name);
      showStatus('Saved ' + name);
      return true;
    } catch (e) {
      showError('Save failed: ' + e.message);
      return false;
    }
  }

  function resolveSaveName() {
    return Store.filename.value || FileIO.suggestFilename(Store.document.value);
  }

  function doSave() {
    performSave(resolveSaveName());
  }

  function doSaveAs() {
    saveAsPrompt.value = { defaultName: resolveSaveName() };
  }

  function confirmSaveAs(name) {
    saveAsPrompt.value = null;
    if (name) {
      performSave(name);
    }
  }

  function doNew() {
    if (Store.dirty.value) {
      unsavedChangesPrompt.value = { pendingAction: 'new' };
      return;
    }
    Store.resetDocument();
    showStatus('New document created');
  }

  function loadFile(file) {
    var reader = new global.FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(reader.result);
      } catch (e) {
        showError('Open failed: file is not valid JSON.');
        return;
      }

      var format = LegacyMigration.detectFormat(parsed);
      try {
        if (format === 'current') {
          Store.loadDocument(parsed, file.name);
          showStatus('Opened ' + file.name);
        } else if (format === 'legacy') {
          var result = LegacyMigration.migrate(parsed);
          Store.loadDocument(result.document, null);
          Store.bumpRevision();
          showStatus('Migrated legacy file ' + file.name);
          if (result.unmappedFields.length > 0) {
            migrationWarning.value = result.unmappedFields;
          }
        } else {
          showError('Open failed: file is not a recognized inventory document.');
        }
      } catch (e) {
        showError('Open failed: ' + e.message);
      }
    };
    reader.onerror = function () {
      showError('Open failed: could not read the file.');
    };
    reader.readAsText(file);
  }

  function doOpen(file) {
    if (!file) {
      return;
    }
    if (Store.dirty.value) {
      pendingOpenFile.value = file;
      unsavedChangesPrompt.value = { pendingAction: 'open' };
      return;
    }
    loadFile(file);
  }

  function resolveUnsavedChanges(choice) {
    var prompt = unsavedChangesPrompt.value;
    if (!prompt) {
      return;
    }
    if (choice === 'cancel') {
      unsavedChangesPrompt.value = null;
      pendingOpenFile.value = null;
      return;
    }
    if (choice === 'save') {
      if (!performSave(resolveSaveName())) {
        return;
      }
    }
    unsavedChangesPrompt.value = null;
    if (prompt.pendingAction === 'new') {
      Store.resetDocument();
      showStatus('New document created');
    } else if (prompt.pendingAction === 'open') {
      var file = pendingOpenFile.value;
      pendingOpenFile.value = null;
      if (file) {
        loadFile(file);
      }
    }
  }

  function triggerOpenFilePicker() {
    var input = global.document.getElementById('open-file-input');
    if (input) {
      input.value = '';
      input.click();
    }
  }

  function toggleFolder(key) {
    var current = expandedFolders.value;
    var isExpanded = current[key] !== false;
    expandedFolders.value = Object.assign({}, current, { [key]: !isExpanded });
  }

  function entityLabel(key, entity) {
    return Schema.entityLabel(key, entity);
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

  function PORT_STATUS_LABEL(status) {
    return status === 'faulty' ? 'Faulty' : status === 'occupied' ? 'Occupied' : 'Free';
  }

  function DeviceSwitchPort(props) {
    var device = props.device;
    var jack = device.switch ? Store.getPortInfo(device.switch, device.port).jack || '' : '';

    return html`
      <tr>
        <td class="field-label">Jack</td>
        <td class="field-value"><input type="text" value=${jack} readonly /></td>
      </tr>
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

  function NetworkPorts(props) {
    var network = props.network;
    var rows = Store.getPortsForNetwork(network.id);

    return html`
      <div class="detail-grid">
        <h2>${network.name || '(unnamed)'} — Ports</h2>
        <table class="port-table">
          <thead>
            <tr>
              <th>Port</th>
              <th>Device</th>
              <th>Status</th>
              <th>Jack</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(function (row) {
              var status = Schema.portStatus(row.device, row.info);
              return html`
                <tr
                  class=${'port-row port-status-' + status}
                  onDblClick=${function () {
                    Store.selectedKey.value = 'network:' + network.id + '/ports/' + row.port;
                  }}
                >
                  <td>${row.port}</td>
                  <td>${row.device ? entityLabel('devices', row.device) : ''}</td>
                  <td>${PORT_STATUS_LABEL(status)}</td>
                  <td>${row.info.jack || ''}</td>
                  <td>${row.info.remark || ''}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  function PortDetail(props) {
    var network = props.network;
    var port = props.port;
    var row = Store.getPortRow(network.id, port);
    var deviceOptions = refOptions('devices');

    return html`
      <div class="detail-grid">
        <h2>${network.name || '(unnamed)'} — Port ${port}</h2>
        <table class="field-grid">
          <tbody>
            <tr>
              <td class="field-label">Device</td>
              <td class="field-value">
                <select
                  onChange=${function (e) {
                    Store.assignDevicePort(network.id, port, e.target.value);
                  }}
                >
                  <option value="">—</option>
                  ${deviceOptions.map(
                    (option) =>
                      html`<option value=${option.value} selected=${row.device && row.device.id === option.value}>
                        ${option.label}
                      </option>`
                  )}
                </select>
              </td>
            </tr>
            <tr>
              <td class="field-label">Status</td>
              <td class="field-value">
                <select
                  onChange=${function (e) {
                    Store.setPortInfo(network.id, port, { status: e.target.value });
                  }}
                >
                  <option value="" selected=${!row.info.status}>—</option>
                  ${Schema.MANUAL_PORT_STATUSES.map(
                    (option) =>
                      html`<option value=${option} selected=${row.info.status === option}>${option}</option>`
                  )}
                </select>
              </td>
            </tr>
            <tr>
              <td class="field-label">Jack</td>
              <td class="field-value">
                <input
                  type="text"
                  value=${row.info.jack || ''}
                  onInput=${function (e) {
                    Store.setPortInfo(network.id, port, { jack: e.target.value });
                  }}
                />
              </td>
            </tr>
            <tr>
              <td class="field-label">Remark</td>
              <td class="field-value">
                <input
                  type="text"
                  value=${row.info.remark || ''}
                  onInput=${function (e) {
                    Store.setPortInfo(network.id, port, { remark: e.target.value });
                  }}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  function EntityDetail(props) {
    var collectionKey = props.collectionKey;
    var entity = props.entity;
    var fields = Schema.COLLECTION_FIELDS[collectionKey];

    function onChange(fieldKey, value) {
      if (collectionKey === 'devices' && (fieldKey === 'switch' || fieldKey === 'port')) {
        var networkId = fieldKey === 'switch' ? value : entity.switch;
        var port = fieldKey === 'port' ? value : entity.port;
        if (networkId && port) {
          Store.assignDevicePort(networkId, port, entity.id);
          return;
        }
      }
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
            ${collectionKey === 'devices' ? html`<${DeviceSwitchPort} device=${entity} />` : ''}
          </tbody>
        </table>
        ${collectionKey === 'devices' ? html`<${DeviceMonitors} device=${entity} />` : ''}
        ${collectionKey === 'network' && parseInt(entity.portCount, 10) > 0
          ? html`
              <button
                onClick=${function () {
                  Store.selectedKey.value = 'network:' + entity.id + '/ports';
                }}
              >
                Ports
              </button>
            `
          : ''}
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

    var portsMatch = /^network:([^/]+)\/ports(?:\/(\d+))?$/.exec(selected);
    if (portsMatch) {
      var network = Store.document.value.network.find(function (n) {
        return n.id === portsMatch[1];
      });
      if (network) {
        return portsMatch[2]
          ? html`<${PortDetail} network=${network} port=${parseInt(portsMatch[2], 10)} />`
          : html`<${NetworkPorts} network=${network} />`;
      }
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

  function Toolbar() {
    return html`
      <div class="toolbar">
        <button onClick=${doNew}>New</button>
        <button onClick=${doSave}>Save</button>
        <button onClick=${doSaveAs}>Save As…</button>
        <button onClick=${triggerOpenFilePicker}>Open…</button>
        <button onClick=${doExportExcel}>Export to Excel…</button>
        <input
          id="open-file-input"
          type="file"
          accept=".bestand,application/json"
          style="display: none"
          onChange=${function (e) {
            doOpen(e.target.files[0]);
          }}
        />
        <span class="toolbar-filename">${Store.filename.value || '(unsaved)'}${Store.dirty.value ? ' •' : ''}</span>
        <span class="toolbar-status">${statusMessage.value}</span>
      </div>
    `;
  }

  function SaveAsModal() {
    var prompt = saveAsPrompt.value;
    if (!prompt) {
      return '';
    }
    var nameValue = prompt.defaultName;
    return html`
      <div class="modal-overlay">
        <div class="modal">
          <h3>Save As</h3>
          <input
            type="text"
            class="save-as-input"
            value=${nameValue}
            onInput=${function (e) {
              saveAsPrompt.value = Object.assign({}, prompt, { defaultName: e.target.value });
            }}
          />
          <div class="modal-actions">
            <button
              onClick=${function () {
                confirmSaveAs(nameValue);
              }}
            >
              Save
            </button>
            <button
              onClick=${function () {
                saveAsPrompt.value = null;
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function UnsavedChangesModal() {
    var prompt = unsavedChangesPrompt.value;
    if (!prompt) {
      return '';
    }
    return html`
      <div class="modal-overlay">
        <div class="modal">
          <h3>Unsaved changes</h3>
          <p>You have unsaved changes. Do you want to save before continuing?</p>
          <div class="modal-actions">
            <button
              onClick=${function () {
                resolveUnsavedChanges('save');
              }}
            >
              Save
            </button>
            <button
              onClick=${function () {
                resolveUnsavedChanges('discard');
              }}
            >
              Discard
            </button>
            <button
              onClick=${function () {
                resolveUnsavedChanges('cancel');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function ErrorModal() {
    if (!errorMessage.value) {
      return '';
    }
    return html`
      <div class="modal-overlay">
        <div class="modal">
          <h3>Error</h3>
          <p>${errorMessage.value}</p>
          <div class="modal-actions">
            <button
              onClick=${function () {
                errorMessage.value = '';
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function MigrationWarningModal() {
    var fields = migrationWarning.value;
    if (!fields) {
      return '';
    }
    return html`
      <div class="modal-overlay">
        <div class="modal">
          <h3>Migration warning</h3>
          <p>The following fields from the legacy file were not recognized and were dropped:</p>
          <ul class="migration-warning-list">
            ${fields.map((field) => html`<li>${field}</li>`)}
          </ul>
          <div class="modal-actions">
            <button
              onClick=${function () {
                migrationWarning.value = null;
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function App() {
    return html`
      <div class="app-root">
        <${Toolbar} />
        <div class="app-shell">
          <div class="tree-pane"><${Tree} /></div>
          <div class="detail-pane"><${Detail} /></div>
        </div>
        <${SaveAsModal} />
        <${UnsavedChangesModal} />
        <${ErrorModal} />
        <${MigrationWarningModal} />
      </div>
    `;
  }

  function rerender() {
    preact.render(html`<${App} />`, global.document.getElementById('app'));
  }

  function handleKeydown(e) {
    var ctrlOrCmd = e.ctrlKey || e.metaKey;
    if (!ctrlOrCmd) {
      return;
    }
    var key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      if (e.shiftKey) {
        doSaveAs();
      } else {
        doSave();
      }
    } else if (key === 'o') {
      e.preventDefault();
      triggerOpenFilePicker();
    } else if (key === 'n') {
      e.preventDefault();
      doNew();
    }
  }

  global.document.addEventListener('keydown', handleKeydown);

  global.addEventListener('beforeunload', function (e) {
    if (Store.dirty.value) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  signalsCore.effect(function () {
    Store.document.value;
    Store.selectedKey.value;
    Store.filename.value;
    Store.dirty.value;
    expandedFolders.value;
    statusMessage.value;
    errorMessage.value;
    saveAsPrompt.value;
    unsavedChangesPrompt.value;
    migrationWarning.value;
    rerender();
  });
})(typeof window !== 'undefined' ? window : globalThis);
