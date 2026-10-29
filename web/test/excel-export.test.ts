import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import * as ExcelExport from '../src/lib/excel-export.ts';
import * as Schema from '../src/lib/schema.ts';
import type { Document } from '../src/lib/schema.ts';

function docWithOneOfEach(): Document {
  const doc = Schema.emptyDocument();
  doc.customer = { name: 'Acme', number: '1', contact: 'Jane', date: '01.01.2026', takenBy: 'Bob', version: '1' };

  const location = Object.assign({ id: 'loc1' }, Schema.emptyEntity('locations'), { name: 'HQ' });
  doc.locations.push(location);

  const network = Object.assign({ id: 'net1' }, Schema.emptyEntity('network'), { name: 'Switch-1', portCount: '2' });
  doc.network.push(network);

  const user = Object.assign({ id: 'u1' }, Schema.emptyEntity('users'), { name: 'Doe John' });
  doc.users.push(user);

  const app = Object.assign({ id: 'a1' }, Schema.emptyEntity('applications'), { name: 'App1' });
  doc.applications.push(app);

  const license = Object.assign({ id: 'l1' }, Schema.emptyEntity('licenses'), { product: 'Office' });
  doc.licenses.push(license);

  const device = Object.assign({ id: 'dev1' }, Schema.emptyEntity('devices'), {
    name: 'PC-1',
    switch: 'net1',
    port: '1',
    users: [user.id],
    apps: [app.id],
    lizenzen: [license.id],
  });
  doc.devices.push(device);

  const monitor = Object.assign({ id: 'mo1' }, Schema.emptyEntity('monitors'), {
    inventoryNumber: 'INV1',
    device: device.id,
  });
  doc.monitors.push(monitor);

  const mailbox = Object.assign({ id: 'm1' }, Schema.emptyEntity('mailboxes'), { address: 'info@example.com' });
  doc.mailboxes.push(mailbox);

  doc.portInfo = { net1: { '1': { status: '', jack: 'J1', remark: '' }, '2': { status: 'faulty', jack: '', remark: '' } } };

  return doc;
}

function sheetNames(workbook: ExcelJS.Workbook): string[] {
  return workbook.worksheets.map((sheet) => sheet.name);
}

function sheetText(workbook: ExcelJS.Workbook, name: string): string {
  const lines: string[] = [];
  workbook.getWorksheet(name)!.eachRow((row) => {
    lines.push((row.values as unknown[]).slice(1).join(' | '));
  });
  return lines.join('\n');
}

function sheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  return workbook.getWorksheet(name)!;
}

test('buildWorkbook produces sheets in the required order', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());

  assert.deepEqual(sheetNames(workbook), [
    'Overview',
    'Tree',
    'Devices',
    'Users',
    'Network',
    'Applications',
    'Licenses',
    'Monitors',
    'Locations',
    'Rooms',
    'Mailboxes',
    'Ports',
  ]);
});

test('Overview sheet has column widths and no autofilter', () => {
  const overview = sheet(ExcelExport.buildWorkbook(docWithOneOfEach()), 'Overview');

  assert.ok(overview.getColumn(1).width! > 0);
  assert.ok(!overview.autoFilter);
});

test('Overview sheet includes customer details and per-collection counts', () => {
  const text = sheetText(ExcelExport.buildWorkbook(docWithOneOfEach()), 'Overview');

  assert.ok(text.includes('Acme'));
  assert.ok(/Devices \| 1/.test(text));
});

test('Tree sheet has outline levels, a frozen header and column widths, no autofilter', () => {
  const tree = sheet(ExcelExport.buildWorkbook(docWithOneOfEach()), 'Tree');

  assert.ok(tree.getColumn(1).width! > 0);
  assert.ok(!tree.autoFilter);
  assert.equal(tree.views[0].state, 'frozen');

  const levels = new Set<number>();
  tree.eachRow((row) => levels.add(row.outlineLevel || 0));
  assert.deepEqual([...levels].sort(), [0, 1, 2]);
});

test('Tree sheet reflects device associations and switch/port assignment', () => {
  const text = sheetText(ExcelExport.buildWorkbook(docWithOneOfEach()), 'Tree');

  assert.ok(text.includes('PC-1'));
  assert.ok(text.includes('Doe John'));
  assert.ok(text.includes('App1'));
  assert.ok(text.includes('Office'));
  assert.ok(text.includes('Switch-1'));
});

test('each data sheet has column widths, an autofilter and a frozen styled header', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const dataSheetNames = ['Devices', 'Users', 'Network', 'Applications', 'Licenses', 'Monitors', 'Locations', 'Rooms', 'Mailboxes', 'Ports'];

  dataSheetNames.forEach((name) => {
    const data = sheet(workbook, name);
    assert.ok(data.getColumn(1).width! > 0, name + ' should have column widths');
    assert.ok(data.autoFilter, name + ' should have an autofilter');
    assert.equal(data.views[0].state, 'frozen', name + ' should freeze the header');
    assert.equal(data.getCell('A1').font?.bold, true, name + ' should have a bold header');
  });
});

test('Devices sheet shows assigned users/apps/licenses and switch/port', () => {
  const text = sheetText(ExcelExport.buildWorkbook(docWithOneOfEach()), 'Devices');

  assert.ok(text.includes('PC-1'));
  assert.ok(text.includes('Doe John'));
  assert.ok(text.includes('App1'));
  assert.ok(text.includes('Office'));
  assert.ok(text.includes('Switch-1 / Port 1'));
});

test('Ports sheet lists one row per port with status and device', () => {
  const ports = sheet(ExcelExport.buildWorkbook(docWithOneOfEach()), 'Ports');

  assert.equal(ports.rowCount, 3);
  const text = sheetText(ExcelExport.buildWorkbook(docWithOneOfEach()), 'Ports');
  assert.ok(text.includes('PC-1'));
  assert.ok(text.includes('faulty'));
});

test('buildWorkbook writes to a binary array and reads back with the same sheets', async () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const binary = await ExcelExport.writeBuffer(workbook);

  const readBack = new ExcelJS.Workbook();
  await readBack.xlsx.load(binary);
  assert.deepEqual(sheetNames(readBack), sheetNames(workbook));
  assert.equal(sheet(readBack, 'Devices').views[0].state, 'frozen');
});

test('buildWorkbook handles an empty document without throwing', () => {
  const workbook = ExcelExport.buildWorkbook(Schema.emptyDocument());
  assert.equal(workbook.worksheets.length, 12);
});
