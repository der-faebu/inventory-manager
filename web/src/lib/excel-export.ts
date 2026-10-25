import XLSX from '../../../lib/xlsx.full.min.js';
import type { WorkBook, WorkSheet } from '../../../lib/xlsx.full.min.js';
import * as Schema from './schema.ts';
import type { CollectionKey, Document, Entity } from './schema.ts';

const SHEET_NAMES: Record<string, string> = {
  overview: 'Overview',
  tree: 'Tree',
  devices: 'Devices',
  users: 'Users',
  network: 'Network',
  applications: 'Applications',
  licenses: 'Licenses',
  monitors: 'Monitors',
  locations: 'Locations',
  rooms: 'Rooms',
  mailboxes: 'Mailboxes',
  ports: 'Ports',
};

const SHEET_GUIDE: [string, string][] = [
  ['Tree', 'Everything as a tree, like in the app. Collapse/expand with the outline +/- controls.'],
  ['Devices', 'Each device with its users, applications, licenses, monitors, and switch port.'],
  ['Users', 'Each user with their devices and licenses.'],
  ['Network', 'Switches, routers, firewalls, access points, with port counts.'],
  ['Applications', 'Each application and which devices it is installed on.'],
  ['Licenses', 'Each license and which users/devices it is assigned to.'],
  ['Monitors', 'All monitors and which device they are connected to.'],
  ['Locations', 'Locations with address and the devices there.'],
  ['Rooms', 'Rooms, grouped by location.'],
  ['Mailboxes', 'Shared mailboxes, resources, and distribution lists.'],
  ['Ports', 'Each switch port: which device, status.'],
];

function join(parts: unknown[], separator?: string): string {
  return parts.filter(Boolean).join(separator || '  ·  ');
}

function namesOf(doc: Document, collectionKey: CollectionKey, ids: string[] | undefined): string {
  return (ids || [])
    .map((id) => {
      const entity = doc[collectionKey].find((e) => e.id === id);
      return entity ? Schema.entityLabel(collectionKey, entity) : null;
    })
    .filter(Boolean)
    .join(', ');
}

function refLabel(doc: Document, collectionKey: CollectionKey, id: unknown): string {
  if (!id) {
    return '';
  }
  const entity = doc[collectionKey].find((e) => e.id === id);
  return entity ? Schema.entityLabel(collectionKey, entity) : '';
}

function relatedLabels(doc: Document, collectionKey: CollectionKey, predicate: (entity: Entity) => boolean): string {
  return doc[collectionKey]
    .filter(predicate)
    .map((entity) => Schema.entityLabel(collectionKey, entity))
    .join(', ');
}

function devicesOfUser(doc: Document, userId: unknown): string {
  return relatedLabels(doc, 'devices', (device) => ((device.users as string[]) || []).includes(userId as string));
}

function devicesWithApp(doc: Document, appId: unknown): string {
  return relatedLabels(doc, 'devices', (device) => ((device.apps as string[]) || []).includes(appId as string));
}

function usersWithLicense(doc: Document, licenseId: unknown): string {
  return relatedLabels(doc, 'users', (user) => ((user.lizenzen as string[]) || []).includes(licenseId as string));
}

function devicesWithLicense(doc: Document, licenseId: unknown): string {
  return relatedLabels(doc, 'devices', (device) => ((device.lizenzen as string[]) || []).includes(licenseId as string));
}

function devicesAtLocation(doc: Document, locationId: unknown): string {
  return relatedLabels(doc, 'devices', (device) => device.location === locationId);
}

function monitorsOfDevice(doc: Document, deviceId: unknown): string {
  return doc.monitors
    .filter((monitor) => monitor.device === deviceId)
    .map((monitor) => Schema.entityLabel('monitors', monitor))
    .join(', ');
}

function portInfoFor(doc: Document, networkId: string, port: number | string) {
  const networkPortInfo = doc.portInfo[networkId];
  return (networkPortInfo && networkPortInfo[String(port)]) || {};
}

interface PortRow {
  port: number;
  device: Entity | null;
  info: Schema.PortInfo;
}

function portsForNetwork(doc: Document, networkId: string): PortRow[] {
  const devicesOnNetwork = doc.devices.filter((device) => device.switch === networkId);
  const maxPortFromDevices = devicesOnNetwork.reduce(
    (max, device) => Math.max(max, parseInt(device.port as string, 10) || 0),
    0,
  );
  const network = doc.network.find((n) => n.id === networkId);
  const portCount = Math.max(parseInt(((network && (network.portCount as string)) || '0') as string, 10) || 0, maxPortFromDevices);

  const rows: PortRow[] = [];
  for (let p = 1; p <= portCount; p++) {
    const device = devicesOnNetwork.find((d) => d.port === String(p));
    rows.push({ port: p, device: device || null, info: portInfoFor(doc, networkId, p) });
  }
  return rows;
}

