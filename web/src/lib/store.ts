import { signal, computed, effect } from '@preact/signals-core';
import * as Schema from './schema.ts';
import type { Association, CollectionKey, Document, Entity, PortInfo } from './schema.ts';

const AUTOSAVE_KEY = 'inventory-manager.autosave';

interface AutosaveSnapshot {
  document: Document;
  selectedKey?: string;
  filename?: string | null;
}

function loadAutosave(): AutosaveSnapshot | null {
  try {
    const stored = JSON.parse(globalThis.localStorage.getItem(AUTOSAVE_KEY) as string) as AutosaveSnapshot | null;
    if (stored && stored.document) {
      return stored;
    }
  } catch {
    // ignore corrupt autosave
  }
  return null;
}

const autosaved = loadAutosave();

export const document = signal<Document>(
  autosaved ? Schema.normalizeDocument(autosaved.document) : Schema.emptyDocument(),
);
export const revision = signal(autosaved ? 1 : 0);
export const lastSavedRevision = signal(0);
export const dirty = computed(() => revision.value !== lastSavedRevision.value);

export const selectedKey = signal(autosaved ? autosaved.selectedKey || 'customer' : 'customer');
export const filename = signal<string | null>(autosaved ? autosaved.filename || null : null);

effect(() => {
  const snapshot: AutosaveSnapshot = {
    document: document.value,
    selectedKey: selectedKey.value,
    filename: filename.value,
  };
  try {
    globalThis.localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
  } catch {
    // storage unavailable or quota exceeded; autosave is best-effort
  }
});

export function bumpRevision(): void {
  revision.value = revision.value + 1;
}

export function markSaved(usedFilename?: string): void {
  lastSavedRevision.value = revision.value;
  if (usedFilename) {
    filename.value = usedFilename;
  }
}

export function resetDocument(): void {
  document.value = Schema.emptyDocument();
  revision.value = 0;
  lastSavedRevision.value = 0;
  selectedKey.value = 'customer';
  filename.value = null;
}

export function loadDocument(doc: Document | Record<string, unknown>, loadedFilename: string | null): void {
  document.value = Schema.normalizeDocument(doc);
  revision.value = 0;
  lastSavedRevision.value = 0;
  selectedKey.value = 'customer';
  filename.value = loadedFilename;
}

export function updateCustomer(patch: Partial<Document['customer']>): void {
  document.value = Object.assign({}, document.value, {
    customer: Object.assign({}, document.value.customer, patch),
  });
  bumpRevision();
}

export function addEntity(collectionKey: CollectionKey, overrides?: Partial<Entity>): Entity {
  const entity = Object.assign({ id: Schema.makeId() }, Schema.emptyEntity(collectionKey), overrides || {});
  const patch = { [collectionKey]: document.value[collectionKey].concat([entity]) };
  document.value = Object.assign({}, document.value, patch);
  bumpRevision();
  return entity;
}

export function updateEntity(collectionKey: CollectionKey, id: string, patch: Partial<Entity>): void {
  const collectionPatch = {
    [collectionKey]: document.value[collectionKey].map((entity) =>
      entity.id === id ? Object.assign({}, entity, patch) : entity,
    ),
  };
  document.value = Object.assign({}, document.value, collectionPatch);
  bumpRevision();
}

export function deleteEntity(collectionKey: CollectionKey, id: string): void {
  const patch: Partial<Schema.Document> = {
    [collectionKey]: document.value[collectionKey].filter((entity) => entity.id !== id),
  };
  Schema.ASSOCIATIONS.filter((association) => association.targetCollection === collectionKey).forEach((association) => {
    const owners = patch[association.ownerCollection] || document.value[association.ownerCollection];
    patch[association.ownerCollection] = owners.map((owner) => {
      const linked = (owner[association.fieldKey] as string[]) || [];
      return linked.includes(id) ? { ...owner, [association.fieldKey]: linked.filter((linkedId) => linkedId !== id) } : owner;
    });
  });
  document.value = Object.assign({}, document.value, patch);
  if (selectedKey.value === collectionKey + ':' + id) {
    selectedKey.value = collectionKey;
  }
  bumpRevision();
}

