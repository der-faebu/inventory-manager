import { signal, effect } from '@preact/signals';
import type { JSX } from 'preact';
import * as Schema from '../lib/schema.ts';
import * as Store from '../lib/store.ts';
import * as FileIO from '../lib/file-io.ts';
import * as LegacyMigration from '../lib/legacy-migration.ts';
import * as ExcelExport from '../lib/excel-export.ts';
import type { Association, CollectionKey, Document, Entity, Field } from '../lib/schema.ts';
import type { PortRow } from '../lib/store.ts';

const THEME_STORAGE_KEY = 'inventory-manager.theme';
const THEME_PRESETS = [
  { name: 'amber', h: 25 },
  { name: 'teal', h: 175 },
  { name: 'indigo', h: 235 },
  { name: 'rose', h: 345 },
  { name: 'olive', h: 95 },
];

interface ThemePreference {
  hue: number;
  mode: 'system' | 'light' | 'dark';
}

function loadThemePreference(): ThemePreference {
  try {
    const stored = JSON.parse(globalThis.localStorage.getItem(THEME_STORAGE_KEY) as string);
    return Object.assign({ hue: 25, mode: 'system' }, stored || {});
  } catch {
    return { hue: 25, mode: 'system' };
  }
}

const themePreference = signal<ThemePreference>(loadThemePreference());
const themePopoverOpen = signal(false);

function saveThemePreference(next: ThemePreference): void {
  themePreference.value = next;
  globalThis.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
}

function setThemeHue(hue: number): void {
  saveThemePreference(Object.assign({}, themePreference.value, { hue: Number(hue) }));
}

function setThemeMode(mode: ThemePreference['mode']): void {
  saveThemePreference(Object.assign({}, themePreference.value, { mode }));
}

