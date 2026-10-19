// Tests for the page on screen being drawn again after a publish (core/page-refresh.js). A page that is arriving or
// leaving is left alone, and it is looked at again every second for a few seconds, so a publish that lands in the middle
// of a swap or a transition shows as soon as the page rests, and not at the next page change. areas.js, schedule-hold.js
// and frame.js are stand-ins, and the timer is held by the test.
//
//   node tests/refresh-retry.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-refresh-retry-'));
fs.writeFileSync(path.join(work, 'package.json'), '{ "type": "module" }\n');
fs.mkdirSync(path.join(work, 'dashboard/core'), { recursive: true });
copyModule(path.join(dashboardFolder, 'core/page-refresh.js'), path.join(work, 'dashboard/core/page-refresh.js'));
fs.writeFileSync(path.join(work, 'dashboard/frame.js'), 'export const scrollCard = () => {};\n');
fs.writeFileSync(path.join(work, 'dashboard/core/areas.js'), [
  'export const restingPage = region => globalThis.world.resting[region] || null;',
  'export function replaceRestingPage(region, page) { globalThis.world.replaced.push(region + ":" + page.element.textContent); globalThis.world.resting[region] = page; }',
].join('\n') + '\n');
fs.writeFileSync(path.join(work, 'dashboard/core/schedule-hold.js'), 'export const clockHeld = 0;\n');

const timers = [];
globalThis.setTimeout = callback => { timers.push(callback); return timers.length; };
globalThis.clearTimeout = () => {};

const element = text => ({ textContent: text, querySelectorAll: () => [] });
const pageWith = (text, rebuildText) => ({ element: element(text), rebuild: () => ({ element: element(rebuildText) }) });
const { refreshPagesInPlace } = await import(pathToFileURL(path.join(work, 'dashboard/core/page-refresh.js')).href);

let passed = 0;
function test(name, run) {
  timers.length = 0;
  globalThis.world = { resting: {}, replaced: [] };
  run(globalThis.world);
  passed += 1;
  console.log('ok ' + name);
}

test('a page at rest that reads differently is replaced at once', world => {
  world.resting = { grid1: pageWith('old', 'new'), grid2: pageWith('same', 'same') };
  refreshPagesInPlace();
  assert.deepEqual(world.replaced, ['grid1:new']);
});

test('a page that is not at rest is looked at again after a second, and replaced when it rests', world => {
  refreshPagesInPlace();
  assert.deepEqual(world.replaced, [], 'nothing to replace under the swap');
  assert.equal(timers.length, 1, 'a look is planned');

  world.resting = { grid1: pageWith('old', 'new'), grid2: pageWith('same', 'same') };
  timers.shift()();
  assert.deepEqual(world.replaced, ['grid1:new'], 'it shows once the page rests');
  assert.equal(timers.length, 0, 'and no more looks are planned');
});

test('the looks stop after twelve seconds when the page never rests, and a new publish starts them again', world => {
  refreshPagesInPlace();
  let looks = 0;
  while (timers.length > 0 && looks < 50) {
    timers.shift()();
    looks += 1;
  }
  assert.equal(looks, 12);

  refreshPagesInPlace();
  assert.equal(timers.length, 1, 'a new publish plans a look again');
});

fs.rmSync(work, { recursive: true, force: true });
console.log(passed + ' passed');