function portLabel(doc: Document, device: Entity): string {
  if (!device.switch) {
    return '';
  }
  return refLabel(doc, 'network', device.switch) + ' / Port ' + device.port;
}

function sheetFromAOA(rows: unknown[][]): WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

function setColumnWidths(sheet: WorkSheet, widths: number[]): void {
  sheet['!cols'] = widths.map((width) => ({ wch: width }));
}

function setAutofilter(sheet: WorkSheet, columnCount: number, rowCount: number): void {
  const lastCol = XLSX.utils.encode_col(columnCount - 1);
  sheet['!autofilter'] = { ref: 'A1:' + lastCol + rowCount };
}

// --- Overview sheet ---

function buildOverviewSheet(doc: Document): WorkSheet {
  const customerName = doc.customer.name || 'Customer';
  const rows: unknown[][] = [];
  rows.push(['Inventory – ' + customerName]);
  rows.push(['']);
  rows.push(['Customer details', '']);
  Schema.CUSTOMER_FIELDS.forEach((field) => {
    rows.push([field.label, (doc.customer as unknown as Record<string, string>)[field.key] || '']);
  });
  rows.push(['']);
  rows.push(['Summary', 'Count']);
  Schema.TREE_ORDER.forEach((key) => {
    rows.push([Schema.COLLECTIONS[key].many, doc[key].length]);
  });
  rows.push(['']);
  rows.push(['Sheet', 'What it contains']);
  SHEET_GUIDE.forEach((entry) => {
    rows.push(entry);
  });

  const sheet = sheetFromAOA(rows);
  setColumnWidths(sheet, [36, 90]);
  return sheet;
}

// --- Tree sheet ---

function buildTreeSheet(doc: Document): WorkSheet {
  const rows: unknown[][] = [['Structure', 'Details']];
  const levels: number[] = [0];

  function addRow(level: number, a: unknown, b?: unknown): void {
    rows.push([a, b || '']);
    levels.push(level);
  }

  function section(title: string): void {
    addRow(0, title, '');
  }

  Schema.TREE_ORDER.forEach((collectionKey) => {
    const info = Schema.COLLECTIONS[collectionKey];
    const entities = doc[collectionKey];
    section(info.many.toUpperCase() + ' (' + entities.length + ')');

    entities.forEach((entity) => {
      const label = Schema.entityLabel(collectionKey, entity);

      if (collectionKey === 'devices') {
        const summary = join([
          entity.type,
          entity.model,
          entity.serialNumber ? 'SN ' + entity.serialNumber : '',
          refLabel(doc, 'locations', entity.location),
          refLabel(doc, 'rooms', entity.room),
          entity.condition,
        ]);
        addRow(1, label, summary);
        addRow(2, 'Users', namesOf(doc, 'users', entity.users as string[]));
        addRow(2, 'Applications', namesOf(doc, 'applications', entity.apps as string[]));
        addRow(2, 'Licenses', namesOf(doc, 'licenses', entity.lizenzen as string[]));
        addRow(2, 'Monitors', monitorsOfDevice(doc, entity.id));
        addRow(2, 'Network connection', join([portLabel(doc, entity), entity.ip ? 'IP ' + entity.ip : '']));
      } else if (collectionKey === 'users') {
        const usersSummary = join([entity.department, entity.role, entity.email]);
        addRow(1, label, usersSummary);
        addRow(2, 'Devices', devicesOfUser(doc, entity.id));
        addRow(2, 'Licenses', namesOf(doc, 'licenses', entity.lizenzen as string[]));
      } else if (collectionKey === 'network') {
        const networkSummary = join([entity.category, entity.model, refLabel(doc, 'locations', entity.location)]);
        addRow(1, label, networkSummary);
        const ports = portsForNetwork(doc, entity.id as string);
        ports.forEach((row) => {
          const status = Schema.portStatus(row.device, row.info);
          addRow(2, 'Port ' + row.port, join([row.device ? Schema.entityLabel('devices', row.device) : '', status]));
        });
      } else if (collectionKey === 'applications') {
        addRow(1, label, join([entity.vendor, entity.licenseType]));
        addRow(2, 'Installed on', devicesWithApp(doc, entity.id));
      } else if (collectionKey === 'licenses') {
        addRow(1, label, join([entity.licenseType, entity.purchasedCount ? 'purchased ' + entity.purchasedCount : '']));
        addRow(2, 'Users', usersWithLicense(doc, entity.id));
        addRow(2, 'Devices', devicesWithLicense(doc, entity.id));
      } else if (collectionKey === 'locations') {
        addRow(1, label, entity.address);
        addRow(2, 'Devices', devicesAtLocation(doc, entity.id));
      } else if (collectionKey === 'rooms') {
        addRow(1, label, refLabel(doc, 'locations', entity.location));
      } else if (collectionKey === 'mailboxes') {
        addRow(1, label, join([entity.type, entity.owner, entity.hosting]));
      }
    });
  });

  const sheet = sheetFromAOA(rows);
  setColumnWidths(sheet, [34, 100]);
  sheet['!rows'] = levels.map((level) => (level ? { level } : undefined));
  sheet['!outline'] = { above: true };
  return sheet;
}

