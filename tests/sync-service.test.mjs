// Tests for computer/scripts/sync-service.mjs: what it writes to the data folder, that a failed fetch keeps the last good
// copy and never blanks a file, the cheap check before the full read, the pictures and their list, the weather, and the
// status file. The network is a fake fetch, the folder and the log are temporary.
//
//   node tests/sync-service.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-sync-'));
process.env.TELETRAAN_LOG_DIR = path.join(work, 'log');

const { createSync, wantedImages, writeFileAtomic, timing } = await import(path.join(repo, 'computer/scripts/sync-service.mjs'));

let passed = 0;
let counter = 0;

async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const person = { name: 'Sam', photo: { url: 'https://cdn.sanity.io/images/p/production/aaa-400x400.jpg', width: 400, height: 400 } };
const photo = { id: 'ph1', image: { url: 'https://cdn.sanity.io/images/p/production/bbb-4000x3000.jpg', width: 4000, height: 3000 } };
const team = { code: 'prime', logo: { url: 'https://cdn.sanity.io/images/p/production/ccc-600x600.png', width: 600, height: 600 } };
const content = { people: [person], photos: [photo], teams: [team], monday: { lastSyncAt: '2026-10-30T12:00:00Z' }, frc: { lastSyncAt: '2026-10-30T12:01:00Z' } };

