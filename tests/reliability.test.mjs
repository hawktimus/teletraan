// The outage drill in a real browser (docs/reliability-drill.md). Each case opens the dashboard as the wall runs it
// (the editors' content, not the sample) with Sanity, the local data files or the saved copy made to fail in one way,
// and checks that the screen still came up: the page started, the title carries the heartbeat clock, the stage holds
// drawn pieces and nothing was thrown. Nothing leaves this computer: every outside address is answered by the test.
//
// Playwright is not on the Teletraan computer. Without it, or without its browser, this file says so and exits 0,
// like tests/motion. To run it on a laptop that has it: NODE_PATH=/path/to/node_modules node tests/reliability.test.mjs
//
//   node tests/reliability.test.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveDashboard } from '../tools/screenshots.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const playwright = await loadPlaywright();
if (!playwright) {
  console.log('skip  reliability drill: Playwright is not installed here');
  process.exit(0);
}

let browser = null;
try {
  browser = await playwright.chromium.launch();
} catch (error) {
  console.log('skip  reliability drill: the browser of Playwright is not installed here');
  process.exit(0);
}

const server = await serveDashboard(path.join(repo, 'dashboard'));
const base = 'http://127.0.0.1:' + server.port;
const sample = JSON.parse(fs.readFileSync(path.join(repo, 'dashboard/data/sample/content.json'), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

const calendar = body => 'BEGIN:VCALENDAR\nVERSION:2.0\n' + body + 'END:VCALENDAR\n';
const event = (number, day) => 'BEGIN:VEVENT\nUID:e' + number + '\nDTSTAMP:20260101T000000Z\nDTSTART:' + day + 'T100000\nDTEND:' + day + 'T110000\nSUMMARY:Event ' + number + '\nEND:VEVENT\n';
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10).replace(/-/g, '');

// How Sanity answers the read of the content: ok, down, 500, 403, page (a login page), half (JSON cut short) or null
function answerFor(mode, raw, route) {
  if (mode === 'down') return route.abort('internetdisconnected');
  if (mode === '500' || mode === '403') return route.fulfill({ status: Number(mode), body: 'no' });
  if (mode === 'page') return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>sign in</html>' });
  if (mode === 'half') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"result":{"settings":{"x":' });
  if (mode === 'null') return route.fulfill({ status: 200, json: { result: null } });
  return route.fulfill({ status: 200, json: { result: raw } });
}

// Opens the wall in a fresh browser context. options: mode, raw, files (name in data/live to its text, or missing),
// storedCopy (text put in the saved copy before the page starts), storage (a function that runs in the page before it starts), weatherDown, imagesMissing, query.
async function open(options) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, timezoneId: 'America/New_York' });
  const page = await context.newPage();
  page.thrown = [];
  page.on('pageerror', error => page.thrown.push(error.message));

  await page.route('**/control/api/**', route => route.fulfill({ status: 204 }));
  await page.route('**/data/live/**', route => {
    const name = route.request().url().split('/data/live/')[1].split('?')[0];
    const text = (options.files || {})[name];
    return text === undefined ? route.fulfill({ status: 404 }) : route.fulfill({ status: 200, body: text });
  });
  await page.route('https://*.api.sanity.io/**', route => {
    const url = route.request().url();
    if (url.includes('/data/live/events')) return route.abort('connectionrefused');
    if (!url.includes('/data/query/')) return options.mode === 'down' ? route.abort('internetdisconnected') : route.fulfill({ status: 200, body: 'x' });
    return answerFor(options.mode || 'ok', options.raw || sample, route);
  });
  await page.route('https://api.open-meteo.com/**', route => (options.weatherDown ? route.abort('internetdisconnected') : route.fulfill({ status: 200, body: '{"current":null}' })));
  await page.route('https://cdn.sanity.io/**', route => (options.imagesMissing ? route.fulfill({ status: 404 }) : route.abort()));
  if (options.storedCopy) await page.addInitScript(text => localStorage.setItem('teletraan-last-content', text), options.storedCopy);
  if (options.storage) await page.addInitScript(options.storage);

  await page.goto(base + '/index.html?motion=full&night=off' + (options.query || ''), { waitUntil: 'load' });
  return page;
}

