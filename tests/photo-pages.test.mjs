// Tests for how the Photo panel shares its stay between its photos (dashboard/core/photos.js,
// turnPlan, photoStay and the queue, and panels/photo). The panel pages through the photos, one at
// a time, each held for the stay divided by the number of photos, and no photo for less than 8
// seconds. Photos that do not fit wait for the next turn of the panel, which carries on after the
// last photo shown. Everything runs for real except the page, which is a record of what is drawn.
//
//   node tests/photo-pages.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

// The dashboard files are browser modules named .js. Copying them next to a
// package.json that says "type": "module" lets any version of node read them.
const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-photo-pages-'));
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
const photos = await import(base + 'core/photos.js');

const { makePhotoQueue, ownSeconds, photoStay, shortestHold, turnPlan } = photos;

const tests = [];
function test(name, run) {
  tests.push({ name: name, run: run });
}

// A fresh copy of the panel for a test, so the queue it keeps starts empty
let copies = 0;
async function freshPanel() {
  copies += 1;
  const file = 'panels/photo/photo-' + copies + '.js';
  copyModule(path.join(root, 'panels/photo/panel.js'), path.join(root, file));
  return import(base + file);
}

// Photos p1 to p9, uploaded one a day, so p9 is the newest
function photoList(count) {
  return Array.from({ length: count }, (value, index) => {
    const number = index + 1;
    return { id: 'p' + number, address: 'data/sample/p' + number + '.svg', createdAt: '2026-09-0' + number + 'T10:00:00Z' };
  });
}

// The panel draws into a host. The addresses of the photos in the markup are the photos of the turn, in order.
function turnOf(panel, list, settings) {
  const host = { innerHTML: '', querySelectorAll: () => [] };
  globalThis.Image = class {};
  try {
    panel.mount(host, { photos: list, settings: settings });
  } finally {
    delete globalThis.Image;
  }
  const html = host.innerHTML;
  return {
    html: html,
    shown: Array.from(html.matchAll(/<img src="data\/sample\/(p\d+)\.svg"/g)).map(match => match[1]),
    hold: (/--hold: ([\d.]+)s/.exec(html) || [])[1],
  };
}

const seededRandom = seed => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
};

// The split

test('the shortest time a photo stays up is 8 seconds', () => {
  assert.equal(shortestHold, 8);
});

test('3 photos at 30 seconds: all three in one turn, 10 seconds each', () => {
  assert.deepEqual(turnPlan(3, 30), { photos: 3, hold: 10 });
});

test('7 photos at 30 seconds: three in a turn, 10 seconds each, because 4 would be under 8', () => {
  assert.deepEqual(turnPlan(7, 30), { photos: 3, hold: 10 });
  // a fourth would get 7.5 seconds, under the shortest
  assert.ok(30 / 4 < shortestHold);
});

test('the split for other numbers: the stay is shared evenly and never gives a photo under 8 seconds', () => {
  assert.deepEqual(turnPlan(1, 16), { photos: 1, hold: 16 });
  assert.deepEqual(turnPlan(2, 16), { photos: 2, hold: 8 });
  assert.deepEqual(turnPlan(3, 16), { photos: 2, hold: 8 }, 'the starting 16 seconds fits two of three');
  assert.deepEqual(turnPlan(5, 40), { photos: 5, hold: 8 });
  assert.deepEqual(turnPlan(6, 40), { photos: 5, hold: 8 });
  assert.deepEqual(turnPlan(7, 24), { photos: 3, hold: 8 });
  assert.deepEqual(turnPlan(4, 120), { photos: 4, hold: 30 });
  assert.deepEqual(turnPlan(50, 120), { photos: 15, hold: 8 });

  // a stay under 8 seconds shows one photo for all of it
  assert.deepEqual(turnPlan(5, 6), { photos: 1, hold: 6 });
  assert.deepEqual(turnPlan(5, 7.9), { photos: 1, hold: 7.9 });

  // no photos, no turn
  assert.equal(turnPlan(0, 30).photos, 0);
  assert.equal(turnPlan(-1, 30).photos, 0);

  for (let count = 1; count <= 40; count++) {
    for (let seconds = 6; seconds <= 120; seconds++) {
      const plan = turnPlan(count, seconds);
      assert.ok(plan.photos >= 1 && plan.photos <= count, count + ' photos at ' + seconds);
      assert.ok(Math.abs(plan.photos * plan.hold - seconds) < 1e-9, 'the whole stay is used, ' + count + ' at ' + seconds);
      if (seconds >= shortestHold) assert.ok(plan.hold >= shortestHold - 1e-9, 'under the shortest, ' + count + ' at ' + seconds);
    }
  }
});

// The stay

