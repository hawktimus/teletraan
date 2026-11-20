// Tests for which Teletraan a Mini is: I (the classroom) or II (the spare at home). The name comes from TELETRAAN_DEVICE
// in local.env, goes through device.json (computer/scripts/kiosk.sh) and picks the wordmark of the banner.
//
//   node tests/device-name.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test, finish } from './helpers/runner.mjs';
import { repo } from './helpers/control-world.mjs';
import { deviceNumeral, wordmarkFile } from '../dashboard/core/device.js';

const read = name => fs.readFileSync(repo + name, 'utf8');

test('a device.json that says II is Teletraan II, and anything else is Teletraan I', () => {
  assert.equal(deviceNumeral({ device: 'II' }), 'II');
  assert.equal(deviceNumeral({ device: ' ii ' }), 'II');
  assert.equal(deviceNumeral({ device: 'I' }), 'I');
  assert.equal(deviceNumeral({ device: '' }), 'I');
  assert.equal(deviceNumeral({}), 'I');
  assert.equal(deviceNumeral(null), 'I');
  assert.equal(deviceNumeral({ device: '<b>II</b>' }), 'I');
});

test('each numeral has its own wordmark picture, and the II one has the extra letter', () => {
  assert.equal(wordmarkFile('I'), 'assets/teletraan-wordmark.svg');
  assert.equal(wordmarkFile('II'), 'assets/teletraan-ii-wordmark.svg');
  const one = read('dashboard/assets/teletraan-wordmark.svg');
  const two = read('dashboard/assets/teletraan-ii-wordmark.svg');
  assert.equal((two.match(/<polygon/g) || []).length, (one.match(/<polygon/g) || []).length + 1);
  assert.ok(two.includes('viewBox="0 0 944 100"'));
});

test('the kiosk script copies TELETRAAN_DEVICE into device.json, and the banner reads it', () => {
  const kiosk = read('computer/scripts/kiosk.sh');
  assert.ok(kiosk.includes('setting TELETRAAN_DEVICE'));
  assert.ok(kiosk.includes('"device":"%s"'));
  assert.ok(read('dashboard/panels/banner/panel.js').includes('wordmarkFile(numeral)'));
  assert.ok(read('computer/local.example.env').includes('TELETRAAN_DEVICE'));
});

await finish();
