'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { freshGlobals } = require('./helpers/load-app');

test('fieldError accepts an empty value for date and ip fields', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.fieldError({ type: 'date' }, ''), '');
  assert.equal(Schema.fieldError({ type: 'ip' }, ''), '');
});

test('fieldError validates YYYY.MM.DD dates', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.fieldError({ type: 'date' }, '2026.10.25'), '');
  assert.notEqual(Schema.fieldError({ type: 'date' }, '2026.13.01'), '');
  assert.notEqual(Schema.fieldError({ type: 'date' }, '2026.02.30'), '');
  assert.notEqual(Schema.fieldError({ type: 'date' }, '25.10.2026'), '');
  assert.notEqual(Schema.fieldError({ type: 'date' }, 'not a date'), '');
});

test('fieldError validates IPv4 addresses', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.fieldError({ type: 'ip' }, '192.168.1.1'), '');
  assert.equal(Schema.fieldError({ type: 'ip' }, '0.0.0.0'), '');
  assert.notEqual(Schema.fieldError({ type: 'ip' }, '256.0.0.1'), '');
  assert.notEqual(Schema.fieldError({ type: 'ip' }, '192.168.1'), '');
  assert.notEqual(Schema.fieldError({ type: 'ip' }, 'not an ip'), '');
});

test('dateToInputValue converts a valid stored date to the native picker format', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.dateToInputValue('2026.10.25'), '2026-10-25');
  assert.equal(Schema.dateToInputValue(''), '');
  assert.equal(Schema.dateToInputValue('not a date'), '');
});

test('dateFromInputValue converts the native picker format back to the stored format', () => {
  const { Schema } = freshGlobals();
  assert.equal(Schema.dateFromInputValue('2026-10-25'), '2026.10.25');
  assert.equal(Schema.dateFromInputValue(''), '');
});

test('device and network ip/date fields are typed in the schema', () => {
  const { Schema } = freshGlobals();
  const deviceIp = Schema.DEVICE_FIELDS.find((f) => f.key === 'ip');
  const deviceDelivery = Schema.DEVICE_FIELDS.find((f) => f.key === 'deliveryDate');
  const networkIp = Schema.NETWORK_FIELDS.find((f) => f.key === 'ip');
  const networkSupport = Schema.NETWORK_FIELDS.find((f) => f.key === 'supportUntil');

  assert.equal(deviceIp.type, 'ip');
  assert.equal(deviceDelivery.type, 'date');
  assert.equal(networkIp.type, 'ip');
  assert.equal(networkSupport.type, 'date');
});
