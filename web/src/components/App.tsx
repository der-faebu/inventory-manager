import type { JSX } from 'preact';
import * as Schema from '../lib/schema.ts';
import * as Store from '../lib/store.ts';
import type { Association, CollectionKey, Entity, Field } from '../lib/schema.ts';
import type { PortRow } from '../lib/store.ts';

const FIELD_LABEL_CLASS =
  'w-[180px] py-1.5 px-2 border-b border-[var(--surface-hover)] text-[12.5px] font-bold text-[color:var(--accent-dark)]';
const FIELD_VALUE_CLASS = 'py-1.5 px-2 border-b border-[var(--surface-hover)]';
const FIELD_INPUT_CLASS =
  'w-full rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-sm text-[color:var(--ink)]';

import { themePopoverOpen, themePreference, setThemeHue, setThemeMode, THEME_PRESETS } from '../state/theme.ts';
import {
  errorMessage,
  expandedFolders,
  migrationWarning,
  saveAsPrompt,
  statusMessage,
  toggleFolder,
  unsavedChangesPrompt,
} from '../state/ui.ts';
import {
  confirmSaveAs,
  doExportExcel,
  doNew,
  doOpen,
  doSave,
  doSaveAs,
  resolveUnsavedChanges,
  triggerOpenFilePicker,
} from '../actions/file.ts';
import { attachGlobalListeners } from '../actions/global-listeners.ts';

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
              class={
                'mx-1.5 my-px cursor-pointer whitespace-nowrap rounded-[10px] px-2 py-1 text-[color:var(--ink)] hover:bg-[var(--surface-hover)]' +
                (selected === nodeKey ? ' bg-[var(--accent)] font-bold text-white hover:bg-[var(--accent)]' : '')
              }
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
      <li key={key}>
        <div
          class={
            'mx-1.5 my-px flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-[10px] px-2 py-1 font-bold text-[color:var(--accent-dark)] hover:bg-[var(--surface-hover)]' +
            (selected === key ? ' bg-[var(--accent)] text-white hover:bg-[var(--accent)]' : '')
          }
          onClick={() => {
            Store.selectedKey.value = key;
            if (expanded[key] === false) {
              toggleFolder(key);
            }
          }}
        >
          <span
            class="inline-block w-[1em]"
            onClick={(e: Event) => {
              e.stopPropagation();
              toggleFolder(key);
            }}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
          <span data-icon={info.icon}></span>
          <span>{info.many}</span>
          <span class="ml-auto text-xs opacity-55">{entities.length}</span>
        </div>
        <ul class="list-none py-0 pl-4 pr-0 my-0">{childNodes}</ul>
      </li>
    );
  });

  return (
    <ul class="list-none m-0 p-0">
      <li
        class={
          'mx-1.5 my-px cursor-pointer whitespace-nowrap rounded-[10px] px-2 py-1 text-[color:var(--ink)] hover:bg-[var(--surface-hover)]' +
          (selected === 'customer' ? ' bg-[var(--accent)] font-bold text-white hover:bg-[var(--accent)]' : '')
        }
        onClick={() => {
          Store.selectedKey.value = 'customer';
        }}
      >
        {doc.customer.name || 'Customer'}
      </li>
      <ul class="list-none py-0 pl-4 pr-0 my-0">{folderNodes}</ul>
    </ul>
  );
}