// A world: a fake network that answers the cheap check, the full query, the weather and the pictures
function world(overrides = {}) {
  counter += 1;
  const folder = path.join(work, 'data' + counter);
  fs.mkdirSync(folder, { recursive: true });
  const w = {
    folder: folder,
    time: Date.parse('2026-10-30T15:00:00Z'),
    signature: { count: 10, latest: '2026-10-30T14:00:00Z' },
    result: content,
    down: false,
    htmlInstead: false,
    pictureFails: new Set(),
    calls: [],
    weather: { current: { temperature_2m: 61.4, weather_code: 3, is_day: 1 }, daily: { temperature_2m_max: [70.2], temperature_2m_min: [48.6] } },
  };
  Object.assign(w, overrides);
  w.fetch = async (url) => {
    const address = String(url);
    w.calls.push(address);
    if (w.down) throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    if (address.startsWith('http://sanity.test/')) {
      if (w.htmlInstead) return new Response('<html>Blocked by the filter</html>', { status: 200, headers: { 'content-type': 'text/html' } });
      return json({ result: address.includes(encodeURIComponent('count(*)')) ? w.signature : w.result });
    }
    if (address.startsWith('http://weather.test/')) return json(w.weather);
    if (address.startsWith('https://cdn.sanity.io/')) {
      if (w.pictureFails.has(address)) return new Response('no', { status: 503 });
      return new Response(Buffer.from('picture bytes for ' + address), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    }
    return new Response('?', { status: 404 });
  };
  w.sync = createSync({ dataDir: folder, sanityBase: 'http://sanity.test', weatherUrl: 'http://weather.test/forecast', now: () => w.time, fetch: w.fetch, noProbe: true });
  w.read = name => JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
  w.queries = () => w.calls.filter(address => address.startsWith('http://sanity.test/')).length;
  return w;
}

await check('the first check reads the content and writes content.json with the result and the time', async () => {
  const w = world();
  assert.equal(await w.sync.checkSanity(), true);
  const file = w.read('content.json');
  assert.deepEqual(file.result, content);
  assert.equal(file.syncedAt, '2026-10-30T15:00:00.000Z');
  assert.equal(w.sync.state.sanity.lastSuccessAt, '2026-10-30T15:00:00.000Z');
  assert.equal(w.queries(), 2, 'the cheap check, then the full read');
});

await check('a check with nothing new asks one small question and does not read again before five minutes', async () => {
  const w = world();
  await w.sync.checkSanity();
  w.time += 10 * 1000;
  assert.equal(await w.sync.checkSanity(), false);
  assert.equal(w.queries(), 3);
  w.time += (timing.fullReadEvery + 1) * 1000;
  assert.equal(await w.sync.checkSanity(), true, 'five minutes later the whole read happens anyway');
});

await check('a publish (a new newest edit) is read at the next check', async () => {
  const w = world();
  await w.sync.checkSanity();
  w.signature = { count: 11, latest: '2026-10-30T15:00:05Z' };
  w.result = Object.assign({}, content, { tipsAndNews: [{ text: 'new' }] });
  w.time += 10 * 1000;
  assert.equal(await w.sync.checkSanity(), true);
  assert.deepEqual(w.read('content.json').result.tipsAndNews, [{ text: 'new' }]);
});

await check('a failed fetch keeps the last good file, records the reason and the time, and the next good one recovers', async () => {
  const w = world();
  await w.sync.checkSanity();
  const before = fs.readFileSync(path.join(w.folder, 'content.json'), 'utf8');
  w.down = true;
  w.time += 10 * 1000;
  await w.sync.checkSanity();
  assert.equal(fs.readFileSync(path.join(w.folder, 'content.json'), 'utf8'), before, 'the file is untouched');
  assert.equal(w.sync.state.sanity.lastFailureAt, '2026-10-30T15:00:10.000Z');
  assert.match(w.sync.state.sanity.lastFailureReason, /ENOTFOUND/);
  assert.equal(w.sync.state.sanity.lastSuccessAt, '2026-10-30T15:00:00.000Z', 'the last success stays');
  w.down = false;
  w.time += 10 * 1000;
  await w.sync.checkSanity();
  assert.equal(w.sync.state.sanity.lastSuccessAt, '2026-10-30T15:00:20.000Z');
});

await check('a 200 that is a page of the school filter, not JSON, is a failure and keeps the last good file', async () => {
  const w = world();
  await w.sync.checkSanity();
  const before = fs.readFileSync(path.join(w.folder, 'content.json'), 'utf8');
  w.htmlInstead = true;
  w.time += 10 * 1000;
  await w.sync.checkSanity();
  assert.equal(fs.readFileSync(path.join(w.folder, 'content.json'), 'utf8'), before);
  assert.match(w.sync.state.sanity.lastFailureReason, /not json/);
});

await check('a first run that fails writes no content file at all, so the dashboard keeps its saved copy', async () => {
  const w = world({ down: true });
  await w.sync.checkSanity();
  assert.equal(fs.existsSync(path.join(w.folder, 'content.json')), false);
  const status = w.sync.writeStatus();
  assert.equal(status.sources.sanity.lastSuccessAt, null);
  assert.ok(status.sources.sanity.lastFailureReason);
});

await check('the pictures the content names are downloaded and listed by the address the dashboard asks for', async () => {
  const w = world();
  await w.sync.checkSanity();
  await w.sync.memory.imagesRun;
  const index = w.read('images/index.json');
  const wanted = wantedImages(content);
  assert.equal(wanted.length, 3);
  wanted.forEach(address => {
    assert.ok(index[address], address);
    assert.match(index[address], /^images\/[0-9a-f]{24}\.jpg$/);
    assert.ok(fs.existsSync(path.join(w.folder, index[address])), 'the file is there');
  });
  assert.match(wanted[0], /w=280&h=280&fit=crop/, 'a portrait is asked for at 280 square');
  assert.match(wanted[1], /w=1920&fit=max/, 'a photo of the Photo panel is as wide as the screen');
  assert.match(wanted[2], /w=600&fit=max/, 'a logo is at most 600');
  assert.equal(w.sync.state.images.lastSuccessAt, '2026-10-30T15:00:00.000Z');
});

await check('a picture that did not arrive stays out of the list, is tried again, and the others are kept', async () => {
  const w = world();
  const wanted = wantedImages(content);
  w.pictureFails.add(wanted[1]);
  await w.sync.checkSanity();
  await w.sync.memory.imagesRun;
  let index = w.read('images/index.json');
  assert.equal(index[wanted[1]], undefined, 'the dashboard keeps the Sanity address of this one');
  assert.ok(index[wanted[0]] && index[wanted[2]]);
  assert.match(w.sync.state.images.lastFailureReason, /1 pictures not downloaded/);
  assert.equal(w.sync.imagesPending(), true);

  w.pictureFails.clear();
  await w.sync.syncImages();
  index = w.read('images/index.json');
  assert.ok(index[wanted[1]], 'the retry brought it');
  assert.equal(w.sync.imagesPending(), false);
});

await check('a picture the content no longer names is removed, a picture that is still named is not downloaded twice', async () => {
  const w = world();
  await w.sync.checkSanity();
  await w.sync.memory.imagesRun;
  const pictureCalls = () => w.calls.filter(address => address.startsWith('https://cdn.sanity.io/')).length;
  assert.equal(pictureCalls(), 3);
  w.signature = { count: 11, latest: '2026-10-30T15:00:05Z' };
  w.result = Object.assign({}, content, { photos: [] });
  w.time += 10 * 1000;
  await w.sync.checkSanity();
  await w.sync.memory.imagesRun;
  assert.equal(pictureCalls(), 3, 'nothing downloaded again');
  assert.equal(Object.keys(w.read('images/index.json')).length, 2);
  assert.equal(fs.readdirSync(path.join(w.folder, 'images')).length, 3, 'two pictures and the list');
});

await check('the weather is written as the reading the dashboard keeps, and a failed read leaves the last one', async () => {
  const w = world();
  assert.equal(await w.sync.syncWeather(), true);
  assert.deepEqual(w.read('weather.json'), { temperature: 61, high: 70, low: 49, code: 3, isDay: true, savedAt: w.time });
  const before = fs.readFileSync(path.join(w.folder, 'weather.json'), 'utf8');
  w.weather = { current: {} };
  w.time += 60 * 1000;
  assert.equal(await w.sync.syncWeather(), false);
  assert.equal(fs.readFileSync(path.join(w.folder, 'weather.json'), 'utf8'), before);
  assert.match(w.sync.state.weather.lastFailureReason, /expected shape/);
});

await check('sync-status.json has the shape the status poller reads, every source by name', async () => {
  const w = world();
  await w.sync.checkSanity();
  await w.sync.syncWeather();
  fs.writeFileSync(path.join(w.folder, 'calendar-sync.txt'), 'team|2026-10-30T14:58:00Z|\nshop|2026-10-30T14:50:00Z|the server took too long to answer\n');
  const status = w.sync.writeStatus();
  assert.deepEqual(Object.keys(status), ['generatedAt', 'sources']);
  assert.deepEqual(Object.keys(status.sources), ['sanity', 'weather', 'images', 'monday', 'competition', 'calendars']);
  Object.values(status.sources).forEach(source => assert.deepEqual(Object.keys(source), ['lastSuccessAt', 'lastFailureAt', 'lastFailureReason']));
  assert.equal(status.sources.monday.lastSuccessAt, '2026-10-30T12:00:00Z', 'read from the monday-status document in the content');
  assert.equal(status.sources.competition.lastSuccessAt, '2026-10-30T12:01:00Z');
  assert.equal(status.sources.calendars.lastSuccessAt, '2026-10-30T14:58:00Z');
  assert.equal(status.sources.calendars.lastFailureReason, 'the server took too long to answer');
  assert.deepEqual(w.read('sync-status.json'), status);
  const hosts = JSON.stringify(status);
  assert.ok(!/https?:\/\//.test(hosts), 'no address in the status');
});

await check('a restart keeps the times of the last good reads, so the pill does not start from nothing', async () => {
  const w = world();
  await w.sync.checkSanity();
  w.sync.writeStatus();
  const again = createSync({ dataDir: w.folder, sanityBase: 'http://sanity.test', weatherUrl: 'http://weather.test/forecast', now: () => w.time, fetch: w.fetch, noProbe: true });
  assert.equal(again.state.sanity.lastSuccessAt, '2026-10-30T15:00:00.000Z');
});

await check('a file is written by way of a temporary name, so no half file is ever read', async () => {
  const file = path.join(work, 'atomic', 'x.json');
  writeFileAtomic(file, '{"a":1}');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"a":1}');
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['x.json'], 'no temporary file is left');
});

await check('the log gets one JSON line for each event with ts, service, source, event and detail', async () => {
  const lines = fs.readFileSync(path.join(work, 'log', 'sync.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.ok(lines.length > 3);
  lines.forEach(line => assert.deepEqual(Object.keys(line), ['ts', 'service', 'source', 'event', 'detail']));
  assert.ok(lines.some(line => line.source === 'sanity' && line.event === 'check_failed'));
  assert.ok(lines.some(line => line.source === 'sanity' && line.event === 'recovered'));
});

fs.rmSync(work, { recursive: true, force: true });
console.log(passed + ' of ' + passed + ' checks passed.');
