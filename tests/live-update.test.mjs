// A publish in the Studio reaches the wall within seconds. The screen reads the local snapshot that the sync service
// writes (data/live/content.json), never Sanity. Nothing touches the network: fetch and the clock are fakes. Pins that every
// read is a same-origin file read with no cache, that a changed file reaches the screen at the next poll, that a read that
// fails keeps the content and says nothing, and that Publish all sleeps between documents.
//
//   node tests/live-update.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { copyModule } from './helpers/copy-module.mjs';

const dashboardFolder = fileURLToPath(new URL('../dashboard/', import.meta.url));
const studioFolder = fileURLToPath(new URL('../studio/', import.meta.url));

const workFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-live-update-'));
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
const sanityModule = await import(base + 'core/sanity.js');

let failures = 0;
async function test(name, run) {
  try {
    await run();
    console.log('ok    ' + name);
  } catch (error) {
    failures += 1;
    console.log('FAIL  ' + name + '\n      ' + (error && error.stack ? error.stack : error));
  }
}

const settle = () => new Promise(resolve => setImmediate(resolve));

// One fake world: a clock that moves only when advance() is called, and a fetch that records the address and the options and
// answers the two files of the data folder from world.file and world.index. world.broken makes every read fail.
async function inWorld(run) {
  const world = { now: Date.UTC(2026, 9, 18, 15, 0, 0), timers: [], nextId: 1, calls: [], settings: { pageSeconds: 20 }, tips: [], changes: [], broken: false, index: null, streams: 0 };
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
  world.file = () => JSON.stringify({ syncedAt: new Date(world.now).toISOString(), result: { settings: world.settings, tipsAndNews: world.tips } });
  const fakes = {
    fetch: async (url, options) => {
      world.calls.push({ at: world.now, url: String(url), options: options || {} });
      if (world.broken) throw new TypeError('fetch failed');
      if (String(url).endsWith('content.json')) return { ok: true, status: 200, text: async () => world.file() };
      if (String(url).endsWith('images/index.json')) {
        if (world.index === null) return { ok: false, status: 404, text: async () => '' };
        return { ok: true, status: 200, text: async () => JSON.stringify(world.index) };
      }
      return { ok: false, status: 404, text: async () => '' };
    },
    EventSource: class {
      constructor() { world.streams += 1; }
    },
    localStorage: { getItem: () => null, setItem: () => {} },
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
  try {
    await run(world);
  } finally {
    console.error = realError;
    Date.now = realNow;
    names.forEach(name => {
      if (originals[name]) Object.defineProperty(globalThis, name, originals[name]);
      else delete globalThis[name];
    });
  }
}

await test('a changed file is applied at the next poll, within 5 seconds, and an unchanged file hands nothing on', async () => {
  await inWorld(async world => {
    const started = await startSanityContent(change => world.changes.push(change));
    await world.advance(5 * 1000);
    assert.equal(world.changes.length, 0, 'the same content again is not a change');

    world.tips = [{ _id: 't1', kind: 'tip', text: '[A new tip]', show: true }];
    await world.advance(5 * 1000);

    assert.equal(world.changes.length, 1, 'the new content was handed on');
    assert.equal(world.changes[0].content.tipsAndNews[0].text, '[A new tip]');
    started.stop();
  });
});

await test('every read is a file of this server with no cache, and nothing asks Sanity or opens a stream', async () => {
  await inWorld(async world => {
    const started = await startSanityContent(() => {});
    await world.advance(60 * 1000);
    assert.ok(world.calls.length >= 20, 'it polled: ' + world.calls.length);
    world.calls.forEach(call => {
      assert.ok(call.url.startsWith('data/live/'), 'a file of the data folder: ' + call.url);
      assert.equal(call.options.cache, 'no-store');
    });
    assert.equal(world.streams, 0, 'no stream');
    started.stop();
  });
  assert.equal(sanityModule.requestsUrl, undefined, 'the request poll is gone');
  assert.equal(sanityModule.liveEventsUrl, undefined, 'the stream is gone');
  assert.equal(sanityModule.probeUrl, undefined, 'the cross-origin probe is gone');
});

await test('a read that fails keeps the content, announces nothing and never says offline', async () => {
  await inWorld(async world => {
    world.tips = [{ _id: 't1', kind: 'tip', text: '[Kept tip]', show: true }];
    const started = await startSanityContent(change => world.changes.push(change));
    assert.equal(started.first.content.tipsAndNews[0].text, '[Kept tip]');

    world.broken = true;
    await world.advance(10 * 60 * 1000);
    assert.equal(world.changes.length, 0, 'no change event for a failed read');
    assert.equal(started.first.status.offline, false);
    assert.equal(started.first.status.reason, '');

    world.broken = false;
    world.tips = [{ _id: 't2', kind: 'tip', text: '[Later tip]', show: true }];
    await world.advance(5 * 1000);
    assert.equal(world.changes.length, 1);
    assert.equal(world.changes[0].status.offline, false);
    started.stop();
  });
});

await test('the list of downloaded pictures reaches images.js before the content is cleaned, and a missing list is no problem', async () => {
  await inWorld(async world => {
    const { photoUrl, useLocalImages } = await import(base + 'core/images.js');
    const photo = { url: 'https://cdn.sanity.io/images/p/production/a-100x100.jpg', width: 100, height: 100 };
    const address = photoUrl(photo, 280, 280);
    assert.ok(address.startsWith('https://cdn.sanity.io/'));

    world.index = {};
    world.index[address] = 'images/abc123.jpg';
    const started = await startSanityContent(() => {});
    assert.equal(photoUrl(photo, 280, 280), 'data/live/images/abc123.jpg');
    started.stop();
    useLocalImages({});
  });
});

await test('the source keeps the saved copy and a short poll of a local file', () => {
  const source = fs.readFileSync(path.join(dashboardFolder, 'core/content-source.js'), 'utf8');
  assert.ok(/const pollEvery = 5 \* 1000;/.test(source));
  assert.ok(source.includes('saveCopy(raw, updated)') && source.includes('readSavedCopy'));
  assert.ok(!source.includes('EventSource') && !source.includes('api.sanity.io'));
});

await test('Publish all has no sleep or delay between documents', () => {
  ['publish-all.js', 'publish-all-tool.js'].forEach(file => {
    const text = fs.readFileSync(path.join(studioFolder, 'tools', file), 'utf8');
    assert.ok(!/setTimeout|setInterval|sleep\(|delay\(|new Promise\(\s*resolve\s*=>\s*(setTimeout|window)/.test(text), file + ' waits');
  });
});

await test('a page on screen is drawn again when the content changes, and the ticker moves to a new line at once', () => {
  const shell = fs.readFileSync(path.join(dashboardFolder, 'shell-content.js'), 'utf8');
  assert.ok(shell.includes('refreshPagesInPlace()'));
  const schedule = fs.readFileSync(path.join(dashboardFolder, 'core/schedule-run.js'), 'utf8');
  assert.ok(schedule.includes('page.rebuild = () => rebuildFor(step)'));
  assert.ok(schedule.includes("moveOn(['ticker'])"));
  const refresh = fs.readFileSync(path.join(dashboardFolder, 'core/page-refresh.js'), 'utf8');
  assert.ok(refresh.includes('clockHeld') && refresh.includes('restingPage'), 'a page under a swap or a transition is left alone');
});

if (failures > 0) {
  console.log('\n' + failures + ' failed');
  process.exit(1);
}
console.log('\nall passed');