// What a person standing at the wall would call alive
async function problemsOf(page) {
  const found = [];
  const state = await page.evaluate(() => ({
    started: window.teletraanStarted === true,
    title: document.title,
    pieces: document.getElementById('stage') ? document.getElementById('stage').querySelectorAll('*').length : 0,
    words: document.body.innerText.replace(/\s+/g, ' ').trim().length,
    failed: Boolean(document.querySelector('.start-failed')),
  }));
  if (!state.started || state.failed) found.push('the page did not start');
  if (!/^Teletraan I · \d\d:\d\d$/.test(state.title)) found.push('the title has no heartbeat clock: ' + state.title);
  if (state.pieces < 200) found.push('the stage holds only ' + state.pieces + ' pieces');
  if (state.words < 100) found.push('the screen has only ' + state.words + ' characters of text');
  page.thrown.slice(0, 2).forEach(message => found.push('the page threw: ' + message.slice(0, 120)));
  return found;
}

const cases = [];
function drill(name, options, check) {
  cases.push({ name: name, options: options, check: check });
}

// Sanity
drill('Sanity unreachable at start, no saved copy', { mode: 'down' });
drill('Sanity unreachable at start, saved copy from a good read', { mode: 'down', storedCopy: (JSON.stringify({ savedAt: 1, raw: { settings: { pageSeconds: 20 }, tipsAndNews: [{ text: 'saved tip' }] } })) });
['500', '403', 'page', 'half', 'null'].forEach(mode => drill('Sanity answers ' + mode, { mode: mode }));

// The saved copy and the browser storage
['{not json', 'null', '{"raw":5}', '{"raw":[1,2]}', '{"savedAt":1,"raw":{"settings":7,"tipsAndNews":"x","people":[null,5]}}'].forEach(text => {
  drill('damaged saved copy ' + text.slice(0, 24), { mode: 'down', storedCopy: text });
});
drill('browser storage refuses every read and write', { storage: () => { Storage.prototype.getItem = Storage.prototype.setItem = Storage.prototype.removeItem = () => { throw new DOMException('denied', 'SecurityError'); }; } });
drill('browser storage is full', { storage: () => { Storage.prototype.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); }; } });

// Content of unexpected shapes
const lists = ['tasks', 'sponsors', 'tipsAndNews', 'subteams', 'people', 'photos', 'presentations', 'calendarFilters', 'subthemes', 'customPanels', 'screens', 'milestones', 'notices', 'teams', 'plans'];
const shaped = change => { const raw = clone(sample); change(raw); return raw; };
drill('every list holds junk', { raw: shaped(raw => lists.forEach(name => { raw[name] = [null, 5, 'x', {}, [], true]; })) });
drill('every list is an object', { raw: shaped(raw => lists.forEach(name => { raw[name] = { a: 1 }; })) });
drill('every section is null', { raw: shaped(raw => Object.keys(raw).forEach(name => { raw[name] = null; })) });
drill('every field of every item is null', { raw: shaped(raw => lists.forEach(name => { if (Array.isArray(raw[name])) raw[name] = raw[name].map(item => (item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).map(key => [key, null])) : item)); })) });
drill('every setting has the wrong type', { raw: shaped(raw => { raw.settings = Object.fromEntries(Object.keys(raw.settings).map(key => [key, 'zzz'])); }) });
drill('30000 characters in every text', { raw: shaped(raw => lists.forEach(name => { if (Array.isArray(raw[name])) raw[name] = raw[name].map(item => (item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).map(([key, value]) => [key, typeof value === 'string' ? 'W'.repeat(30000) : value])) : item)); })) });
drill('500 tasks, 300 people, 500 tips', { raw: shaped(raw => {
  raw.tasks = Array.from({ length: 500 }, (_, number) => Object.assign({}, raw.tasks[0], { mondayId: 'item ' + number, title: 'Task ' + number }));
  raw.people = Array.from({ length: 300 }, (_, number) => Object.assign({}, raw.people[0], { name: 'Person ' + number }));
  raw.tipsAndNews = Array.from({ length: 500 }, (_, number) => Object.assign({}, raw.tipsAndNews[0], { text: 'Tip ' + number }));
}) });
drill('300 rotation rows of 3 seconds', { raw: shaped(raw => {
  const panels = ['tasks', 'events', 'tonight', 'spotlight', 'sponsor-feature', 'photo', 'leadership', 'team-leads', 'roster', 'custom'];
  raw.settings.rotationRows = Array.from({ length: 300 }, (_, number) => ({ _key: 'k' + number, view: ['robotics', 'prime', 'nova'][Math.floor(number / 4) % 3], panel: panels[number % panels.length], seconds: 3, shown: true }));
}) });
drill('every rotation row has nothing to show', { raw: shaped(raw => {
  raw.settings.rotationRows = ['team-leads', 'custom', 'sponsor-feature'].map((panel, number) => ({ _key: 'k' + number, view: 'robotics', panel: panel, seconds: 5, shown: true }));
  ['subteams', 'customPanels', 'sponsors', 'people', 'tasks', 'photos', 'tipsAndNews'].forEach(name => { raw[name] = []; });
}) });
drill('no content at all', { raw: {} });