// --- Data sheets ---

function buildDataSheet(header: string[], rows: unknown[][], widths: number[]): WorkSheet {
  const sheet = sheetFromAOA([header, ...rows]);
  setColumnWidths(sheet, widths);
  setAutofilter(sheet, header.length, rows.length + 1);
  return sheet;
}

function buildDevicesSheet(doc: Document): WorkSheet {
  const header = [
    'Name',
    'Type',
    'Manufacturer / Model',
    'Serial number',
    'Location',
    'Room',
    'Users',
    'Applications',
    'Licenses',
    'Monitors',
    'Switch / Port',
    'IP address',
    'MAC address',
    'Delivery date',
    'Warranty until',
    'Condition',
    'Remark',
  ];
  const rows = doc.devices.map((device) => [
    Schema.entityLabel('devices', device),
    device.type,
    device.model,
    device.serialNumber,
    refLabel(doc, 'locations', device.location),
    refLabel(doc, 'rooms', device.room),
    namesOf(doc, 'users', device.users as string[]),
    namesOf(doc, 'applications', device.apps as string[]),
    namesOf(doc, 'licenses', device.lizenzen as string[]),
    monitorsOfDevice(doc, device.id),
    portLabel(doc, device),
    device.ip,
    device.mac,
    device.deliveryDate,
    device.warrantyUntil,
    device.condition,
    device.remark,
  ]);
  return buildDataSheet(header, rows, [20, 12, 24, 16, 16, 10, 24, 24, 24, 20, 18, 14, 16, 14, 14, 10, 24]);
}

function buildUsersSheet(doc: Document): WorkSheet {
  const header = ['Name', 'Username', 'Department', 'Role', 'Email', 'Devices', 'Licenses', 'MFA', 'Admin rights', 'Remark'];
  const rows = doc.users.map((user) => [
    Schema.entityLabel('users', user),
    user.login,
    user.department,
    user.role,
    user.email,
    devicesOfUser(doc, user.id),
    namesOf(doc, 'licenses', user.lizenzen as string[]),
    user.mfa,
    user.admin,
    user.remark,
  ]);
  return buildDataSheet(header, rows, [20, 16, 16, 16, 24, 24, 24, 8, 12, 24]);
}

function buildNetworkSheet(doc: Document): WorkSheet {
  const header = [
    'Name',
    'Category',
    'Manufacturer / Model',
    'Serial number',
    'IP address',
    'MAC address',
    'Firmware',
    'Location',
    'Room / Rack',
    'Total ports',
    'Uplink to',
    'Warranty / Support until',
    'Remark',
  ];
  const rows = doc.network.map((network) => [
    Schema.entityLabel('network', network),
    network.category,
    network.model,
    network.serialNumber,
    network.ip,
    network.mac,
    network.firmware,
    refLabel(doc, 'locations', network.location),
    network.rack,
    network.portCount,
    network.uplink,
    network.supportUntil,
    network.remark,
  ]);
  return buildDataSheet(header, rows, [20, 14, 24, 16, 14, 16, 12, 16, 14, 10, 16, 18, 24]);
}

function buildApplicationsSheet(doc: Document): WorkSheet {
  const header = ['Application', 'Version', 'Vendor', 'License type', 'Business-critical', 'Installed on'];
  const rows = doc.applications.map((application) => [
    Schema.entityLabel('applications', application),
    application.version,
    application.vendor,
    application.licenseType,
    application.businessCritical,
    devicesWithApp(doc, application.id),
  ]);
  return buildDataSheet(header, rows, [24, 12, 20, 16, 14, 30]);
}

