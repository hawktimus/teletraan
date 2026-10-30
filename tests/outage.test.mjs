// What the content reader does when the local snapshot goes away and comes back (core/content-source.js): the screen keeps
// its content, says nothing about it, asks again every 5 seconds and recovers by itself. Also bad answers (a page of a
// filter, half a file, no result), and a saved copy that is damaged or cannot be written. Nothing touches the network:
// fetch, localStorage and the clock are fakes. The outage of Sanity itself is the sync service's to handle
// (tests/sync-service.test.mjs) and the status pill's to show (tests/sync-pill.test.mjs).
//
//   node tests/outage.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-outage-'));
const root = path.join(workFolder, 'dashboard');
fs.mkdirSync(path.join(root, 'core'), { recursive: true });
fs.writeFileSync(path.join(workFolder, 'package.json'), '{ "type": "module" }\n');
['config.js', 'registry.js'].forEach(file => copyModule(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(dashboardFolder).filter(file => /^config-.*\.js$/.test(file)).forEach(file => fs.copyFileSync(path.join(dashboardFolder, file), path.join(root, file)));
fs.readdirSync(path.join(dashboardFolder, 'core')).filter(file => file.endsWith('.js')).forEach(file => {
  copyModule(path.join(dashboardFolder, 'core', file), path.join(root, 'core', file));
});
['themes/registry.js', 'themes/overlays/registry.js'].forEach(file => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  copyModule(path.join(dashboardFolder, file), path.join(root, file));
});

const base = pathToFileURL(root).href + '/';
const { startSanityContent } = await import(base + 'core/content-source.js');

let failures = 0;
let total = 0;
async function test(name, run) {
  total += 1;
  try {
    await run();
    console.log('ok    ' + name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + name + '\n      ' + (error && error.stack ? error.stack : error));
  }
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const minute = 60 * 1000;

// One fake world. world.mode says how the file answers: ok, down (the server does not answer), status (an HTTP error),
// page (a page of a filter instead of JSON), half (JSON cut short) or empty (no result). world.storage is the saved copy,
// and world.storageFails makes it throw.
async function inWorld(run, options = {}) {
  const world = {
    now: Date.UTC(2026, 9, 18, 15, 0, 0), timers: [], nextId: 1, mode: options.mode || 'ok', tips: [{ text: 'first' }],
    contentReads: [], streams: 0, changes: [], saved: options.saved || null, storageFails: options.storageFails || false,
  };
  const names = ['fetch', 'EventSource', 'localStorage', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'];
  const originals = {};
  names.forEach(name => { originals[name] = Object.getOwnPropertyDescriptor(globalThis, name); });
  const realNow = Date.now;
  const realError = console.error;

  const add = (fn, delay, every) => {
    world.timers.push({ id: world.nextId, at: world.now + delay, fn: fn, every: every });
    world.nextId += 1;
    return world.nextId - 1;
  };
  const fakes = {
    fetch: async url => {
      if (String(url).endsWith('images/index.json')) return { ok: false, status: 404, text: async () => '' };
      world.contentReads.push(world.now);
      if (world.mode === 'down') throw new TypeError('Failed to fetch');
      if (world.mode === 'status') return { ok: false, status: 503, text: async () => '' };
      if (world.mode === 'page') return { ok: true, status: 200, text: async () => '<html>Blocked by the school filter</html>' };
      if (world.mode === 'half') return { ok: true, status: 200, text: async () => '{"result": {"settings": ' };
      if (world.mode === 'empty') return { ok: true, status: 200, text: async () => JSON.stringify({ result: null }) };
      return { ok: true, status: 200, text: async () => JSON.stringify({ syncedAt: '2026-10-18T15:00:00Z', result: { settings: { pageSeconds: 20 }, tipsAndNews: world.tips } }) };
    },
    EventSource: class {
      constructor() { world.streams += 1; }
    },
    localStorage: {
      getItem: () => {
        if (world.storageFails === 'read' || world.storageFails === 'both') throw new DOMException('denied', 'SecurityError');
        return world.saved;
      },
      setItem: (key, value) => {
        if (world.storageFails === 'write' || world.storageFails === 'both') throw new DOMException('full', 'QuotaExceededError');
        world.saved = value;
      },
    },
    setTimeout: (fn, delay) => add(fn, delay, null),
    setInterval: (fn, delay) => add(fn, delay, delay),
    clearTimeout: id => { world.timers = world.timers.filter(timer => timer.id !== id); },
    clearInterval: id => { world.timers = world.timers.filter(timer => timer.id !== id); },
  };
  world.advance = async milliseconds => {
    const end = world.now + milliseconds;
    for (;;) {
      const due = world.timers.filter(timer => timer.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      world.now = Math.max(world.now, due.at);
      if (due.every) due.at += due.every;
      else world.timers = world.timers.filter(timer => timer !== due);
      due.fn();
      await settle();
    }
    world.now = end;
    await settle();
  };

  names.forEach(name => Object.defineProperty(globalThis, name, { value: fakes[name], configurable: true, writable: true }));
  Date.now = () => world.now;
  console.error = () => {};
  let reader = null;
  try {
    reader = await startSanityContent(state => world.changes.push(state));
    world.reader = reader;
    await run(world, reader);
  } finally {
    if (reader) reader.stop();
    console.error = realError;
    Date.now = realNow;
    names.forEach(name => {
      if (originals[name]) Object.defineProperty(globalThis, name, originals[name]);
      else delete globalThis[name];
    });
  }
}

const lastState = world => world.changes[world.changes.length - 1];
const tipCount = state => state.content.tipsAndNews.length;

await test('an outage in the middle of a run changes nothing on the screen, however long it lasts, and never says offline', async () => {
  await inWorld(async (world, reader) => {
    await world.advance(30 * 1000);
    world.mode = 'down';
    await world.advance(30 * minute);
    assert.equal(world.changes.length, 0, 'nothing is announced');
    assert.equal(reader.first.status.offline, false);
    assert.equal(tipCount(reader.first), 1, 'the content stays on the screen');
  });
});

await test('it recovers by itself within 5 seconds of the file coming back, and takes the new content', async () => {
  await inWorld(async world => {
    world.mode = 'down';
    await world.advance(4 * minute);
    assert.equal(world.changes.length, 0);

    world.tips = [{ text: 'a' }, { text: 'b' }];
    world.mode = 'ok';
    await world.advance(5 * 1000);
    const state = lastState(world);
    assert.equal(state.status.offline, false);
    assert.equal(state.status.reason, '');
    assert.equal(tipCount(state), 2);
  });
});

await test('a long outage is asked about at the same easy pace: one read of a local file every 5 seconds, no stream', async () => {
  await inWorld(async world => {
    world.mode = 'down';
    const before = world.contentReads.length;
    await world.advance(10 * minute);
    const reads = world.contentReads.length - before;
    assert.ok(reads <= 10 * 12 + 2, reads + ' reads in 10 minutes');
    assert.equal(world.streams, 0);
  });
});

await test('a page of a filter, half a file, an error status and an empty result each keep the content and say nothing', async () => {
  for (const mode of ['page', 'half', 'status', 'empty']) {
    await inWorld(async (world, reader) => {
      world.mode = mode;
      await world.advance(8 * minute);
      assert.equal(world.changes.length, 0, mode + ': nothing is announced');
      assert.equal(tipCount(reader.first), 1, mode + ': the content stays');
      assert.equal(reader.first.status.offline, false, mode);

      world.mode = 'ok';
      world.tips = [{ text: 'a' }, { text: 'b' }];
      await world.advance(5 * 1000);
      assert.equal(tipCount(lastState(world)), 2, mode + ': it recovers');
      assert.equal(lastState(world).status.offline, false, mode);
    });
  }
});

await test('a damaged saved copy never stops the start, and the first read of the file replaces it', async () => {
  for (const saved of ['{not json', 'null', '{"raw":5}', '{"raw":[1]}', '{"savedAt":1,"raw":{"settings":7,"tipsAndNews":"x","people":[null,5]}}', 'x'.repeat(100000)]) {
    await inWorld(async (world, reader) => {
      assert.ok(reader.first.content, saved.slice(0, 20));
      await world.advance(1000);
      const state = lastState(world) || reader.first;
      assert.equal(state.status.source, 'sanity', saved.slice(0, 20));
      assert.equal(tipCount(state), 1, saved.slice(0, 20));
    }, { saved: saved });
  }
});

await test('with no saved copy and no file, the screen starts empty and fills in when the file arrives', async () => {
  await inWorld(async (world, reader) => {
    assert.equal(tipCount(reader.first), 0, 'nothing invented');
    world.mode = 'ok';
    await world.advance(5 * 1000);
    assert.equal(tipCount(lastState(world)), 1);
  }, { saved: null, mode: 'down' });
});

await test('a saved copy that cannot be read or written never stops the reading', async () => {
  for (const storageFails of ['read', 'write', 'both']) {
    await inWorld(async (world, reader) => {
      assert.equal(tipCount(reader.first), 1, storageFails);
      world.tips = [{ text: 'a' }, { text: 'b' }];
      await world.advance(6 * 1000);
      assert.equal(tipCount(lastState(world)), 2, storageFails + ': the next read still arrives');
    }, { storageFails: storageFails });
  }
});

fs.rmSync(workFolder, { recursive: true, force: true });
console.log('\n' + (total - failures) + ' of ' + total + ' passed');
if (failures > 0) process.exitCode = 1;
