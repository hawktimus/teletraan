// Tests for a pause that is on before the large panel has a page (the control page's Pause, and a restart of the screen
// during it). The region draws its first page and then stands still, instead of staying empty until the pause ends.
// core/schedule.js runs with stand-ins for the page; the waits are held by the test.
//
//   node tests/pause-first-page.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-pause-first-'));
const tree = path.join(work, 'tree');

['config.js', 'core/schedule.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(tree, 'dashboard', file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(tree, 'dashboard', file));
});
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(name => /^schedule-.*\.js$/.test(name)).forEach(name => {
  copyModule(path.join(dashboardFolder, 'core', name), path.join(tree, 'dashboard/core', name));
});
const stand = (file, text) => fs.writeFileSync(path.join(tree, 'dashboard', file), text.join('\n') + '\n');
fs.writeFileSync(path.join(tree, 'package.json'), '{ "type": "module" }\n');
stand('frame.js', [
  'export const pace = () => 1;',
  'export const turnMs = () => 0;',
  'export const isPaused = () => false;',
  'export const wait = () => new Promise(resolve => globalThis.world.waits.push(resolve));',
  'export const scrollCard = () => {};',
]);
stand('core/panels.js', [
  'export function buildPage(id) { globalThis.world.log.push("build " + id); return { id: id, element: { name: id } }; }',
  'export const canShow = () => true;',
  'export const moduleOf = () => null;',
  'export const regionOf = () => "grid1";',
  'export const topicOf = () => null;',
]);
stand('core/photos.js', ['export const ownSeconds = step => step.seconds || 0;']);
stand('core/layout.js', ['export const hasRegion = () => true;', "export const layoutNow = () => 'standard';"]);
stand('core/areas.js', [
  'export async function changePage(region, page) { globalThis.world.log.push("page " + (page ? page.id : "none")); return 0; }',
  'export function clearRegion() {}',
]);

async function quarters(world, count) {
  for (let step = 0; step < count; step += 1) {
    world.waits.splice(0).forEach(resolve => resolve());
    for (let turn = 0; turn < 8; turn += 1) await new Promise(resolve => setImmediate(resolve));
  }
}

let passed = 0;
async function test(name, run) {
  const world = { log: [], waits: [] };
  globalThis.world = world;
  try {
    world.module = await import(pathToFileURL(path.join(tree, 'dashboard/core/schedule.js')).href + '?run=' + (passed += 1));
    await run(world);
    console.log('ok ' + name);
  } finally {
    delete globalThis.world;
  }
}

const playlist = () => [{ panel: 'leadership', show: true, seconds: 10 }, { panel: 'events', show: true, seconds: 10 }];
const content = { settings: { pageSeconds: 20, rotation: {} } };

await test('a pause that is on from the start still lets the first page be drawn, and then no other', async world => {
  world.module.pauseRotation();
  world.module.startRotation('grid1', playlist, () => content);
  await quarters(world, 4);
  assert.deepEqual(world.log, ['build leadership', 'page leadership'], 'the first page is drawn');

  await quarters(world, 200);
  assert.deepEqual(world.log, ['build leadership', 'page leadership'], 'and the pause holds it for as long as it lasts');

  world.module.resumeRotation();
  await quarters(world, 60);
  assert.ok(world.log.includes('page events'), 'the next page comes when the pause ends');
});

await test('a pause that comes while a page is on screen holds that page as before', async world => {
  world.module.startRotation('grid1', playlist, () => content);
  await quarters(world, 4);
  assert.deepEqual(world.log, ['build leadership', 'page leadership']);

  world.module.pauseRotation();
  await quarters(world, 200);
  assert.deepEqual(world.log, ['build leadership', 'page leadership'], 'nothing changes during the pause');
});

fs.rmSync(work, { recursive: true, force: true });
console.log(passed + ' passed');
