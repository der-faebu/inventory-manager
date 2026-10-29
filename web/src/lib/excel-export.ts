import ExcelJS from 'exceljs';
import type { Style, Worksheet } from 'exceljs';
import * as Schema from './schema.ts';
import type { CollectionKey, Document, Entity } from './schema.ts';

type CellValue = string | number | boolean | null | undefined;

interface Column<T> {
  header: string;
  width: number;
  value: (row: T) => CellValue;
}

// --- Styles ---

const NAVY = 'FF1F3A5F';
const BORDER_SIDE = { style: 'thin', color: { argb: 'FFD0D7DE' } } as const;
const BORDER = { top: BORDER_SIDE, bottom: BORDER_SIDE, left: BORDER_SIDE, right: BORDER_SIDE };

function solid(argb: string): Style['fill'] {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

const STYLES = {
  title: { font: { bold: true, size: 16, color: { argb: NAVY } } },
  plain: {},
  header: {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: solid(NAVY),
    alignment: { vertical: 'middle', wrapText: true },
    border: BORDER,
  },
  body: { alignment: { vertical: 'top', horizontal: 'left', wrapText: true }, border: BORDER },
  bodyAlt: {
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true },
    border: BORDER,
    fill: solid('FFF3F6FA'),
  },
  label: { font: { bold: true }, alignment: { vertical: 'top', wrapText: true }, border: BORDER },
  section: { font: { bold: true, color: { argb: NAVY } }, fill: solid('FFDCE6F2'), border: BORDER },
  detailLabel: {
    font: { color: { argb: 'FF57606A' } },
    alignment: { vertical: 'top', indent: 1 },
    border: BORDER,
  },
} satisfies Record<string, Partial<Style>>;

type StyleName = keyof typeof STYLES;

// --- Relationship lookups ---

function join(parts: unknown[], separator = '  ·  '): string {
  return parts.filter(Boolean).join(separator);
}

function labelsWhere(doc: Document, key: CollectionKey, predicate: (entity: Entity) => boolean): string {
  return doc[key]
    .filter(predicate)
    .map((entity) => Schema.entityLabel(key, entity))
    .join(', ');
}

/** Labels of the entities in `key` whose ids appear in `ids`. */
function linked(doc: Document, key: CollectionKey, ids: unknown): string {
  const wanted = (ids as string[] | undefined) || [];
  return labelsWhere(doc, key, (entity) => wanted.includes(entity.id as string));
}

/** Labels of the entities in `key` whose `field` (an id list) contains `id`. */
function holding(doc: Document, key: CollectionKey, field: string, id: unknown): string {
  return labelsWhere(doc, key, (entity) => ((entity[field] as string[]) || []).includes(id as string));
}

function refLabel(doc: Document, key: CollectionKey, id: unknown): string {
  return id ? labelsWhere(doc, key, (entity) => entity.id === id) : '';
}

function monitorsOf(doc: Document, device: Entity): string {
  return labelsWhere(doc, 'monitors', (monitor) => monitor.device === device.id);
}

function devicesAt(doc: Document, location: Entity): string {
  return labelsWhere(doc, 'devices', (device) => device.location === location.id);
}

function portLabel(doc: Document, device: Entity): string {
  return device.switch ? refLabel(doc, 'network', device.switch) + ' / Port ' + device.port : '';
}

interface PortRow {
  port: number;
  device: Entity | null;
  info: Schema.PortInfo;
}

function portsForNetwork(doc: Document, network: Entity): PortRow[] {
  const devicesOnNetwork = doc.devices.filter((device) => device.switch === network.id);
  const highestUsed = Math.max(0, ...devicesOnNetwork.map((device) => parseInt(device.port as string, 10) || 0));
  const portCount = Math.max(parseInt(network.portCount as string, 10) || 0, highestUsed);
  const infoByPort = doc.portInfo[network.id as string] || {};

  return Array.from({ length: portCount }, (_, i) => ({
    port: i + 1,
    device: devicesOnNetwork.find((device) => device.port === String(i + 1)) || null,
    info: infoByPort[String(i + 1)] || {},
  }));
}

// --- Sheet writers ---

function setWidths(sheet: Worksheet, widths: number[]): void {
  widths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });
}

function styleRow(sheet: Worksheet, rowNumber: number, styles: StyleName[]): void {
  const row = sheet.getRow(rowNumber);
  styles.forEach((style, i) => {
    row.getCell(i + 1).style = STYLES[style];
  });
}