// The files the Mini writes
const files = {
  missing: undefined,
  empty: '',
  'a web page': '<html>sign in</html>',
  'cut short': calendar(event(1, tomorrow) + 'BEGIN:VEVENT\nUID:x\nDTSTART:2026'),
  'bad dates': calendar('BEGIN:VEVENT\nUID:a\nDTSTART:garbage\nSUMMARY:Bad\nEND:VEVENT\n' + event(2, tomorrow)),
  'an endless repeat': calendar('BEGIN:VEVENT\nUID:r\nDTSTART:20200101T000000\nRRULE:FREQ=SECONDLY\nSUMMARY:Spam\nEND:VEVENT\n' + event(3, tomorrow)),
  '6000 events': calendar(Array.from({ length: 6000 }, (_, number) => event(number, tomorrow)).join('')),
};
Object.keys(files).forEach(name => drill('calendar file ' + name, { files: { 'calendars/team.ics': files[name] }, query: '&show=events' }));
['{"teams":{"3229":{"xp":', '{"teams":null,"ours":5}', '<html>'].forEach(text => drill('match13.json ' + text.slice(0, 14), { files: { 'match13.json': text } }));
drill('weather service down', { weatherDown: true });
drill('every photo address answers 404', { imagesMissing: true, raw: shaped(raw => {
  raw.photos = [1, 2, 3].map(number => ({ id: 'p' + number, createdAt: '2026-01-01T00:00:00Z', caption: 'Photo', credit: 'Sam', show: true, image: { url: 'https://cdn.sanity.io/images/x/y/a' + number + '-1200x800.jpg', width: 1200, height: 800 } }));
}), query: '&show=photo' });

let failures = 0;
let finished = 0;
async function runCase(entry) {
  let page = null;
  let problems = [];
  try {
    page = await open(entry.options);
    await page.waitForTimeout(6000);
    problems = await problemsOf(page);
  } catch (error) {
    problems = ['the drill itself failed: ' + String(error.message).split('\n')[0]];
  } finally {
    if (page) await page.context().close();
  }
  finished += 1;
  if (problems.length === 0) {
    console.log('ok    ' + entry.name);
  } else {
    failures += 1;
    console.log('FAIL  ' + entry.name);
    problems.forEach(line => console.log('      ' + line));
  }
}

// Three cases at a time: each one waits for the screen to draw
const queue = cases.slice();
await Promise.all([1, 2, 3].map(async () => {
  while (queue.length > 0) await runCase(queue.shift());
}));

// An empty version.txt is a file caught while it is written, and must not reload the wall
{
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const body = { text: 'abc\n' };
  await page.route('**/control/api/**', route => route.fulfill({ status: 204 }));
  await page.route('**/data/live/version.txt', route => route.fulfill({ status: 200, body: body.text }));
  await page.route('https://**', route => route.abort('internetdisconnected'));
  await page.clock.install();
  await page.goto(base + '/index.html?motion=full&night=off', { waitUntil: 'load' });
  await page.waitForTimeout(3000);
  let loads = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) loads += 1; });
  body.text = '';
  await page.clock.runFor(61000);
  await page.waitForTimeout(1500);
  finished += 1;
  if (loads === 0) {
    console.log('ok    an empty version.txt does not reload the wall');
  } else {
    failures += 1;
    console.log('FAIL  an empty version.txt does not reload the wall');
  }
  await context.close();
}

await browser.close();
await server.close();
console.log('\n' + (finished - failures) + ' of ' + finished + ' passed');
if (failures > 0) process.exitCode = 1;
