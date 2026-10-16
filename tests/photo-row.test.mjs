// Tests for the Photos row of a Screen: a row has photoCount photos (1 to 20, starting at 4) and
// secondsPerPhoto (5 to 60, starting at 10), stays up for their product, shows that many photos in the published
// order (newest first) or dealt at random, one for each secondsPerPhoto, and the next turn carries on where
// the last one left off. dashboard/core/screens.js reads the row, dashboard/core/photos.js (takeRun, rowPlan)
// chooses the photos and dashboard/panels/photo draws them. The page is a record of what is drawn.
//
//   node tests/photo-row.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-photo-row-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
copyModule(path.join(dashboardFolder, 'config.js'), path.join(root, 'config.js'));
copyModule(path.join(dashboardFolder, 'registry.js'), path.join(root, 'registry.js'));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});
fs.mkdirSync(path.join(root, 'panels/photo'), { recursive: true });
copyModule(path.join(dashboardFolder, 'panels/photo/panel.js'), path.join(root, 'panels/photo/panel.js'));

const base = pathToFileURL(root).href + '/';
const config = await import(base + 'config.js');
const { makePhotoQueue, rowPlan } = await import(base + 'core/photos.js');
const { mainPlaylist, tidyScreen } = await import(base + 'core/screens.js');
const { normalizeContent } = await import(base + 'core/sanity.js');

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

let copies = 0;
async function freshPanel() {
  copies += 1;
  const file = 'panels/photo/photo-' + copies + '.js';
  copyModule(path.join(root, 'panels/photo/panel.js'), path.join(root, file));
  return import(base + file);
}

// Photos p1 to pN, uploaded one a day, so pN is the newest and comes first in the published order
function photoList(count) {
  return Array.from({ length: count }, (value, index) => {
    const number = index + 1;
    const day = String(number).padStart(2, '0');
    return { id: 'p' + number, address: 'data/sample/p' + number + '.svg', createdAt: '2026-08-' + day + 'T10:00:00Z' };
  });
}

function turnOf(panel, list, settings, step) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  globalThis.Image = class {};
  try {
    panel.mount(host, { photos: list, settings: settings }, 1, step);
  } finally {
    delete globalThis.Image;
  }
  const html = host.innerHTML;
  return {
    shown: Array.from(html.matchAll(/<img src="data\/sample\/(p\d+)\.svg"/g)).map(match => match[1]),
    hold: (/--hold: ([\d.]+)s/.exec(html) || [])[1],
    stay: (/data-stay="(\d+)"/.exec(html) || [])[1],
  };
}

const newestFirst = { photoOrder: 'newest-first', photoFit: 'fill' };
const row = { photoCount: 4, secondsPerPhoto: 10 };

test('a Photos row has 4 photos of 10 seconds until it says otherwise, and stays up 40 seconds', () => {
  const screen = tidyScreen({ mainRows: [{ panel: 'photo' }] }, 'original');
  assert.deepEqual(screen.mainRows[0], { panel: 'photo', team: '', photoCount: 4, secondsPerPhoto: 10, seconds: 40 });
  assert.deepEqual(config.defaultPhotoRow, { photoCount: 4, secondsPerPhoto: 10 });
});

test('the count is kept from 1 to 20 and the seconds from 5 to 60, and the total is their product', () => {
  const read = fields => tidyScreen({ mainRows: [Object.assign({ panel: 'photo' }, fields)] }, 'original').mainRows[0];
  assert.deepEqual([read({ photoCount: 1, secondsPerPhoto: 5 }).seconds, read({ photoCount: 20, secondsPerPhoto: 60 }).seconds], [5, 1200]);
  assert.equal(read({ photoCount: 0 }).photoCount, 1);
  assert.equal(read({ photoCount: 99 }).photoCount, 20);
  assert.equal(read({ secondsPerPhoto: 1 }).secondsPerPhoto, 5);
  assert.equal(read({ secondsPerPhoto: 600 }).secondsPerPhoto, 60);
  assert.equal(read({ photoCount: 'many' }).photoCount, 4);
  assert.equal(read({ photoCount: 3, secondsPerPhoto: 20, seconds: 99 }).seconds, 60, 'the seconds the row had of its own are not used');
  assert.deepEqual(tidyScreen({ mainRows: [{ panel: 'events', photoCount: 9 }] }, 'original').mainRows[0], { panel: 'events', team: '' });
});

