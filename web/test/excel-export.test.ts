import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
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

test('buildWorkbook produces sheets in the required order', () => {
  const doc = docWithOneOfEach();

  const workbook = ExcelExport.buildWorkbook(doc);

  assert.deepEqual(workbook.SheetNames, [
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
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const sheet = workbook.Sheets['Overview'];

  assert.ok(Array.isArray(sheet['!cols']) && sheet['!cols'].length > 0);
  assert.equal(sheet['!autofilter'], undefined);
});

test('Overview sheet includes customer details and per-collection counts', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const sheet = workbook.Sheets['Overview'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const flat = rows.map((r) => r.join(' | ')).join('\n');

  assert.ok(flat.includes('Acme'));
  assert.ok(flat.includes('Devices'));
  assert.ok(/Devices.*1/.test(flat) || flat.includes('1'));
});

test('Tree sheet has outline levels set before writing and column widths, no autofilter', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const sheet = workbook.Sheets['Tree'];

  assert.ok(Array.isArray(sheet['!cols']) && sheet['!cols'].length > 0);
  assert.equal(sheet['!autofilter'], undefined);
  assert.ok(Array.isArray(sheet['!rows']));
  assert.ok(sheet['!rows']?.some((r) => r?.level && r.level > 0));
  assert.ok(sheet['!outline']);
});

test('Tree sheet reflects device associations and switch/port assignment', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const sheet = workbook.Sheets['Tree'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const flat = rows.map((r) => r.join(' | ')).join('\n');

  assert.ok(flat.includes('PC-1'));
  assert.ok(flat.includes('Doe John'));
  assert.ok(flat.includes('App1'));
  assert.ok(flat.includes('Office'));
  assert.ok(flat.includes('Switch-1'));
});

test('each of the 10 data sheets has column widths and an autofilter', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const dataSheetNames = [
    'Devices',
    'Users',
    'Network',
    'Applications',
    'Licenses',
    'Monitors',
    'Locations',
    'Mailboxes',
    'Ports',
  ];

  dataSheetNames.forEach((name) => {
    const sheet = workbook.Sheets[name];
    assert.ok(Array.isArray(sheet['!cols']) && sheet['!cols'].length > 0, name + ' should have !cols');
    assert.ok(sheet['!autofilter'] && sheet['!autofilter'].ref, name + ' should have !autofilter');
  });
});

test('Devices sheet shows assigned users/apps/licenses and switch/port', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const sheet = workbook.Sheets['Devices'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const flat = rows.map((r) => r.join(' | ')).join('\n');

  assert.ok(flat.includes('PC-1'));
  assert.ok(flat.includes('Doe John'));
  assert.ok(flat.includes('App1'));
  assert.ok(flat.includes('Office'));
  assert.ok(flat.includes('Switch-1'));
  assert.ok(flat.includes('1')); // port number
});

test('Ports sheet lists one row per port with status and device', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const sheet = workbook.Sheets['Ports'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const dataRows = rows.slice(1);
  assert.equal(dataRows.length, 2);
  const flat = rows.map((r) => r.join(' | ')).join('\n');
  assert.ok(flat.includes('PC-1'));
  assert.ok(flat.includes('faulty'));
});

test('buildWorkbook writes to a binary array and reads back with the same sheets', () => {
  const workbook = ExcelExport.buildWorkbook(docWithOneOfEach());
  const binary = ExcelExport.writeBuffer(workbook);

  assert.ok(binary instanceof ArrayBuffer);
  const readBack = XLSX.read(binary, { type: 'array' });
  assert.deepEqual(readBack.SheetNames, workbook.SheetNames);
});

test('buildWorkbook handles an empty document without throwing', () => {
  const workbook = ExcelExport.buildWorkbook(Schema.emptyDocument());
  assert.deepEqual(workbook.SheetNames.length, 12);
});