function CustomerGrid(): JSX.Element {
  const customer = Store.document.value.customer;

  function onChange(fieldKey: string, value: string): void {
    Store.updateCustomer({ [fieldKey]: value });
  }

  return (
    <div>
      <h2 class="mt-0 text-[color:var(--accent-dark)]">Customer</h2>
      <table class="w-full max-w-[600px] border-collapse">
        <tbody>
          {Schema.CUSTOMER_FIELDS.map((field) => (
            <tr key={field.key}>
              <td class={FIELD_LABEL_CLASS}>{field.label}</td>
              <td class={FIELD_VALUE_CLASS}>
                <input
                  type="text"
                  class={FIELD_INPUT_CLASS}
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

  const fieldInputClass = (invalid: boolean): string =>
    invalid ? FIELD_INPUT_CLASS.replace('border-[var(--border)]', 'border-[#c0392b]') : FIELD_INPUT_CLASS;

  if (field.type === 'select') {
    return (
      <select
        class={fieldInputClass(false)}
        onChange={(e: Event & { currentTarget: HTMLSelectElement }) => onChange(e.currentTarget.value)}
      >
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
      <select
        class={fieldInputClass(false)}
        onChange={(e: Event & { currentTarget: HTMLSelectElement }) => onChange(e.currentTarget.value)}
      >
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
          class={fieldInputClass(!!error) + ' [color-scheme:light_dark]'}
          value={Schema.dateToInputValue(value)}
          onInput={(e: Event & { currentTarget: HTMLInputElement }) => onChange(Schema.dateFromInputValue(e.currentTarget.value))}
        />
        {error ? <div class="mt-1 text-xs text-[#c0392b]">{error}</div> : ''}
      </>
    );
  }

  return (
    <>
      <input
        type="text"
        class={fieldInputClass(!!error)}
        value={value || ''}
        onInput={(e: Event & { currentTarget: HTMLInputElement }) => onChange(e.currentTarget.value)}
      />
      {error ? <div class="mt-1 text-xs text-[#c0392b]">{error}</div> : ''}
    </>
  );
}

function EntityList(props: { collectionKey: CollectionKey }): JSX.Element {
  const { collectionKey } = props;
  const info = Schema.COLLECTIONS[collectionKey];
  const entities = Store.document.value[collectionKey];
  return (
    <div>
      <h2 class="mt-0 text-[color:var(--accent-dark)]">{info.many}</h2>
      <button
        onClick={() => {
          const entity = Store.addEntity(collectionKey);
          Store.selectedKey.value = collectionKey + ':' + entity.id;
        }}
      >
        + New: {info.one}
      </button>
      <ul class="m-0 mt-3 max-w-[600px] list-none p-0">
        {entities.map((entity) => (
          <li
            key={entity.id}
            class="cursor-pointer border-b border-[var(--surface-hover)] py-1.5 px-2 hover:bg-[var(--surface-hover)]"
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
      <td class={FIELD_LABEL_CLASS}>Jack</td>
      <td class={FIELD_VALUE_CLASS}>
        <input type="text" class={FIELD_INPUT_CLASS} value={jack} readOnly />
      </td>
    </tr>
  );
}

function DeviceMonitors(props: { device: Entity }): JSX.Element {
  const { device } = props;
  const monitors = Store.document.value.monitors.filter((monitor) => monitor.device === device.id);

  return (
    <div>
      <h3>Monitors</h3>
      <button
        onClick={() => {
          const monitor = Store.addMonitorForDevice(device.id as string);
          Store.selectedKey.value = 'monitors:' + monitor.id;
        }}
      >
        + Monitor
      </button>
      <ul class="m-0 mt-3 max-w-[600px] list-none p-0">
        {monitors.map((monitor) => (
          <li
            key={monitor.id}
            class="cursor-pointer border-b border-[var(--surface-hover)] py-1.5 px-2 hover:bg-[var(--surface-hover)]"
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
    <div>
      <h3>{association.label}</h3>
      <button
        onClick={() => {
          const entity = Store.addEntityAssociated(association, owner.id as string);
          Store.selectedKey.value = association.targetCollection + ':' + entity.id;
        }}
      >
        + New
      </button>
      <ul class="list-none m-0 p-0">
        {targetEntities.map((entity) => (
          <li key={entity.id}>
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
    <div>
      <h3>{ownerInfo.many}</h3>
      <ul class="list-none m-0 p-0">
        {owners.map((owner) => (
          <li key={owner.id}>
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
    <div>
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
    <div>
      <h2 class="mt-0 text-[color:var(--accent-dark)]">{(network.name as string) || '(unnamed)'} — Ports</h2>
      <table class="mt-3 w-full max-w-[800px] border-collapse">
        <thead>
          <tr>
            <th class="py-1.5 px-2.5 text-left border-b border-[var(--surface-hover)]">Port</th>
            <th class="py-1.5 px-2.5 text-left border-b border-[var(--surface-hover)]">Device</th>
            <th class="py-1.5 px-2.5 text-left border-b border-[var(--surface-hover)]">Status</th>
            <th class="py-1.5 px-2.5 text-left border-b border-[var(--surface-hover)]">Jack</th>
            <th class="py-1.5 px-2.5 text-left border-b border-[var(--surface-hover)]">Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: PortRow) => {
            const status = Schema.portStatus(row.device, row.info);
            const statusColor = status === 'faulty' ? 'text-[firebrick]' : status === 'free' ? 'text-[seagreen]' : '';
            return (
              <tr
                key={row.port}
                class={'cursor-pointer hover:bg-[var(--surface-hover)] ' + statusColor}
                onDblClick={() => {
                  Store.selectedKey.value = 'network:' + network.id + '/ports/' + row.port;
                }}
              >
                <td class="py-1.5 px-2.5 border-b border-[var(--surface-hover)]">{row.port}</td>
                <td class="py-1.5 px-2.5 border-b border-[var(--surface-hover)]">
                  {row.device ? entityLabel('devices', row.device) : ''}
                </td>
                <td class="py-1.5 px-2.5 border-b border-[var(--surface-hover)]">{portStatusLabel(status)}</td>
                <td class="py-1.5 px-2.5 border-b border-[var(--surface-hover)]">{row.info.jack || ''}</td>
                <td class="py-1.5 px-2.5 border-b border-[var(--surface-hover)]">{row.info.remark || ''}</td>
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

  const labelClass = FIELD_LABEL_CLASS;
  const valueClass = FIELD_VALUE_CLASS;
  const inputClass = FIELD_INPUT_CLASS;

  return (
    <div>
      <h2 class="mt-0 text-[color:var(--accent-dark)]">
        {(network.name as string) || '(unnamed)'} — Port {port}
      </h2>
      <table class="w-full max-w-[600px] border-collapse">
        <tbody>
          <tr>
            <td class={labelClass}>Device</td>
            <td class={valueClass}>
              <select
                class={inputClass}
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
            <td class={labelClass}>Status</td>
            <td class={valueClass}>
              <select
                class={inputClass}
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
            <td class={labelClass}>Jack</td>
            <td class={valueClass}>
              <input
                type="text"
                class={inputClass}
                value={row.info.jack || ''}
                onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
                  Store.setPortInfo(network.id as string, port, { jack: e.currentTarget.value });
                }}
              />
            </td>
          </tr>
          <tr>
            <td class={labelClass}>Remark</td>
            <td class={valueClass}>
              <input
                type="text"
                class={inputClass}
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
    <div>
      <h2 class="mt-0 text-[color:var(--accent-dark)]">{entityLabel(collectionKey, entity)}</h2>
      <table class="w-full max-w-[600px] border-collapse">
        <tbody>
          {fields.map((field) => (
            <tr key={field.key}>
              <td class={FIELD_LABEL_CLASS}>{field.label}</td>
              <td class={FIELD_VALUE_CLASS}>
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
        class="mt-4"
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
    <div>
      <p>Nothing to show yet.</p>
    </div>
  );
}

function ThemePicker(): JSX.Element {
  const pref = themePreference.value;
  const isOpen = themePopoverOpen.value;

  return (
    <div class="relative">
      <button
        class="flex h-[34px] w-[34px] items-center justify-center rounded-full border-none bg-[var(--surface)] p-0 text-base shadow-[0_1px_2px_rgba(0,0,0,0.15)] hover:bg-[var(--surface-sunk)]"
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
        <div
          class="absolute right-0 top-11 z-50 w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
          onClick={(e: Event) => e.stopPropagation()}
        >
          <h4 class="mb-2 mt-0 text-xs uppercase tracking-wide text-[color:var(--accent-dark)]">Accent color</h4>
          <div class="mb-3.5 flex flex-wrap gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                class={
                  'h-7 w-7 rounded-full border-2 border-[var(--border)] p-0' +
                  (pref.hue === preset.h
                    ? ' border-[color:var(--ink)] shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--accent)]'
                    : '')
                }
                title={preset.name}
                style={'background: hsl(' + preset.h + ' 68% 48%)'}
                onClick={() => {
                  setThemeHue(preset.h);
                }}
              ></button>
            ))}
          </div>
          <div class="mb-3.5 flex items-center gap-2">
            <span style="font-size: 12px">custom</span>
            <input
              class="flex-1"
              type="range"
              min="0"
              max="360"
              value={pref.hue}
              onInput={(e: Event & { currentTarget: HTMLInputElement }) => {
                setThemeHue(Number(e.currentTarget.value));
              }}
            />
          </div>
          <h4 class="mb-2 mt-0 text-xs uppercase tracking-wide text-[color:var(--accent-dark)]">Appearance</h4>
          <div class="flex overflow-hidden rounded-lg border border-[var(--border)]">
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <button
                key={mode}
                class={
                  'border-l border-l-[var(--border)] px-2.5 py-1 text-xs font-medium text-[color:var(--ink)] first:border-l-0' +
                  (pref.mode === mode ? ' bg-[var(--accent)] font-bold text-white' : ' bg-[var(--surface)]')
                }
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

const toolbarButtonClass =
  'rounded-full border-none bg-[var(--surface)] px-4 py-[7px] text-[13px] font-semibold text-[color:var(--accent-dark)] shadow-[0_1px_2px_rgba(0,0,0,0.15)] hover:bg-[var(--surface-sunk)]';

function Toolbar(): JSX.Element {
  return (
    <div class="flex items-center gap-2 border-b-[3px] border-[var(--accent-darker)] bg-gradient-to-b from-[var(--accent)] to-[var(--accent-dark)] px-3 py-2">
      <button class={toolbarButtonClass} onClick={doNew}>
        New
      </button>
      <button class={toolbarButtonClass} onClick={doSave}>
        Save
      </button>
      <button class={toolbarButtonClass} onClick={doSaveAs}>
        Save As…
      </button>
      <button class={toolbarButtonClass} onClick={triggerOpenFilePicker}>
        Open…
      </button>
      <button class={toolbarButtonClass} onClick={doExportExcel}>
        Export to Excel…
      </button>
      <input
        id="open-file-input"
        type="file"
        accept=".bestand,application/json"
        style="display: none"
        onChange={(e: Event & { currentTarget: HTMLInputElement }) => {
          doOpen(e.currentTarget.files?.[0] || null);
        }}
      />
      <span class="ml-3 font-semibold text-white/85">
        {Store.filename.value || '(unsaved)'}
        {Store.dirty.value ? ' •' : ''}
      </span>
      <span class="font-semibold text-white">{statusMessage.value}</span>
      <div class="ml-auto"></div>
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
    <div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div class="min-w-[320px] rounded-md bg-[var(--surface)] p-5 text-[color:var(--ink)] shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
        <h3 class="mt-0">{props.title}</h3>
        {props.children}
        <div class="mt-4 flex justify-end gap-2">
          {props.actions.map((action) => (
            <button
              key={action.label}
              class="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-[13px] font-semibold text-[color:var(--accent-dark)] hover:bg-[var(--surface-sunk)]"
              onClick={action.onClick}
            >
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
        class="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[color:var(--ink)]"
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
      <ul class="max-h-60 overflow-y-auto rounded bg-[var(--surface-sunk)] px-3 py-2 font-mono text-xs">
        {fields.map((field) => (
          <li key={field}>{field}</li>
        ))}
      </ul>
    </Modal>
  );
}

export default function App(): JSX.Element {
  attachGlobalListeners();

  return (
    <div class="flex h-screen flex-col">
      <Toolbar />
      <div class="flex min-h-0 flex-1">
        <div class="w-[280px] overflow-y-auto border-r-2 border-[var(--border)] bg-[var(--surface-sunk)] py-2">
          <Tree />
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-4">
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