export function addDevice(): Entity {
  return addEntity('devices');
}

function clearDeviceFromPort(networkId: string, port: number | string, exceptDeviceId: string | null): void {
  document.value.devices.forEach((device) => {
    if (device.id !== exceptDeviceId && device.switch === networkId && device.port === String(port)) {
      updateEntity('devices', device.id as string, { switch: '', port: '' });
    }
  });
}

export function updateDevice(id: string, patch: Partial<Entity>): void {
  updateEntity('devices', id, patch);
}

export function getPortInfo(networkId: string, port: number | string): PortInfo {
  const all = document.value.portInfo[networkId];
  return (all && all[String(port)]) || {};
}

export function setPortInfo(networkId: string, port: number | string, patch: Partial<PortInfo>): void {
  const networkPortInfo = Object.assign({}, document.value.portInfo[networkId]);
  networkPortInfo[String(port)] = Object.assign({}, networkPortInfo[String(port)], patch);
  const portInfoPatch = Object.assign({}, document.value.portInfo);
  portInfoPatch[networkId] = networkPortInfo;
  document.value = Object.assign({}, document.value, { portInfo: portInfoPatch });
  bumpRevision();
}

export function assignDevicePort(networkId: string, port: number | string, deviceId: string | null): void {
  clearDeviceFromPort(networkId, port, deviceId || null);
  if (deviceId) {
    updateEntity('devices', deviceId, { switch: networkId, port: String(port) });
  }
}

export interface PortRow {
  port: number;
  device: Entity | null;
  info: PortInfo;
}

export function getPortsForNetwork(networkId: string): PortRow[] {
  const devicesOnNetwork = document.value.devices.filter((device) => device.switch === networkId);
  const maxPortFromDevices = devicesOnNetwork.reduce(
    (max, device) => Math.max(max, parseInt(device.port as string, 10) || 0),
    0,
  );
  const network = document.value.network.find((n) => n.id === networkId);
  const portCount = Math.max(
    parseInt(((network && (network.portCount as string)) || '0') as string, 10) || 0,
    maxPortFromDevices,
  );

  const rows: PortRow[] = [];
  for (let p = 1; p <= portCount; p++) {
    rows.push(getPortRow(networkId, p, devicesOnNetwork));
  }
  return rows;
}

export function getPortRow(networkId: string, port: number, devicesOnNetwork?: Entity[]): PortRow {
  const candidates = devicesOnNetwork || document.value.devices.filter((device) => device.switch === networkId);
  const device = candidates.find((d) => d.port === String(port));
  return { port, device: device || null, info: getPortInfo(networkId, port) };
}

export function deleteDevice(id: string): void {
  deleteEntity('devices', id);
}

export function addMonitorForDevice(deviceId: string): Entity {
  return addEntity('monitors', { device: deviceId });
}

export function toggleAssociation(association: Association, ownerId: string, targetId: string): void {
  const owner = document.value[association.ownerCollection].find((entity) => entity.id === ownerId) as Entity;
  const current = (owner[association.fieldKey] as string[]) || [];
  const next = current.includes(targetId) ? current.filter((id) => id !== targetId) : current.concat([targetId]);
  updateEntity(association.ownerCollection, ownerId, { [association.fieldKey]: next });
}

export function addEntityAssociated(association: Association, ownerId: string, overrides?: Partial<Entity>): Entity {
  const entity = addEntity(association.targetCollection, overrides);
  toggleAssociation(association, ownerId, entity.id as string);
  return entity;
}

export function addOwnerAssociated(association: Association, targetId: string, overrides?: Partial<Entity>): Entity {
  const entity = addEntity(association.ownerCollection, overrides);
  toggleAssociation(association, entity.id as string, targetId);
  return entity;
}
