// A publish in the Studio reaches the wall within a second or two. Nothing touches the network: fetch, EventSource and
// the clock are fakes. Pins the wait between the change event and the new content, the host that is read after an event,
// the host of the request poll, and that Publish all sleeps between documents.
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
const { sanity } = await import(base + 'config.js');

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

function reply(result) {
  return { ok: true, status: 200, json: async () => ({ result: result }) };
}

// One fake world: a clock that moves only when advance() is called, a fetch that records the address and the options
// and answers from world.settings, and one stream that a test can send a message through
async function inWorld(run) {
  const world = { now: Date.UTC(2026, 9, 18, 15, 0, 0), timers: [], nextId: 1, calls: [], settings: { pageSeconds: 20 }, tips: [], streams: [], changes: [] };
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
    fetch: async (url, options) => {
      world.calls.push({ at: world.now, url: String(url), options: options || {} });
      const text = decodeURIComponent(String(url));
      if (text.includes('[0] { announceRequest')) return reply(world.settings);
      return reply({ settings: world.settings, tipsAndNews: world.tips });
    },
    EventSource: class {
      constructor() { this.listeners = {}; this.readyState = 1; world.streams.push(this); }
      addEventListener(type, run) { this.listeners[type] = (this.listeners[type] || []).concat(run); }
      emit(type) { (this.listeners[type] || []).forEach(run => run({ type: type })); }
      close() { this.readyState = 2; }
    },
    localStorage: { getItem: () => null, setItem: () => {} },
    setTimeout: (fn, delay) => add(fn, delay, null),
    setInterval: (fn, delay) => add(fn, delay, delay),
    clearTimeout: id => { world.timers = world.timers.filter(timer => timer.id !== id); },
    clearInterval: id => { world.timers = world.timers.filter(timer => timer.id !== id); },
  };
  fakes.EventSource.CLOSED = 2;
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

const host = url => new URL(url).host;

await test('a change event is followed by a read of the content within one second, and the new content is applied', async () => {
  await inWorld(async world => {
    const started = await startSanityContent(change => world.changes.push(change));
    const reads = world.calls.length;
    world.tips = [{ _id: 't1', kind: 'tip', text: '[A new tip]', show: true }];

    world.streams[0].emit('message');
    await world.advance(999);

    assert.equal(world.calls.length, reads + 1, 'one read follows the event');
    assert.equal(world.changes.length, 1, 'the new content was handed on');
    assert.equal(world.changes[0].content.tipsAndNews[0].text, '[A new tip]');
    started.stop();
  });
});

await test('edits that arrive together still make one read', async () => {
  await inWorld(async world => {
    const started = await startSanityContent(() => {});
    const reads = world.calls.length;
    for (let edit = 0; edit < 5; edit += 1) {
      world.streams[0].emit('message');
      await world.advance(50);
    }
    await world.advance(1000);
    assert.equal(world.calls.length, reads + 1);
    started.stop();
  });
});

await test('the read after an event goes to the live host, with no cache', async () => {
  await inWorld(async world => {
    const started = await startSanityContent(() => {});
    world.streams[0].emit('message');
    await world.advance(1000);
    const after = world.calls[world.calls.length - 1];
    assert.ok(host(after.url).endsWith('.api.sanity.io') && !host(after.url).includes('apicdn'), 'the live host: ' + host(after.url));
    assert.equal(after.options.cache, 'no-store');
    started.stop();
  });
});

await test('no read the screen makes goes to the cached host, the 5 minute read included', async () => {
  await inWorld(async world => {
    const started = await startSanityContent(() => {});
    await world.advance(5 * 60 * 1000 + 1000);
    assert.ok(world.calls.length >= 3, 'the full read and some polls ran');
    world.calls.forEach(call => assert.ok(!host(call.url).includes('apicdn'), 'cached host used: ' + call.url));
    started.stop();
  });
  assert.ok(!sanityModule.requestsUrl(sanity).includes('apicdn'));
  assert.ok(!sanityModule.queryUrl(sanity).includes('apicdn'));
  assert.ok(sanityModule.requestsUrl(sanity).includes('perspective=published'));
});

await test('the request poll asks every 10 seconds and a new request reaches the screen in that time', async () => {
  await inWorld(async world => {
    const started = await startSanityContent(change => world.changes.push(change));
    await world.advance(10 * 1000);
    const before = world.changes.length;

    world.settings = { pageSeconds: 20, announceRequest: { requestedAt: new Date(world.now).toISOString() } };
    await world.advance(10 * 1000);
    assert.equal(world.changes.length, before + 1);
    started.stop();
  });
});

await test('the source keeps the wait after an event short and the offline cache and the 5 minute read in place', () => {
  const source = fs.readFileSync(path.join(dashboardFolder, 'core/content-source.js'), 'utf8');
  const wait = Number(/const waitForMoreEdits = (\d+);/.exec(source)[1]);
  assert.ok(wait <= 500, 'the wait after an event is ' + wait + ' ms');
  assert.ok(/const pollEvery = 5 \* 60 \* 1000;/.test(source));
  assert.ok(source.includes('saveCopy(raw, updated)') && source.includes('readSavedCopy'));
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