/** A filterable table with a frozen, styled header row and zebra-striped body. */
function addTable<T>(workbook: ExcelJS.Workbook, name: string, columns: Column<T>[], rows: T[]): void {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  setWidths(sheet, columns.map((column) => column.width));

  sheet.addRow(columns.map((column) => column.header));
  rows.forEach((row) => sheet.addRow(columns.map((column) => column.value(row))));

  styleRow(sheet, 1, columns.map(() => 'header'));
  sheet.getRow(1).height = 24;
  rows.forEach((_, i) => {
    styleRow(sheet, i + 2, columns.map(() => (i % 2 ? 'bodyAlt' : 'body')));
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
}

function entityColumns(defs: [header: string, width: number, value: (entity: Entity) => CellValue][]): Column<Entity>[] {
  return defs.map(([header, width, value]) => ({ header, width, value }));
}

interface LabeledRow {
  cells: [CellValue, CellValue];
  styles: [StyleName, StyleName];
  level?: number;
}

/** A two-column sheet whose styling (and outline level) is given by the rows themselves. */
function addLabeledSheet(workbook: ExcelJS.Workbook, name: string, widths: number[], rows: LabeledRow[]): Worksheet {
  const sheet = workbook.addWorksheet(name);
  setWidths(sheet, widths);
  rows.forEach((entry, i) => {
    sheet.addRow(entry.cells);
    styleRow(sheet, i + 1, entry.styles);
    if (entry.level) {
      sheet.getRow(i + 1).outlineLevel = entry.level;
    }
  });
  return sheet;
}

// --- Overview ---

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

function addOverviewSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  const customer = doc.customer as unknown as Record<string, string>;
  const spacer: LabeledRow = { cells: ['', ''], styles: ['plain', 'plain'] };
  const header = (a: string, b: string): LabeledRow => ({ cells: [a, b], styles: ['header', 'header'] });
  const body = (a: CellValue, b: CellValue): LabeledRow => ({ cells: [a, b], styles: ['label', 'body'] });

  addLabeledSheet(workbook, 'Overview', [36, 90], [
    { cells: ['Inventory – ' + (doc.customer.name || 'Customer'), ''], styles: ['title', 'plain'] },
    spacer,
    header('Customer details', ''),
    ...Schema.CUSTOMER_FIELDS.map((field) => body(field.label, customer[field.key] || '')),
    spacer,
    header('Summary', 'Count'),
    ...Schema.TREE_ORDER.map((key) => body(Schema.COLLECTIONS[key].many, doc[key].length)),
    spacer,
    header('Sheet', 'What it contains'),
    ...SHEET_GUIDE.map(([sheetName, description]) => body(sheetName, description)),
  ]);
}

// --- Tree ---

interface TreeNode {
  summary: string;
  children: [label: string, value: string][];
}

const TREE_NODES: Record<(typeof Schema.TREE_ORDER)[number], (doc: Document, entity: Entity) => TreeNode> = {
  devices: (doc, device) => ({
    summary: join([
      device.type,
      device.model,
      device.serialNumber ? 'SN ' + device.serialNumber : '',
      refLabel(doc, 'locations', device.location),
      refLabel(doc, 'rooms', device.room),
      device.condition,
    ]),
    children: [
      ['Users', linked(doc, 'users', device.users)],
      ['Applications', linked(doc, 'applications', device.apps)],
      ['Licenses', linked(doc, 'licenses', device.lizenzen)],
      ['Monitors', monitorsOf(doc, device)],
      ['Network connection', join([portLabel(doc, device), device.ip ? 'IP ' + device.ip : ''])],
    ],
  }),
  users: (doc, user) => ({
    summary: join([user.department, user.role, user.email]),
    children: [
      ['Devices', holding(doc, 'devices', 'users', user.id)],
      ['Licenses', linked(doc, 'licenses', user.lizenzen)],
    ],
  }),
  network: (doc, network) => ({
    summary: join([network.category, network.model, refLabel(doc, 'locations', network.location)]),
    children: portsForNetwork(doc, network).map((row): [string, string] => [
      'Port ' + row.port,
      join([row.device ? Schema.entityLabel('devices', row.device) : '', Schema.portStatus(row.device, row.info)]),
    ]),
  }),
  applications: (doc, application) => ({
    summary: join([application.vendor, application.licenseType]),
    children: [['Installed on', holding(doc, 'devices', 'apps', application.id)]],
  }),
  licenses: (doc, license) => ({
    summary: join([license.licenseType, license.purchasedCount ? 'purchased ' + license.purchasedCount : '']),
    children: [
      ['Users', holding(doc, 'users', 'lizenzen', license.id)],
      ['Devices', holding(doc, 'devices', 'lizenzen', license.id)],
    ],
  }),
  locations: (doc, location) => ({
    summary: String(location.address || ''),
    children: [['Devices', devicesAt(doc, location)]],
  }),
  rooms: (doc, room) => ({ summary: refLabel(doc, 'locations', room.location), children: [] }),
  mailboxes: (_doc, mailbox) => ({ summary: join([mailbox.type, mailbox.owner, mailbox.hosting]), children: [] }),
};

function addTreeSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  const rows: LabeledRow[] = [{ cells: ['Structure', 'Details'], styles: ['header', 'header'] }];

  Schema.TREE_ORDER.forEach((key) => {
    const entities = doc[key];
    const title = Schema.COLLECTIONS[key].many.toUpperCase() + ' (' + entities.length + ')';
    rows.push({ cells: [title, ''], styles: ['section', 'section'] });

    entities.forEach((entity) => {
      const node = TREE_NODES[key](doc, entity);
      rows.push({ cells: [Schema.entityLabel(key, entity), node.summary], styles: ['label', 'body'], level: 1 });
      node.children.forEach(([label, value]) => {
        rows.push({ cells: [label, value], styles: ['detailLabel', 'body'], level: 2 });
      });
    });
  });

  const sheet = addLabeledSheet(workbook, 'Tree', [34, 100], rows);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.properties.outlineProperties = { summaryBelow: false, summaryRight: false };
}

