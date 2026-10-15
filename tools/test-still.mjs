// Tests for the panel preview (docs/monday.md, "Preview"): the address the dashboard reads, the
// switches it sets, the clock that draws once, the address the Studio builds, and the step that
// copies the dashboard into the Studio. Nothing is installed and nothing touches the network.
//
//   node tools/test-still.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = file => import(pathToFileURL(path.join(root, file)).href);
const { readStill, useStillSwitches, stillRow } = await load('dashboard/core/still.js');
const { makeSecondTimer } = await load('dashboard/core/tick.js');
const preview = await load('studio/preview-panels.js');
const { copyDashboard } = await load('studio/scripts/copy-dashboard.mjs');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

test('an address without a panel asks for nothing', () => {
  assert.equal(readStill(''), null);
  assert.equal(readStill('?sample=1&still=1'), null);
  assert.equal(readStill('?panel='), null);
});

test('the address is read into a panel, a team, a department, a Screen and the still switch', () => {
  const ask = readStill('?panel=monday-tasks&team=nova&dept=lead-build&screen=minimal&still=1');
  assert.deepEqual(ask, { panel: 'monday-tasks', team: 'nova', department: 'lead-build', screen: 'minimal', still: true });
});

test('a Screen that does not exist is ignored and still is on only for 1', () => {
  const ask = readStill('?panel=tasks&screen=neon&still=yes');
  assert.equal(ask.screen, '');
  assert.equal(ask.still, false);
});

test('the switches that hold the page are set, and a still page does not move', () => {
  const ask = readStill('?panel=tasks&team=prime&screen=cybertron&still=1');
  const params = useStillSwitches(new URLSearchParams('?panel=tasks&team=prime&screen=cybertron&still=1'), ask);
  assert.equal(params.get('show'), 'tasks');
  assert.equal(params.get('style'), 'cybertron');
  assert.equal(params.get('team'), 'prime');
  assert.equal(params.get('motion'), 'none');
});

test('a panel without still keeps the motion it was given', () => {
  const ask = readStill('?panel=tasks&motion=calm');
  assert.equal(useStillSwitches(new URLSearchParams('?panel=tasks&motion=calm'), ask).get('motion'), 'calm');
  assert.equal(useStillSwitches(new URLSearchParams('?panel=tasks'), readStill('?panel=tasks')).has('motion'), false);
});

test('the row for a Monday panel carries the team and the department', () => {
  const row = stillRow(readStill('?panel=monday-tasks&team=prime&dept=abc'));
  assert.equal(row.panel, 'monday-tasks');
  assert.equal(row.team, 'prime');
  assert.equal(row.department, 'abc');
  assert.equal('department' in stillRow(readStill('?panel=monday-done&team=prime')), false);
});

test('the clock draws once when asked and then holds', () => {
  const waiting = [];
  const clock = { now: () => 5000, setTimeout: action => waiting.push(action) };
  const timer = makeSecondTimer(clock);
  const seen = [];

  timer.onSecond(now => seen.push(now.getTime()));
  timer.tickOnce();
  timer.tickOnce();
  assert.equal(seen.length, 2);
  assert.equal(waiting.length, 0, 'no timer is set for a next second');

  timer.start();
  assert.equal(waiting.length, 1, 'the running clock still sets its timer');
});

test('the Studio address names the panel, the team, the department, the Screen and still', () => {
  assert.equal(preview.previewAddress('monday-tasks', 'prime', 'lead 1', 'cybertron'), '/dashboard/index.html?panel=monday-tasks&team=prime&dept=lead%201&screen=cybertron&still=1');
  assert.equal(preview.previewAddress('monday-overall', '', '', 'nope'), '/dashboard/index.html?panel=monday-overall&screen=original&still=1');
});

test('the Studio lists eleven panels, each id once, at half size', () => {
  assert.equal(preview.previewPanels.length, 11);
  assert.equal(new Set(preview.previewPanels.map(item => item.id)).size, 11);
  assert.equal(preview.frameSize.width * 2, preview.frameSize.canvasWidth);
  assert.equal(preview.frameSize.height * 2, preview.frameSize.canvasHeight);
});

test('the copy step puts the dashboard in the static folder and leaves out the live files', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-copy-'));
  try {
    const from = path.join(folder, 'dashboard');
    const to = path.join(folder, 'studio', 'static', 'dashboard');
    fs.mkdirSync(path.join(from, 'data', 'live'), { recursive: true });
    fs.writeFileSync(path.join(from, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(from, 'data', 'live', 'secret.json'), '{}');
    fs.mkdirSync(to, { recursive: true });
    fs.writeFileSync(path.join(to, 'old.txt'), 'old');

    copyDashboard(from, to);
    assert.ok(fs.existsSync(path.join(to, 'index.html')));
    assert.ok(!fs.existsSync(path.join(to, 'data', 'live', 'secret.json')));
    assert.ok(!fs.existsSync(path.join(to, 'old.txt')), 'an old copy is cleared first');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

let failed = 0;
for (const entry of tests) {
  try {
    await entry.run();
    console.log('PASS  ' + entry.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + entry.name + '\n        ' + error.message);
  }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' checks passed.');
process.exit(failed === 0 ? 0 : 1);
