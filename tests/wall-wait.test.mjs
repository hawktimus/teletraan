// The wait for the screen of an install that runs from the command line (control/lib/wall-wait.js): it takes a page load of the wall
// after the restart, read from the control log, as the screen coming up. docs/shipping-from-the-mac.md.
//
//   node tests/wall-wait.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, finish } from './helpers/runner.mjs';
import { wallLoadedSince, makeLogWaiter, readLogTail } from '../control/lib/wall-wait.js';

const line = (logged, loadedAt) => logged + ' wall page load at ' + loadedAt + ': the browser started or opened the page (3 in 24 hours)\n';
const at = text => Date.parse(text);

test('a page load after the restart counts, one before it does not', () => {
  const log = line('2026-11-25T17:00:00.500Z', '2026-11-25T17:00:00.100Z') + 'other line\n';
  assert.equal(wallLoadedSince(log, at('2026-11-25T17:30:00Z')), false);
  assert.equal(wallLoadedSince(log, at('2026-11-25T16:59:00Z')), true);
  assert.equal(wallLoadedSince(log + line('2026-11-25T17:31:00.000Z', '2026-11-25T17:30:41.000Z'), at('2026-11-25T17:30:00Z')), true);
});

test('a load a second before the restart call returned still counts, a minute before does not', () => {
  const log = line('2026-11-25T17:30:05Z', '2026-11-25T17:29:59.500Z');
  assert.equal(wallLoadedSince(log, at('2026-11-25T17:30:00Z')), true);
  assert.equal(wallLoadedSince(log, at('2026-11-25T17:31:00Z')), false);
});

test('an empty log, a log with no page load and a bad time all say no', () => {
  assert.equal(wallLoadedSince('', 0), false);
  assert.equal(wallLoadedSince(undefined, 0), false);
  assert.equal(wallLoadedSince('control service listening on port 3230\n', 0), false);
  assert.equal(wallLoadedSince('x wall page load at 2026-99-99T99:99:99Z: y\n', 0), false);
});

test('the waiter says yes once the log shows a load after the restart, and no when the time runs out', async () => {
  let now = 1000;
  let since = 0;
  let text = '';
  const clock = () => now;
  const pause = async milliseconds => { now += milliseconds; if (now >= 7000) text = line('x', new Date(6500).toISOString()); };
  const waiter = makeLogWaiter('unused', () => since, { read: () => text, pause, clock });

  since = 5000;
  assert.equal(await waiter('48-abc1234', 90 * 1000), true, 'the load at 6500 is after 5000');

  now = 1000;
  text = '';
  since = 9000000;
  assert.equal(await waiter('48-abc1234', 10 * 1000), false);

  now = 1000;
  since = 0;
  text = line('x', new Date(6500).toISOString());
  assert.equal(await waiter('48-abc1234', 10 * 1000), false, 'before the screen was restarted nothing counts');
});

test('the tail of the log is read from a file, and a missing file reads as nothing', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-wall-wait-'));
  const file = path.join(folder, 'control.log');
  fs.writeFileSync(file, 'a'.repeat(100 * 1024) + '\n' + line('2026-11-25T17:31:00.000Z', '2026-11-25T17:30:41.000Z'));
  const tail = readLogTail(file);
  assert.ok(tail.length <= 64 * 1024 && wallLoadedSince(tail, at('2026-11-25T17:30:00Z')));
  assert.equal(readLogTail(path.join(folder, 'missing.log')), '');
  fs.rmSync(folder, { recursive: true, force: true });
});

test('the install program uses the log waiter and marks the restart', () => {
  const text = fs.readFileSync(new URL('../control/bin/install-tree.js', import.meta.url), 'utf8');
  assert.ok(text.includes("import { makeLogWaiter } from '../lib/wall-wait.js';"));
  assert.ok(text.includes('ctx.waitForBuild = makeLogWaiter(config.logFile, () => restartedAt);'));
  assert.ok(text.includes("parameters[0] === 'restart-kiosk'"));
});

await finish();