function buildLicensesSheet(doc: Document): WorkSheet {
  const header = ['License type / Product', 'License type', 'Purchased (count)', 'Users', 'Devices', 'Term / Renewal', 'Remark'];
  const rows = doc.licenses.map((license) => [
    Schema.entityLabel('licenses', license),
    license.licenseType,
    license.purchasedCount,
    usersWithLicense(doc, license.id),
    devicesWithLicense(doc, license.id),
    license.term,
    license.remark,
  ]);
  return buildDataSheet(header, rows, [24, 16, 14, 24, 24, 20, 24]);
}

function buildMonitorsSheet(doc: Document): WorkSheet {
  const header = ['Inventory no.', 'Manufacturer / Model', 'Serial number', 'Connector', 'Connected to'];
  const rows = doc.monitors.map((monitor) => [
    Schema.entityLabel('monitors', monitor),
    monitor.model,
    monitor.serialNumber,
    monitor.connector,
    refLabel(doc, 'devices', monitor.device),
  ]);
  return buildDataSheet(header, rows, [16, 24, 16, 14, 20]);
}

function buildLocationsSheet(doc: Document): WorkSheet {
  const header = ['Name', 'Address', 'Rooms', 'Contact / Phone / Email', 'Server room / Rack', 'Devices'];
  const rows = doc.locations.map((location) => [
    Schema.entityLabel('locations', location),
    location.address,
    location.rooms,
    location.contact,
    location.serverRoom,
    devicesAtLocation(doc, location.id),
  ]);
  return buildDataSheet(header, rows, [20, 24, 10, 28, 20, 30]);
}

function buildRoomsSheet(doc: Document): WorkSheet {
  const header = ['Name', 'Location'];
  const rows = doc.rooms.map((room) => [Schema.entityLabel('rooms', room), refLabel(doc, 'locations', room.location)]);
  return buildDataSheet(header, rows, [20, 20]);
}

function buildMailboxesSheet(doc: Document): WorkSheet {
  const header = ['Email address', 'Type', 'Owner', 'Hosting'];
  const rows = doc.mailboxes.map((mailbox) => [Schema.entityLabel('mailboxes', mailbox), mailbox.type, mailbox.owner, mailbox.hosting]);
  return buildDataSheet(header, rows, [28, 18, 20, 12]);
}

function buildPortsSheet(doc: Document): WorkSheet {
  const header = ['Switch', 'Port', 'Connected device', 'Status', 'Jack', 'Remark'];
  const rows: unknown[][] = [];
  doc.network.forEach((network) => {
    const ports = portsForNetwork(doc, network.id as string);
    ports.forEach((row) => {
      const status = Schema.portStatus(row.device, row.info);
      rows.push([
        Schema.entityLabel('network', network),
        row.port,
        row.device ? Schema.entityLabel('devices', row.device) : '',
        status,
        row.info.jack || '',
        row.info.remark || '',
      ]);
    });
  });
  return buildDataSheet(header, rows, [20, 8, 20, 12, 14, 24]);
}

export function buildWorkbook(doc: Document): WorkBook {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildOverviewSheet(doc), SHEET_NAMES.overview);
  XLSX.utils.book_append_sheet(workbook, buildTreeSheet(doc), SHEET_NAMES.tree);
  XLSX.utils.book_append_sheet(workbook, buildDevicesSheet(doc), SHEET_NAMES.devices);
  XLSX.utils.book_append_sheet(workbook, buildUsersSheet(doc), SHEET_NAMES.users);
  XLSX.utils.book_append_sheet(workbook, buildNetworkSheet(doc), SHEET_NAMES.network);
  XLSX.utils.book_append_sheet(workbook, buildApplicationsSheet(doc), SHEET_NAMES.applications);
  XLSX.utils.book_append_sheet(workbook, buildLicensesSheet(doc), SHEET_NAMES.licenses);
  XLSX.utils.book_append_sheet(workbook, buildMonitorsSheet(doc), SHEET_NAMES.monitors);
  XLSX.utils.book_append_sheet(workbook, buildLocationsSheet(doc), SHEET_NAMES.locations);
  XLSX.utils.book_append_sheet(workbook, buildRoomsSheet(doc), SHEET_NAMES.rooms);
  XLSX.utils.book_append_sheet(workbook, buildMailboxesSheet(doc), SHEET_NAMES.mailboxes);
  XLSX.utils.book_append_sheet(workbook, buildPortsSheet(doc), SHEET_NAMES.ports);
  return workbook;
}

export function writeBuffer(workbook: WorkBook): ArrayBuffer {
  // No cellStyles: v1 intentionally ships with no custom cell styling (see issue #16).
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}