function applyThemePreference(): void {
  const pref = themePreference.value;
  const root = globalThis.document.documentElement;
  root.style.setProperty('--accent-h', String(pref.hue));
  const isDark =
    pref.mode === 'dark' ||
    (pref.mode === 'system' && globalThis.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', isDark ? 'dark' : 'light');
}

const expandedFolders = signal<Record<string, boolean>>({});
const statusMessage = signal('');
const errorMessage = signal('');
const saveAsPrompt = signal<{ defaultName: string } | null>(null);
const unsavedChangesPrompt = signal<{ pendingAction: 'new' | 'open' } | null>(null);
const pendingOpenFile = signal<File | null>(null);
const migrationWarning = signal<string[] | null>(null);

function showStatus(message: string): void {
  statusMessage.value = message;
  globalThis.setTimeout(() => {
    if (statusMessage.value === message) {
      statusMessage.value = '';
    }
  }, 3000);
}

function showError(message: string): void {
  errorMessage.value = message;
}

function downloadBlob(blob: Blob, name: string): void {
  const url = globalThis.URL.createObjectURL(blob);
  const link = globalThis.document.createElement('a');
  link.href = url;
  link.download = name;
  globalThis.document.body.appendChild(link);
  link.click();
  globalThis.document.body.removeChild(link);
  globalThis.URL.revokeObjectURL(url);
}

function downloadDocument(doc: Document, name: string): void {
  const json = FileIO.serializeDocument(doc);
  downloadBlob(new Blob([json], { type: 'application/json' }), name);
}

function doExportExcel(): void {
  try {
    const workbook = ExcelExport.buildWorkbook(Store.document.value);
    const binary = ExcelExport.writeBuffer(workbook);
    const blob = new Blob([binary], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const customerName = Store.document.value.customer.name || 'Kunde';
    const name = 'Bestandsaufnahme ' + FileIO.sanitizeFilename(customerName) + '.xlsx';
    downloadBlob(blob, name);
    showStatus('Exported ' + name);
  } catch (e) {
    showError('Export failed: ' + (e as Error).message);
  }
}

function performSave(name: string): boolean {
  try {
    downloadDocument(Store.document.value, name);
    Store.markSaved(name);
    showStatus('Saved ' + name);
    return true;
  } catch (e) {
    showError('Save failed: ' + (e as Error).message);
    return false;
  }
}

function resolveSaveName(): string {
  return Store.filename.value || FileIO.suggestFilename(Store.document.value);
}

function doSave(): void {
  performSave(resolveSaveName());
}

function doSaveAs(): void {
  saveAsPrompt.value = { defaultName: resolveSaveName() };
}

function confirmSaveAs(name: string): void {
  saveAsPrompt.value = null;
  if (name) {
    performSave(name);
  }
}

function doNew(): void {
  if (Store.dirty.value) {
    unsavedChangesPrompt.value = { pendingAction: 'new' };
    return;
  }
  Store.resetDocument();
  showStatus('New document created');
}

function loadFile(file: File): void {
  const reader = new globalThis.FileReader();
  reader.onload = () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(reader.result as string);
    } catch {
      showError('Open failed: file is not valid JSON.');
      return;
    }

    const format = LegacyMigration.detectFormat(parsed);
    try {
      if (format === 'current') {
        Store.loadDocument(parsed as unknown as Document, file.name);
        showStatus('Opened ' + file.name);
      } else if (format === 'legacy') {
        const result = LegacyMigration.migrate(parsed);
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
      showError('Open failed: ' + (e as Error).message);
    }
  };
  reader.onerror = () => {
    showError('Open failed: could not read the file.');
  };
  reader.readAsText(file);
}

function doOpen(file: File | null): void {
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

function resolveUnsavedChanges(choice: 'save' | 'discard' | 'cancel'): void {
  const prompt = unsavedChangesPrompt.value;
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
    const file = pendingOpenFile.value;
    pendingOpenFile.value = null;
    if (file) {
      loadFile(file);
    }
  }
}

function triggerOpenFilePicker(): void {
  const input = globalThis.document.getElementById('open-file-input') as HTMLInputElement | null;
  if (input) {
    input.value = '';
    input.click();
  }
}

function toggleFolder(key: string): void {
  const current = expandedFolders.value;
  const isExpanded = current[key] !== false;
  expandedFolders.value = Object.assign({}, current, { [key]: !isExpanded });
}

function entityLabel(key: CollectionKey, entity: Entity): string {
  return Schema.entityLabel(key, entity);
}

function Tree(): JSX.Element {
  const doc = Store.document.value;
  const selected = Store.selectedKey.value;
  const expanded = expandedFolders.value;

  const folderNodes = Schema.TREE_ORDER.map((key) => {
    const info = Schema.COLLECTIONS[key];
    const entities = doc[key] || [];
    const isExpanded = expanded[key] !== false;

    const childNodes = isExpanded
      ? entities.map((entity) => {
          const nodeKey = key + ':' + entity.id;
          return (
            <li
              key={nodeKey}
              class={'tree-node tree-leaf' + (selected === nodeKey ? ' selected' : '')}
              onClick={() => {
                Store.selectedKey.value = nodeKey;
              }}
            >
              {entityLabel(key, entity)}
            </li>
          );
        })
      : [];

    return (
      <li key={key} class="tree-folder">
        <div
          class={'tree-node tree-folder-label' + (selected === key ? ' selected' : '')}
          onClick={() => {
            Store.selectedKey.value = key;
            if (expanded[key] === false) {
              toggleFolder(key);
            }
          }}
        >
          <span
            class="tree-caret"
            onClick={(e: Event) => {
              e.stopPropagation();
              toggleFolder(key);
            }}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
          <span class="tree-icon" data-icon={info.icon}></span>
          <span class="tree-label">{info.many}</span>
          <span class="tree-count">{entities.length}</span>
        </div>
        <ul class="tree-children">{childNodes}</ul>
      </li>
    );
  });

  return (
    <ul class="tree">
      <li
        class={'tree-node tree-root' + (selected === 'customer' ? ' selected' : '')}
        onClick={() => {
          Store.selectedKey.value = 'customer';
        }}
      >
        {doc.customer.name || 'Customer'}
      </li>
      <ul class="tree-children">{folderNodes}</ul>
    </ul>
  );
}

function CustomerGrid(): JSX.Element {
  const customer = Store.document.value.customer;

  function onChange(fieldKey: string, value: string): void {
    Store.updateCustomer({ [fieldKey]: value });
  }

  return (
    <div class="detail-grid">
      <h2>Customer</h2>
      <table class="field-grid">
        <tbody>
          {Schema.CUSTOMER_FIELDS.map((field) => (
            <tr key={field.key}>
              <td class="field-label">{field.label}</td>
              <td class="field-value">
                <input
                  type="text"
                  value={(customer as unknown as Record<string, string>)[field.key] || ''}
                  onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
                    onChange(field.key, e.currentTarget.value);
                  }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function refOptions(collection: CollectionKey): { value: string; label: string }[] {
  return (Store.document.value[collection] || []).map((entity) => ({
    value: entity.id as string,
    label: entityLabel(collection, entity),
  }));
}

function FieldInput(props: { field: Field; value: string; onChange: (value: string) => void }): JSX.Element {
  const { field, value, onChange } = props;

  if (field.type === 'select') {
    return (
      <select onChange={(e: Event & { currentTarget: HTMLSelectElement }) => onChange(e.currentTarget.value)}>
        <option value="">—</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option} selected={value === option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'ref') {
    const options = refOptions(field.collection as CollectionKey);
    return (
      <select onChange={(e: Event & { currentTarget: HTMLSelectElement }) => onChange(e.currentTarget.value)}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value} selected={value === option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  const error = Schema.fieldError(field, value);

  if (field.type === 'date') {
    return (
      <>
        <input
          type="date"
          class={error ? 'field-invalid' : ''}
          value={Schema.dateToInputValue(value)}
          onInput={(e: Event & { currentTarget: HTMLInputElement }) => onChange(Schema.dateFromInputValue(e.currentTarget.value))}
        />
        {error ? <div class="field-error">{error}</div> : ''}
      </>
    );
  }

  return (
    <>
      <input
        type="text"
        class={error ? 'field-invalid' : ''}
        value={value || ''}
        onInput={(e: Event & { currentTarget: HTMLInputElement }) => onChange(e.currentTarget.value)}
      />
      {error ? <div class="field-error">{error}</div> : ''}
    </>
  );
}

function EntityList(props: { collectionKey: CollectionKey }): JSX.Element {
  const { collectionKey } = props;
  const info = Schema.COLLECTIONS[collectionKey];
  const entities = Store.document.value[collectionKey];
  return (
    <div class="detail-grid">
      <h2>{info.many}</h2>
      <button
        onClick={() => {
          const entity = Store.addEntity(collectionKey);
          Store.selectedKey.value = collectionKey + ':' + entity.id;
        }}
      >
        + New: {info.one}
      </button>
      <ul class="entity-list">
        {entities.map((entity) => (
          <li
            key={entity.id}
            class="entity-list-item"
            onClick={() => {
              Store.selectedKey.value = collectionKey + ':' + entity.id;
            }}
          >
            {entityLabel(collectionKey, entity)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function portStatusLabel(status: string): string {
  return status === 'faulty' ? 'Faulty' : status === 'occupied' ? 'Occupied' : 'Free';
}

function DeviceSwitchPort(props: { device: Entity }): JSX.Element {
  const { device } = props;
  const jack = device.switch
    ? Store.getPortInfo(device.switch as string, device.port as string).jack || ''
    : '';

  return (
    <tr>
      <td class="field-label">Jack</td>
      <td class="field-value">
        <input type="text" value={jack} readOnly />
      </td>
    </tr>
  );
}

function DeviceMonitors(props: { device: Entity }): JSX.Element {
  const { device } = props;
  const monitors = Store.document.value.monitors.filter((monitor) => monitor.device === device.id);

  return (
    <div class="device-monitors">
      <h3>Monitors</h3>
      <button
        onClick={() => {
          const monitor = Store.addMonitorForDevice(device.id as string);
          Store.selectedKey.value = 'monitors:' + monitor.id;
        }}
      >
        + Monitor
      </button>
      <ul class="entity-list">
        {monitors.map((monitor) => (
          <li
            key={monitor.id}
            class="entity-list-item"
            onClick={() => {
              Store.selectedKey.value = 'monitors:' + monitor.id;
            }}
          >
            {entityLabel('monitors', monitor)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssociationChecklist(props: { association: Association; owner: Entity }): JSX.Element {
  const { association, owner } = props;
  const targetEntities = Store.document.value[association.targetCollection];
  const assignedIds = (owner[association.fieldKey] as string[]) || [];

  return (
    <div class="association-checklist">
      <h3>{association.label}</h3>
      <button
        onClick={() => {
          const entity = Store.addEntityAssociated(association, owner.id as string);
          Store.selectedKey.value = association.targetCollection + ':' + entity.id;
        }}
      >
        + New
      </button>
      <ul class="checklist">
        {targetEntities.map((entity) => (
          <li key={entity.id} class="checklist-item">
            <label>
              <input
                type="checkbox"
                checked={assignedIds.includes(entity.id as string)}
                onChange={() => {
                  Store.toggleAssociation(association, owner.id as string, entity.id as string);
                }}
              />
              {entityLabel(association.targetCollection, entity)}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReverseAssociationList(props: { association: Association; target: Entity }): JSX.Element {
  const { association, target } = props;
  const owners = Store.document.value[association.ownerCollection];
  const ownerInfo = Schema.COLLECTIONS[association.ownerCollection];

  return (
    <div class="association-checklist">
      <h3>{ownerInfo.many}</h3>
      <ul class="checklist">
        {owners.map((owner) => (
          <li key={owner.id} class="checklist-item">
            <label>
              <input
                type="checkbox"
                checked={((owner[association.fieldKey] as string[]) || []).includes(target.id as string)}
                onChange={() => {
                  Store.toggleAssociation(association, owner.id as string, target.id as string);
                }}
              />
              {entityLabel(association.ownerCollection, owner)}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EntityAssociations(props: { collectionKey: CollectionKey; entity: Entity }): JSX.Element | string {
  const { collectionKey, entity } = props;

  const forward = Schema.ASSOCIATIONS.filter((association) => association.ownerCollection === collectionKey);
  const reverse = Schema.ASSOCIATIONS.filter((association) => association.targetCollection === collectionKey);

  if (forward.length === 0 && reverse.length === 0) {
    return '';
  }

  return (
    <div class="entity-associations">
      {forward.map((association) => (
        <AssociationChecklist key={association.fieldKey} association={association} owner={entity} />
      ))}
      {reverse.map((association) => (
        <ReverseAssociationList key={association.fieldKey} association={association} target={entity} />
      ))}
    </div>
  );
}

function NetworkPorts(props: { network: Entity }): JSX.Element {
  const { network } = props;
  const rows = Store.getPortsForNetwork(network.id as string);

  return (
    <div class="detail-grid">
      <h2>{(network.name as string) || '(unnamed)'} — Ports</h2>
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
          {rows.map((row: PortRow) => {
            const status = Schema.portStatus(row.device, row.info);
            return (
              <tr
                key={row.port}
                class={'port-row port-status-' + status}
                onDblClick={() => {
                  Store.selectedKey.value = 'network:' + network.id + '/ports/' + row.port;
                }}
              >
                <td>{row.port}</td>
                <td>{row.device ? entityLabel('devices', row.device) : ''}</td>
                <td>{portStatusLabel(status)}</td>
                <td>{row.info.jack || ''}</td>
                <td>{row.info.remark || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PortDetail(props: { network: Entity; port: number }): JSX.Element {
  const { network, port } = props;
  const row = Store.getPortRow(network.id as string, port);
  const deviceOptions = refOptions('devices');

  return (
    <div class="detail-grid">
      <h2>
        {(network.name as string) || '(unnamed)'} — Port {port}
      </h2>
      <table class="field-grid">
        <tbody>
          <tr>
            <td class="field-label">Device</td>
            <td class="field-value">
              <select
                onChange={(e: Event & { currentTarget: HTMLSelectElement }) => {
                  Store.assignDevicePort(network.id as string, port, e.currentTarget.value);
                }}
              >
                <option value="">—</option>
                {deviceOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    selected={!!row.device && row.device.id === option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td class="field-label">Status</td>
            <td class="field-value">
              <select
                onChange={(e: Event & { currentTarget: HTMLSelectElement }) => {
                  Store.setPortInfo(network.id as string, port, { status: e.currentTarget.value });
                }}
              >
                <option value="" selected={!row.info.status}>
                  —
                </option>
                {Schema.MANUAL_PORT_STATUSES.map((option) => (
                  <option key={option} value={option} selected={row.info.status === option}>
                    {option}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td class="field-label">Jack</td>
            <td class="field-value">
              <input
                type="text"
                value={row.info.jack || ''}
                onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
                  Store.setPortInfo(network.id as string, port, { jack: e.currentTarget.value });
                }}
              />
            </td>
          </tr>
          <tr>
            <td class="field-label">Remark</td>
            <td class="field-value">
              <input
                type="text"
                value={row.info.remark || ''}
                onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
                  Store.setPortInfo(network.id as string, port, { remark: e.currentTarget.value });
                }}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EntityDetail(props: { collectionKey: CollectionKey; entity: Entity }): JSX.Element {
  const { collectionKey, entity } = props;
  const fields = Schema.COLLECTION_FIELDS[collectionKey];

  function onChange(fieldKey: string, value: string): void {
    if (collectionKey === 'devices' && (fieldKey === 'switch' || fieldKey === 'port')) {
      const networkId = fieldKey === 'switch' ? value : (entity.switch as string);
      const port = fieldKey === 'port' ? value : (entity.port as string);
      if (networkId && port) {
        Store.assignDevicePort(networkId, port, entity.id as string);
        return;
      }
    }
    Store.updateEntity(collectionKey, entity.id as string, { [fieldKey]: value });
  }

  return (
    <div class="detail-grid">
      <h2>{entityLabel(collectionKey, entity)}</h2>
      <table class="field-grid">
        <tbody>
          {fields.map((field) => (
            <tr key={field.key}>
              <td class="field-label">{field.label}</td>
              <td class="field-value">
                <FieldInput
                  field={field}
                  value={entity[field.key] as string}
                  onChange={(value) => onChange(field.key, value)}
                />
              </td>
            </tr>
          ))}
          {collectionKey === 'devices' ? <DeviceSwitchPort device={entity} /> : ''}
        </tbody>
      </table>
      {collectionKey === 'devices' ? <DeviceMonitors device={entity} /> : ''}
      {collectionKey === 'network' && parseInt(entity.portCount as string, 10) > 0 ? (
        <button
          onClick={() => {
            Store.selectedKey.value = 'network:' + entity.id + '/ports';
          }}
        >
          Ports
        </button>
      ) : (
        ''
      )}
      <EntityAssociations collectionKey={collectionKey} entity={entity} />
      <button
        class="delete-button"
        onClick={() => {
          Store.deleteEntity(collectionKey, entity.id as string);
        }}
      >
        Delete
      </button>
    </div>
  );
}

function Detail(): JSX.Element {
  const selected = Store.selectedKey.value;
  if (selected === 'customer') {
    return <CustomerGrid />;
  }

  const portsMatch = /^network:([^/]+)\/ports(?:\/(\d+))?$/.exec(selected);
  if (portsMatch) {
    const network = Store.document.value.network.find((n) => n.id === portsMatch[1]);
    if (network) {
      return portsMatch[2] ? (
        <PortDetail network={network} port={parseInt(portsMatch[2], 10)} />
      ) : (
        <NetworkPorts network={network} />
      );
    }
  }

  const collectionKey = Schema.ALL_COLLECTION_KEYS.find(
    (key) => selected === key || selected.indexOf(key + ':') === 0,
  );

  if (collectionKey && selected === collectionKey) {
    return <EntityList collectionKey={collectionKey} />;
  }

  if (collectionKey) {
    const id = selected.slice((collectionKey + ':').length);
    const entity = Store.document.value[collectionKey].find((e) => e.id === id);
    if (entity) {
      return <EntityDetail collectionKey={collectionKey} entity={entity} />;
    }
  }

  return (
    <div class="detail-grid">
      <p>Nothing to show yet.</p>
    </div>
  );
}

function ThemePicker(): JSX.Element {
  const pref = themePreference.value;
  const isOpen = themePopoverOpen.value;

  return (
    <div class="theme-control">
      <button
        class="theme-button"
        title="Theme"
        aria-label="Theme settings"
        onClick={(e: Event) => {
          e.stopPropagation();
          themePopoverOpen.value = !themePopoverOpen.value;
        }}
      >
        🎨
      </button>
      {isOpen ? (
        <div class="theme-popover" onClick={(e: Event) => e.stopPropagation()}>
          <h4>Accent color</h4>
          <div class="theme-swatch-row">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                class={'theme-swatch' + (pref.hue === preset.h ? ' active' : '')}
                title={preset.name}
                style={'background: hsl(' + preset.h + ' 68% 48%)'}
                onClick={() => {
                  setThemeHue(preset.h);
                }}
              ></button>
            ))}
          </div>
          <div class="theme-custom-hue-row">
            <span style="font-size: 12px">custom</span>
            <input
              type="range"
              min="0"
              max="360"
              value={pref.hue}
              onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
                setThemeHue(Number(e.currentTarget.value));
              }}
            />
          </div>
          <h4>Appearance</h4>
          <div class="theme-segmented">
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                class={pref.mode === mode ? 'active' : ''}
                onClick={() => {
                  setThemeMode(mode);
                }}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        ''
      )}
    </div>
  );
}

function Toolbar(): JSX.Element {
  return (
    <div class="toolbar">
      <button onClick={doNew}>New</button>
      <button onClick={doSave}>Save</button>
      <button onClick={doSaveAs}>Save As…</button>
      <button onClick={triggerOpenFilePicker}>Open…</button>
      <button onClick={doExportExcel}>Export to Excel…</button>
      <input
        id="open-file-input"
        type="file"
        accept=".bestand,application/json"
        style="display: none"
        onChange={(e: Event & { currentTarget: HTMLInputElement }) => {
          doOpen(e.currentTarget.files?.[0] || null);
        }}
      />
      <span class="toolbar-filename">
        {Store.filename.value || '(unsaved)'}
        {Store.dirty.value ? ' •' : ''}
      </span>
      <span class="toolbar-status">{statusMessage.value}</span>
      <div class="toolbar-spacer"></div>
      <ThemePicker />
    </div>
  );
}

function Modal(props: {
  title: string;
  actions: { label: string; onClick: () => void }[];
  children?: JSX.Element | JSX.Element[] | string;
}): JSX.Element {
  return (
    <div class="modal-overlay">
      <div class="modal">
        <h3>{props.title}</h3>
        {props.children}
        <div class="modal-actions">
          {props.actions.map((action) => (
            <button key={action.label} onClick={action.onClick}>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function SaveAsModal(): JSX.Element | string {
  const prompt = saveAsPrompt.value;
  if (!prompt) {
    return '';
  }
  const nameValue = prompt.defaultName;
  return (
    <Modal
      title="Save As"
      actions={[
        { label: 'Save', onClick: () => confirmSaveAs(nameValue) },
        { label: 'Cancel', onClick: () => (saveAsPrompt.value = null) },
      ]}
    >
      <input
        type="text"
        class="save-as-input"
        value={nameValue}
        onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
          saveAsPrompt.value = Object.assign({}, prompt, { defaultName: e.currentTarget.value });
        }}
      />
    </Modal>
  );
}

function UnsavedChangesModal(): JSX.Element | string {
  const prompt = unsavedChangesPrompt.value;
  if (!prompt) {
    return '';
  }
  return (
    <Modal
      title="Unsaved changes"
      actions={[
        { label: 'Save', onClick: () => resolveUnsavedChanges('save') },
        { label: 'Discard', onClick: () => resolveUnsavedChanges('discard') },
        { label: 'Cancel', onClick: () => resolveUnsavedChanges('cancel') },
      ]}
    >
      <p>You have unsaved changes. Do you want to save before continuing?</p>
    </Modal>
  );
}

function ErrorModal(): JSX.Element | string {
  if (!errorMessage.value) {
    return '';
  }
  return (
    <Modal title="Error" actions={[{ label: 'OK', onClick: () => (errorMessage.value = '') }]}>
      <p>{errorMessage.value}</p>
    </Modal>
  );
}

function MigrationWarningModal(): JSX.Element | string {
  const fields = migrationWarning.value;
  if (!fields) {
    return '';
  }
  return (
    <Modal title="Migration warning" actions={[{ label: 'OK', onClick: () => (migrationWarning.value = null) }]}>
      <p>The following fields from the legacy file were not recognized and were dropped:</p>
      <ul class="migration-warning-list">
        {fields.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
    </Modal>
  );
}

function handleKeydown(e: KeyboardEvent): void {
  const ctrlOrCmd = e.ctrlKey || e.metaKey;
  if (!ctrlOrCmd) {
    return;
  }
  const key = e.key.toLowerCase();
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

let globalListenersAttached = false;

function attachGlobalListeners(): void {
  if (globalListenersAttached) {
    return;
  }
  globalListenersAttached = true;

  globalThis.document.addEventListener('keydown', handleKeydown);

  globalThis.document.addEventListener('click', () => {
    if (themePopoverOpen.value) {
      themePopoverOpen.value = false;
    }
  });

  globalThis.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (themePreference.value.mode === 'system') {
      applyThemePreference();
    }
  });

  globalThis.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
    if (Store.dirty.value) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  effect(() => {
    themePreference.value;
    themePopoverOpen.value;
    Store.dirty.value;
    applyThemePreference();
  });
}

export default function App(): JSX.Element {
  attachGlobalListeners();

  return (
    <div class="app-root">
      <Toolbar />
      <div class="app-shell">
        <div class="tree-pane">
          <Tree />
        </div>
        <div class="detail-pane">
          <Detail />
        </div>
      </div>
      <SaveAsModal />
      <UnsavedChangesModal />
      <ErrorModal />
      <MigrationWarningModal />
    </div>
  );
}