// --- Data sheets ---

function addDevicesSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Devices', entityColumns([
    ['Name', 20, (d) => Schema.entityLabel('devices', d)],
    ['Type', 12, (d) => d.type as string],
    ['Manufacturer / Model', 24, (d) => d.model as string],
    ['Serial number', 16, (d) => d.serialNumber as string],
    ['Location', 16, (d) => refLabel(doc, 'locations', d.location)],
    ['Room', 10, (d) => refLabel(doc, 'rooms', d.room)],
    ['Users', 24, (d) => linked(doc, 'users', d.users)],
    ['Applications', 24, (d) => linked(doc, 'applications', d.apps)],
    ['Licenses', 24, (d) => linked(doc, 'licenses', d.lizenzen)],
    ['Monitors', 20, (d) => monitorsOf(doc, d)],
    ['Switch / Port', 18, (d) => portLabel(doc, d)],
    ['IP address', 14, (d) => d.ip as string],
    ['MAC address', 16, (d) => d.mac as string],
    ['Delivery date', 14, (d) => d.deliveryDate as string],
    ['Warranty until', 14, (d) => d.warrantyUntil as string],
    ['Condition', 10, (d) => d.condition as string],
    ['Remark', 24, (d) => d.remark as string],
  ]), doc.devices);
}

function addUsersSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Users', entityColumns([
    ['Name', 20, (u) => Schema.entityLabel('users', u)],
    ['Username', 16, (u) => u.login as string],
    ['Department', 16, (u) => u.department as string],
    ['Role', 16, (u) => u.role as string],
    ['Email', 24, (u) => u.email as string],
    ['Devices', 24, (u) => holding(doc, 'devices', 'users', u.id)],
    ['Licenses', 24, (u) => linked(doc, 'licenses', u.lizenzen)],
    ['MFA', 8, (u) => u.mfa as string],
    ['Admin rights', 12, (u) => u.admin as string],
    ['Remark', 24, (u) => u.remark as string],
  ]), doc.users);
}

function addNetworkSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Network', entityColumns([
    ['Name', 20, (n) => Schema.entityLabel('network', n)],
    ['Category', 14, (n) => n.category as string],
    ['Manufacturer / Model', 24, (n) => n.model as string],
    ['Serial number', 16, (n) => n.serialNumber as string],
    ['IP address', 14, (n) => n.ip as string],
    ['MAC address', 16, (n) => n.mac as string],
    ['Firmware', 12, (n) => n.firmware as string],
    ['Location', 16, (n) => refLabel(doc, 'locations', n.location)],
    ['Room / Rack', 14, (n) => n.rack as string],
    ['Total ports', 10, (n) => n.portCount as string],
    ['Uplink to', 16, (n) => n.uplink as string],
    ['Warranty / Support until', 18, (n) => n.supportUntil as string],
    ['Remark', 24, (n) => n.remark as string],
  ]), doc.network);
}

function addApplicationsSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Applications', entityColumns([
    ['Application', 24, (a) => Schema.entityLabel('applications', a)],
    ['Version', 12, (a) => a.version as string],
    ['Vendor', 20, (a) => a.vendor as string],
    ['License type', 16, (a) => a.licenseType as string],
    ['Business-critical', 14, (a) => a.businessCritical as string],
    ['Installed on', 30, (a) => holding(doc, 'devices', 'apps', a.id)],
  ]), doc.applications);
}

function addLicensesSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Licenses', entityColumns([
    ['License type / Product', 24, (l) => Schema.entityLabel('licenses', l)],
    ['License type', 16, (l) => l.licenseType as string],
    ['Purchased (count)', 14, (l) => l.purchasedCount as string],
    ['Users', 24, (l) => holding(doc, 'users', 'lizenzen', l.id)],
    ['Devices', 24, (l) => holding(doc, 'devices', 'lizenzen', l.id)],
    ['Term / Renewal', 20, (l) => l.term as string],
    ['Remark', 24, (l) => l.remark as string],
  ]), doc.licenses);
}

function addMonitorsSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Monitors', entityColumns([
    ['Inventory no.', 16, (m) => Schema.entityLabel('monitors', m)],
    ['Manufacturer / Model', 24, (m) => m.model as string],
    ['Serial number', 16, (m) => m.serialNumber as string],
    ['Connector', 14, (m) => m.connector as string],
    ['Connected to', 20, (m) => refLabel(doc, 'devices', m.device)],
  ]), doc.monitors);
}

function addLocationsSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Locations', entityColumns([
    ['Name', 20, (l) => Schema.entityLabel('locations', l)],
    ['Address', 24, (l) => l.address as string],
    ['Rooms', 10, (l) => l.rooms as string],
    ['Contact / Phone / Email', 28, (l) => l.contact as string],
    ['Server room / Rack', 20, (l) => l.serverRoom as string],
    ['Devices', 30, (l) => devicesAt(doc, l)],
  ]), doc.locations);
}

function addRoomsSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Rooms', entityColumns([
    ['Name', 20, (r) => Schema.entityLabel('rooms', r)],
    ['Location', 20, (r) => refLabel(doc, 'locations', r.location)],
  ]), doc.rooms);
}

function addMailboxesSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  addTable(workbook, 'Mailboxes', entityColumns([
    ['Email address', 28, (m) => Schema.entityLabel('mailboxes', m)],
    ['Type', 18, (m) => m.type as string],
    ['Owner', 20, (m) => m.owner as string],
    ['Hosting', 12, (m) => m.hosting as string],
  ]), doc.mailboxes);
}

function addPortsSheet(workbook: ExcelJS.Workbook, doc: Document): void {
  type SwitchPort = PortRow & { network: Entity };
  const rows: SwitchPort[] = doc.network.flatMap((network) =>
    portsForNetwork(doc, network).map((row) => ({ ...row, network })),
  );
  const columns: Column<SwitchPort>[] = [
    { header: 'Switch', width: 20, value: (r) => Schema.entityLabel('network', r.network) },
    { header: 'Port', width: 8, value: (r) => r.port },
    { header: 'Connected device', width: 20, value: (r) => (r.device ? Schema.entityLabel('devices', r.device) : '') },
    { header: 'Status', width: 12, value: (r) => Schema.portStatus(r.device, r.info) },
    { header: 'Jack', width: 14, value: (r) => r.info.jack },
    { header: 'Remark', width: 24, value: (r) => r.info.remark },
  ];
  addTable(workbook, 'Ports', columns, rows);
}

export function buildWorkbook(doc: Document): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  addOverviewSheet(workbook, doc);
  addTreeSheet(workbook, doc);
  addDevicesSheet(workbook, doc);
  addUsersSheet(workbook, doc);
  addNetworkSheet(workbook, doc);
  addApplicationsSheet(workbook, doc);
  addLicensesSheet(workbook, doc);
  addMonitorsSheet(workbook, doc);
  addLocationsSheet(workbook, doc);
  addRoomsSheet(workbook, doc);
  addMailboxesSheet(workbook, doc);
  addPortsSheet(workbook, doc);
  return workbook;
}

export async function writeBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}