test('photoStay: the row in Panel order wins, then Seconds per photo, with the Speed setting applied', () => {
  const order = seconds => ({ rotation: { order: [{ panel: 'tasks' }, { panel: 'photo', seconds: seconds }] } });

  assert.equal(photoStay({ photoSeconds: 30 }), 30);
  assert.equal(photoStay(Object.assign({ photoSeconds: 30 }, order(40))), 40);
  assert.equal(photoStay(Object.assign({ photoSeconds: 30 }, order(0))), 30, 'a row with no seconds follows Seconds per photo');
  assert.equal(photoStay(Object.assign({ photoSeconds: 30 }, order(undefined))), 30);
  assert.equal(photoStay({ photoSeconds: 30, rotation: { order: [{ panel: 'tasks' }] } }), 30, 'no Photo row');

  // while the order is empty the screen follows the older list of large panels
  assert.equal(photoStay({ photoSeconds: 30, rotation: { order: [], grid1: [{ panel: 'photo', seconds: 25 }] } }), 25);
  assert.equal(photoStay({ photoSeconds: 30, rotation: { grid1: [{ panel: 'photo', seconds: 25 }] } }), 25);

  // the Speed setting stretches or shortens it, as the schedule does
  assert.equal(photoStay({ photoSeconds: 20, speed: 'normal' }), 20);
  assert.equal(photoStay({ photoSeconds: 20, speed: 'slow' }), 30);
  assert.equal(photoStay({ photoSeconds: 20, speed: 'very-slow' }), 40);
  assert.equal(photoStay({ photoSeconds: 20, speed: 'fast' }), 15);
  assert.equal(photoStay({ photoSeconds: 20, speed: 'sideways' }), 20);

  // nothing set is the starting 16 seconds
  assert.equal(photoStay({}), config.defaultSettings.photoSeconds);
  assert.equal(photoStay(undefined), config.defaultSettings.photoSeconds);
  assert.equal(photoStay({ photoSeconds: 'soon' }), 16);

  // it is the seconds the schedule uses (ownSeconds), which the Photo row has no say over
  assert.equal(ownSeconds({ panel: 'photo' }, { photoSeconds: 30 }), photoStay({ photoSeconds: 30 }));
});

// The turns

test('newest first, 7 photos at 30 seconds: three at a time, and each turn carries on after the last photo shown', () => {
  const list = photoList(7);
  const queue = makePhotoQueue();
  const plan = turnPlan(list.length, 30);
  const turns = [];
  for (let turn = 0; turn < 5; turn++) turns.push(queue.takeTurn(list, 'newest-first', plan.photos).photos.map(photo => photo.id));

  // p7 is the newest
  assert.deepEqual(turns, [
    ['p7', 'p6', 'p5'],
    ['p4', 'p3', 'p2'],
    ['p1', 'p7', 'p6'],
    ['p5', 'p4', 'p3'],
    ['p2', 'p1', 'p7'],
  ]);
});

test('newest first, 3 photos at 30 seconds: the same three in the same order every turn', () => {
  const list = photoList(3);
  const queue = makePhotoQueue();
  const plan = turnPlan(list.length, 30);

  for (let turn = 0; turn < 4; turn++) {
    assert.deepEqual(queue.takeTurn(list, 'newest-first', plan.photos).photos.map(photo => photo.id), ['p3', 'p2', 'p1']);
  }
});

test('the next turn opens with the photo that comes after the last one of this turn', () => {
  const list = photoList(7);
  const queue = makePhotoQueue();

  const first = queue.takeTurn(list, 'newest-first', 3);
  const second = queue.takeTurn(list, 'newest-first', 3);
  assert.equal(first.next, second.photos[0]);
  assert.equal(first.next.id, 'p4');

  // random order too: the photo named as next is the one the next turn opens with
  const queue2 = makePhotoQueue(seededRandom(11));
  let turn = queue2.takeTurn(list, 'random', 3);
  for (let count = 0; count < 50; count++) {
    const following = queue2.takeTurn(list, 'random', 3);
    assert.equal(following.photos[0], turn.next, 'turn ' + count);
    turn = following;
  }
});

test('random order, 7 photos three at a time: no photo twice in a turn, none twice in a row, and every photo comes round', () => {
  [1, 2, 3, 4, 5].forEach(seed => {
    const list = photoList(7);
    const queue = makePhotoQueue(seededRandom(seed));
    const seen = new Map();
    let last = null;

    for (let turn = 0; turn < 300; turn++) {
      const ids = queue.takeTurn(list, 'random', 3).photos.map(photo => photo.id);
      assert.equal(ids.length, 3);
      assert.equal(new Set(ids).size, 3, 'a photo twice in turn ' + turn + ' with seed ' + seed + ': ' + ids.join());
      assert.notEqual(ids[0], last, 'the same photo twice in a row at turn ' + turn);
      last = ids[2];
      ids.forEach(id => seen.set(id, (seen.get(id) || 0) + 1));
    }
    assert.equal(seen.size, 7, 'every photo should come round');
    // 900 photos shown between 7: each comes close to a seventh of them, which the cards guarantee
    seen.forEach((times, id) => assert.ok(Math.abs(times - 900 / 7) <= 3, id + ' came ' + times + ' times'));
  });
});

