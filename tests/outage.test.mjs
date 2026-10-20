// What the content reader does when Sanity goes away and comes back (core/content-source.js): the screen keeps its
// content, says so after two minutes, asks again at a polite pace and recovers by itself. Also bad answers (a login
// page, half a file, no result), and a saved copy that is damaged or cannot be written. Nothing touches the network:
// fetch, EventSource, localStorage and the clock are fakes.
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

// One fake world. world.mode says how Sanity answers: ok, down (no network), status (an HTTP error), page (a login page
// instead of JSON), half (JSON cut short) or empty (no result). world.storage is the saved copy, and
// world.storageFails makes it throw.
async function inWorld(run, options = {}) {
  const world = {
    now: Date.UTC(2026, 9, 18, 15, 0, 0), timers: [], nextId: 1, mode: options.mode || 'ok', tips: [{ text: 'first' }],
    contentReads: [], requestReads: 0, streams: [], changes: [], saved: options.saved || null, storageFails: options.storageFails || false,
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
  const answer = body => ({ ok: true, status: 200, json: async () => body });
  const fakes = {
    fetch: async url => {
      const text = decodeURIComponent(String(url));
      const isContent = text.includes('"settings": *[_id');
      const isRequests = text.includes('[0] { announceRequest');
      if (isContent) world.contentReads.push(world.now);
      if (isRequests) world.requestReads += 1;
      if (!isContent && !isRequests) {
        if (world.mode === 'down') throw new TypeError('Failed to fetch');
        return answer({});
      }

      if (world.mode === 'down') throw new TypeError('Failed to fetch');
      if (world.mode === 'poll-down' && isRequests) throw new TypeError('Failed to fetch');
      if (world.mode === 'status') return { ok: false, status: 503, json: async () => ({}) };
      if (world.mode === 'page') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };
      if (world.mode === 'half') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } };
      if (world.mode === 'empty') return answer({ result: null });
      if (isRequests) return answer({ result: { pageSeconds: 20 } });
      return answer({ result: { settings: { pageSeconds: 20 }, tipsAndNews: world.tips } });
    },
    EventSource: class {
      constructor() { this.listeners = {}; this.readyState = 1; world.streams.push(this); }
      addEventListener(type, run) { this.listeners[type] = (this.listeners[type] || []).concat(run); }
      close() { this.readyState = 2; }
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

await test('an outage in the middle of a run is noticed within about two minutes, not after the next five minute read', async () => {
  await inWorld(async world => {
    await world.advance(30 * 1000);
    world.mode = 'down';
    const wentDown = world.now;
    let noticed = null;
    for (let second = 0; second < 6 * 60 && noticed === null; second += 5) {
      await world.advance(5 * 1000);
      const state = lastState(world);
      if (state && state.status.offline) noticed = world.now - wentDown;
    }
    assert.ok(noticed !== null, 'the screen never said Sanity was unreachable');
    assert.ok(noticed <= 2.5 * minute + 10 * 1000, 'noticed after ' + noticed / 1000 + ' seconds');
    assert.equal(lastState(world).status.reason, 'network');
    assert.equal(tipCount(lastState(world)), 1, 'the content stays on the screen');
  });
});

await test('it recovers by itself within 30 seconds of Sanity coming back, and takes the new content', async () => {
  await inWorld(async world => {
    world.mode = 'down';
    await world.advance(4 * minute);
    assert.equal(lastState(world).status.offline, true);

    world.tips = [{ text: 'a' }, { text: 'b' }];
    world.mode = 'ok';
    await world.advance(35 * 1000);
    const state = lastState(world);
    assert.equal(state.status.offline, false);
    assert.equal(state.status.reason, '');
    assert.equal(tipCount(state), 2);
  });
});

await test('a long outage is asked about politely: one read every 30 seconds and a request poll every 10', async () => {
  await inWorld(async world => {
    world.mode = 'down';
    const before = world.contentReads.length;
    const pollsBefore = world.requestReads;
    await world.advance(10 * minute);
    const reads = world.contentReads.length - before;
    const polls = world.requestReads - pollsBefore;
    assert.ok(reads <= 10 * 2 + 3, reads + ' full reads in 10 minutes');
    assert.ok(polls <= 10 * 6 + 3, polls + ' request polls in 10 minutes');
  });
});

await test('a request poll that always fails while the content reads fine costs at most one full read a minute', async () => {
  await inWorld(async world => {
    world.mode = 'poll-down';
    const before = world.contentReads.length;
    await world.advance(10 * minute);
    const reads = world.contentReads.length - before;
    assert.ok(reads <= 10 + 3, reads + ' full reads in 10 minutes');
    assert.equal(lastState(world) === undefined || lastState(world).status.offline === false, true, 'the screen does not say Sanity is unreachable');
  });
});

await test('a login page, half a file, an error status and an empty result each keep the content and say other', async () => {
  for (const mode of ['page', 'half', 'status', 'empty']) {
    await inWorld(async world => {
      world.mode = mode;
      // an empty result is a poll answer that is not a failure, so only the full read (every 5 minutes) finds it
      await world.advance(8 * minute);
      const state = lastState(world);
      assert.ok(state, mode + ': no state');
      assert.equal(tipCount(state), 1, mode + ': the content stays');
      assert.equal(state.status.offline, true, mode);
      assert.equal(state.status.reason, 'other', mode);

      world.mode = 'ok';
      await world.advance(35 * 1000);
      assert.equal(lastState(world).status.offline, false, mode + ': it recovers');
    });
  }
});

await test('a damaged saved copy never stops the start, and the first read from Sanity replaces it', async () => {
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

await test('with no saved copy and Sanity down, the screen starts empty and fills in when Sanity answers', async () => {
  await inWorld(async (world, reader) => {
    assert.equal(tipCount(reader.first), 0, 'nothing invented');
    world.mode = 'ok';
    await world.advance(35 * 1000);
    assert.equal(tipCount(lastState(world)), 1);
  }, { saved: null, mode: 'down' });
});

await test('a saved copy that cannot be read or written never stops the reading', async () => {
  for (const storageFails of ['read', 'write', 'both']) {
    await inWorld(async (world, reader) => {
      assert.equal(tipCount(reader.first), 1, storageFails);
      world.tips = [{ text: 'a' }, { text: 'b' }];
      await world.advance(6 * minute);
      assert.equal(tipCount(lastState(world)), 2, storageFails + ': the next read still arrives');
    }, { storageFails: storageFails });
  }
});

fs.rmSync(workFolder, { recursive: true, force: true });
console.log('\n' + (total - failures) + ' of ' + total + ' passed');
if (failures > 0) process.exitCode = 1;