test('the step the screen plays carries the count, the seconds of each photo and the total', () => {
  const screen = tidyScreen({ mainRows: [{ panel: 'photo', photoCount: 6, secondsPerPhoto: 15 }] }, 'original');
  const steps = mainPlaylist(normalizeContent({}), new Date('2026-10-15T15:00:00Z'), screen);
  assert.equal(steps.length, 1);
  assert.equal(steps[0].panel, 'photo');
  assert.deepEqual([steps[0].photoCount, steps[0].secondsPerPhoto, steps[0].seconds], [6, 15, 90]);
});

test('4 photos of 10 seconds give four pages of 10 seconds, and the panel stays 40 seconds', async () => {
  const panel = await freshPanel();
  const turn = turnOf(panel, photoList(9), newestFirst, row);
  assert.equal(turn.shown.length, 4);
  assert.equal(turn.hold, '10');
  assert.equal(turn.stay, '40');
  assert.deepEqual(rowPlan(4, 10), { photos: 4, hold: 10, seconds: 40 });
});

test('7 photos with a count of 4 show 1 to 4, then 5 to 7, then 1 again, in the published order', async () => {
  const panel = await freshPanel();
  const list = photoList(7);
  const first = turnOf(panel, list, newestFirst, row);
  const second = turnOf(panel, list, newestFirst, row);
  const third = turnOf(panel, list, newestFirst, row);
  assert.deepEqual(first.shown, ['p7', 'p6', 'p5', 'p4']);
  assert.deepEqual(second.shown, ['p3', 'p2', 'p1']);
  assert.deepEqual(third.shown, first.shown);
  assert.equal(second.stay, '30', 'a turn of 3 photos stays 3 times 10 seconds');
  assert.equal(second.hold, '10');
});

test('the queue says the same in numbers: 1 to 4, 5 to 7, 1 to 4', () => {
  const queue = makePhotoQueue();
  const list = photoList(7).reverse();
  const run = () => queue.takeRun(list, 'newest-first', 4).photos.map(photo => photo.id);
  assert.deepEqual([run(), run(), run()], [['p7', 'p6', 'p5', 'p4'], ['p3', 'p2', 'p1'], ['p7', 'p6', 'p5', 'p4']]);
});

test('a count that is more than the photos shows them all once, and one photo shows alone', async () => {
  const panel = await freshPanel();
  assert.deepEqual(turnOf(panel, photoList(3), newestFirst, row).shown, ['p3', 'p2', 'p1']);
  const alone = await freshPanel();
  assert.deepEqual(turnOf(alone, photoList(1), newestFirst, row).shown, ['p1']);
});

test('a count that divides the photos goes round with no short turn: 8 photos of 4 give 1 to 4, 5 to 8, 1 to 4', () => {
  const queue = makePhotoQueue();
  const list = photoList(8).reverse();
  const run = () => queue.takeRun(list, 'newest-first', 4).photos.map(photo => photo.id);
  assert.deepEqual([run(), run(), run()], [['p8', 'p7', 'p6', 'p5'], ['p4', 'p3', 'p2', 'p1'], ['p8', 'p7', 'p6', 'p5']]);
});

test('in random order a turn has the count of different photos, and every photo comes once before any comes again', async () => {
  const queue = makePhotoQueue(() => 0.37);
  const list = photoList(7);
  const seen = [];
  for (let turn = 0; turn < 2; turn++) {
    const ids = queue.takeRun(list, 'random', 4).photos.map(photo => photo.id);
    assert.equal(new Set(ids).size, 4);
    seen.push(...ids);
  }
  assert.equal(new Set(seen.slice(0, 7)).size, 7, 'the first seven photos shown are all seven photos');
});

test('the Speed setting stretches the seconds of each photo as it stretches the stay, and the total is left to the schedule', async () => {
  const panel = await freshPanel();
  const turn = turnOf(panel, photoList(9), Object.assign({ speed: 'slow' }, newestFirst), row);
  assert.equal(turn.hold, '15');
  assert.equal(turn.stay, '40');
});

test('the panel with no step keeps the old way: the stay is shared between the photos, 8 seconds at least', async () => {
  const panel = await freshPanel();
  const turn = turnOf(panel, photoList(9), Object.assign({ photoSeconds: 24 }, newestFirst));
  assert.equal(turn.shown.length, 3);
  assert.equal(turn.hold, '8');
  assert.equal(turn.stay, undefined);
});

let failed = 0;
for (const item of tests) {
  try {
    await item.run();
    console.log('PASS  ' + item.name);
  } catch (error) {
    failed += 1;
    console.log('FAIL  ' + item.name + '\n      ' + error.message);
  }
}
console.log('\n' + (tests.length - failed) + ' of ' + tests.length + ' tests passed.');
fs.rmSync(workFolder, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