test('random order deals the photos like cards: in the first round of 7, every photo comes once', () => {
  const list = photoList(7);
  const queue = makePhotoQueue(seededRandom(9));

  const first = queue.takeTurn(list, 'random', 3).photos.map(photo => photo.id);
  const second = queue.takeTurn(list, 'random', 3).photos.map(photo => photo.id);
  const third = queue.takeTurn(list, 'random', 1).photos.map(photo => photo.id);
  assert.deepEqual(first.concat(second, third).sort(), list.map(photo => photo.id).sort());
});

test('with one photo it is every turn, and with none there is nothing', () => {
  const only = photoList(1);
  ['random', 'newest-first'].forEach(order => {
    const queue = makePhotoQueue(seededRandom(1));
    for (let turn = 0; turn < 3; turn++) {
      const result = queue.takeTurn(only, order, 1);
      assert.deepEqual(result.photos.map(photo => photo.id), ['p1']);
      assert.equal(result.next.id, 'p1');
    }
    assert.deepEqual(queue.takeTurn([], order, 3), { photos: [], next: null });
  });
});

test('a photo that is hidden between two turns is not shown, and the walk goes on after the last one shown', () => {
  const list = photoList(7);
  const queue = makePhotoQueue();
  queue.takeTurn(list, 'newest-first', 3); // p7 p6 p5, and p4 is next

  const without = list.filter(photo => photo.id !== 'p4');
  assert.deepEqual(queue.takeTurn(without, 'newest-first', 3).photos.map(photo => photo.id), ['p3', 'p2', 'p1']);
});

// The panel

test('the panel draws the turn: 3 photos at 30 seconds are 3 photos held for 10 seconds', async () => {
  const panel = await freshPanel();
  const turn = turnOf(panel, photoList(3), { photoOrder: 'newest-first', photoSeconds: 30 });

  assert.deepEqual(turn.shown, ['p3', 'p2', 'p1']);
  assert.equal(turn.hold, '10');
  assert.deepEqual(Array.from(turn.html.matchAll(/--shot: (\d+)/g)).map(match => Number(match[1])), [0, 1, 2]);
  // the second turn is the same three
  assert.deepEqual(turnOf(panel, photoList(3), { photoOrder: 'newest-first', photoSeconds: 30 }).shown, ['p3', 'p2', 'p1']);
});

test('the panel draws the turn: 7 photos at 30 seconds are 3 photos held for 10 seconds, and the rest come in the turns after', async () => {
  const panel = await freshPanel();
  const settings = { photoOrder: 'newest-first', photoSeconds: 30 };
  const list = photoList(7);

  const turns = [1, 2, 3, 4].map(() => turnOf(panel, list, settings));
  assert.deepEqual(turns.map(turn => turn.shown), [
    ['p7', 'p6', 'p5'],
    ['p4', 'p3', 'p2'],
    ['p1', 'p7', 'p6'],
    ['p5', 'p4', 'p3'],
  ]);
  turns.forEach(turn => assert.equal(turn.hold, '10'));
});

test('the panel follows the row of Panel order, the Speed setting and a short stay', async () => {
  const panel = await freshPanel();
  const list = photoList(4);
  const showing = settings => turnOf(panel, list, Object.assign({ photoOrder: 'newest-first' }, settings));

  // the row has 40 seconds of its own: all four, 10 seconds each
  const row = showing({ photoSeconds: 16, rotation: { order: [{ panel: 'photo', seconds: 40 }] } });
  assert.equal(row.shown.length, 4);
  assert.equal(row.hold, '10');

  // Slow stays up half as long again, so 16 seconds is 24: three photos of 8
  const slow = showing({ photoSeconds: 16, speed: 'slow' });
  assert.equal(slow.shown.length, 3);
  assert.equal(slow.hold, '8');

  // 6 seconds is one photo, for all of it
  const short = showing({ photoSeconds: 6 });
  assert.equal(short.shown.length, 1);
  assert.equal(short.hold, '6');

  // no settings: the starting 16 seconds, two photos of 8
  const starting = turnOf(panel, list, undefined);
  assert.equal(starting.shown.length, 2);
  assert.equal(starting.hold, '8');
});

test('the panel draws nothing but the plate of a missing picture when there are no photos', async () => {
  const panel = await freshPanel();
  const turn = turnOf(panel, [], { photoSeconds: 30 });

  assert.deepEqual(turn.shown, []);
  assert.ok(turn.html.includes('[Photo not available]'));
  assert.equal(panel.hasContent({ photos: [] }), false);
  assert.equal(panel.hasContent({ photos: photoList(2) }), true);
});

// Run them

let failures = 0;
try {
  for (const entry of tests) {
    try {
      await entry.run();
      console.log('ok    ' + entry.name);
    } catch (error) {
      failures += 1;
      console.log('FAIL  ' + entry.name);
      console.log(error);
    }
  }
} finally {
  fs.rmSync(workFolder, { recursive: true, force: true });
}

console.log('\n' + (tests.length - failures) + ' of ' + tests.length + ' passed');
if (failures > 0) process.exitCode = 1;
