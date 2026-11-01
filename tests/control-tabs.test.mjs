// The five areas of the control page (Now, Show, Update, Computer, Details): the order, the sections of each, where every old address
// goes, where each old function lives now, and Sync all (order, skipped syncs, a failure that does not stop the rest).
//
//   node tests/control-tabs.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { makeWorld } from './helpers/control-world.mjs';
import * as syncAllRoute from '../control/routes/sync-all.js';
import { isNotInstalled, runSyncAll, summaryWords, syncTargets } from '../control/support/sync-all.js';
import { resolveAddress, tabs, areaIds } from '../control/static/tabs.js';
import { syncLinesHtml, syncs, readOff } from '../control/static/tabs/settings-sync.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');
const helperTargets = ['calendars', 'monday', 'frc', 'news', 'photos-drive', 'match13'];
const sectionIds = text => Array.from(text.matchAll(/\{ id: '([a-z]+)', title: '([^']+)'/g)).map(found => found[1] + ':' + found[2]);

test('the page has five areas in this order: Now, Show, Update, Computer, Details, each in a file of its own', async () => {
  for (const name of ['now', 'show', 'update', 'computer', 'details']) await import('../control/static/tab-' + name + '.js');
  assert.deepEqual(tabs.map(tab => tab.title), ['Now', 'Show', 'Update', 'Computer', 'Details']);
  assert.deepEqual(tabs.map(tab => tab.id), areaIds);
  tabs.forEach(tab => assert.ok(tab.icon && typeof tab.render === 'function', tab.id));
});

test('each area has these sections, in this order', () => {
  assert.deepEqual(sectionIds(read('control/static/areas/show.js')), ['playing:On the TV']);
  assert.deepEqual(sectionIds(read('control/static/areas/update.js')), ['sync:Sync', 'publish:Publish', 'keys:Keys', 'monday:Monday check', 'competition:Competition data']);
  assert.deepEqual(sectionIds(read('control/static/areas/computer.js')), ['restart:Restart', 'network:Network', 'wifi:Wi-Fi', 'schedule:Scheduled reboot', 'screen:Screen fit', 'cleanup:Clean up', 'copy:Copy project']);
  assert.deepEqual(sectionIds(read('control/static/areas/details.js')), ['health:Health', 'output:Action output', 'log:Logs', 'settings:All settings']);
  assert.ok(read('control/static/areas/details.js').includes("box.id = 'settings-all'"), 'the settings editor keeps its fixed id');
  assert.ok(/export function mountAll\(body\)[\s\S]*mountSettingsAll\(body/.test(read('control/static/tabs/settings-all.js')), 'the section mounts the settings editor');
});

test('every old address goes to the right area and section', () => {
  const goes = {
    '': { id: '', section: '' },
    now: { id: 'now', section: '' },
    status: { id: 'now', section: '' },
    health: { id: 'details', section: 'health' },
    display: { id: 'show', section: '' },
    playlist: { id: 'show', section: '' },
    hold: { id: 'show', section: '' },
    theme: { id: 'show', section: '' },
    update: { id: 'update', section: '' },
    'update/keys': { id: 'update', section: 'keys' },
    keys: { id: 'update', section: 'keys' },
    monday: { id: 'update', section: 'monday' },
    sync: { id: 'update', section: 'sync' },
    restart: { id: 'computer', section: 'restart' },
    reboot: { id: 'computer', section: 'schedule' },
    competition: { id: 'update', section: 'competition' },
    log: { id: 'details', section: 'log' },
    settings: { id: 'update', section: 'sync' },
    'settings/update': { id: 'update', section: 'publish' },
    'settings/keys': { id: 'update', section: 'keys' },
    'settings/sync': { id: 'update', section: 'sync' },
    'settings/screen': { id: 'computer', section: 'screen' },
    'settings/reboot': { id: 'computer', section: 'schedule' },
    'settings/cleanup': { id: 'computer', section: 'cleanup' },
    'settings/log': { id: 'details', section: 'log' },
    'settings/all': { id: 'details', section: 'settings' },
    content: { id: 'show', section: '' },
    'content/ticker': { id: 'show', section: 'ticker' },
    'content/calendar': { id: 'show', section: 'calendar' },
    'content/roster': { id: 'show', section: 'roster' },
    'content/announcements': { id: 'show', section: 'announcements' },
    'content/photos': { id: 'show', section: 'photos' },
    'display/photos': { id: 'show', section: 'photos' },
    'display/news': { id: 'show', section: 'ticker' },
    ticker: { id: 'show', section: 'ticker' },
    photos: { id: 'show', section: 'photos' },
    'show/photos': { id: 'show', section: 'photos' },
    'computer/network': { id: 'computer', section: 'network' },
    'details/output': { id: 'details', section: 'output' },
  };
  Object.keys(goes).forEach(address => assert.deepEqual(resolveAddress(address), goes[address], '#' + address));
});

test('every function of the old four tabs has a place in the new areas', () => {
  const show = read('control/static/areas/show.js');
  ['mountCard', 'mountDisplay', 'wirePreview', 'mountBlock'].forEach(word => assert.ok(show.includes(word), 'Show has ' + word));
  const push = read('control/static/tabs/push.js');
  assert.ok(push.includes("'/request'") && push.includes("'/push'"), 'Show sends the requests and the pushes');
  assert.ok(read('control/static/tabs/display.js').includes('quickBarHtml'));
  const computer = read('control/static/areas/computer.js');
  ['mountReboot', 'mountScreen', 'mountCleanup', 'network-info', '/update-info'].forEach(word => assert.ok(computer.includes(word), 'Computer has ' + word));
  const actions = read('control/static/areas/actions.js');
  ['restart-kiosk', 'restart-services', "'reboot'"].forEach(word => assert.ok(actions.includes(word), word));
  const update = read('control/static/areas/update.js');
  ['mountSync', 'mountPublish', 'mountKeys', 'mountMonday', 'mountCompetition'].forEach(word => assert.ok(update.includes(word), 'Update has ' + word));
  const details = read('control/static/areas/details.js');
  ['mountHealth', 'dotsHtml', 'readsHtml', 'mountLog', 'mountAll'].forEach(word => assert.ok(details.includes(word), 'Details has ' + word));
  assert.deepEqual(syncs.map(item => item.target), ['calendars', 'monday', 'frc', 'news', 'match13', 'photos-drive'], 'the order Sync all runs them in');
  assert.ok(read('control/static/sync-run.js').includes('sources.map') || read('control/static/sync-run.js').includes('for (const item of sources)'));
});

// A helper that records what it is asked and fails the words it is told to
function fakeHelper(failures = {}) {
  const asked = [];
  const helper = async (word, args) => {
    asked.push(word + ' ' + args.join(' '));
    const failure = failures[args[0]];
    if (failure) throw new Error(failure);
    return '';
  };
  return { asked, helper };
}

test('Sync all runs calendars, monday, frc, news, match13 and photos-drive in that order, one after another', async () => {
  assert.deepEqual(syncTargets.map(item => item.target), ['calendars', 'monday', 'frc', 'news', 'match13', 'photos-drive']);
  assert.deepEqual(syncTargets.map(item => item.target).sort(), helperTargets.slice().sort(), 'the same targets the helper route accepts');
  const fake = fakeHelper();
  const answer = await runSyncAll(fake.helper);
  assert.deepEqual(fake.asked, ['sync-now calendars', 'sync-now monday', 'sync-now frc', 'sync-now news', 'sync-now match13', 'sync-now photos-drive']);
  assert.equal(answer.ok, 6);
  assert.deepEqual(answer.results.map(result => result.state), ['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
});

test('Sync all skips a sync that is switched off and one that is not installed, and says why', async () => {
  const fake = fakeHelper({ news: 'The helper did not finish (failed 5). Failed to start teletraan-news.service: Unit teletraan-news.service not found.' });
  const answer = await runSyncAll(fake.helper, ['frc']);
  assert.ok(!fake.asked.includes('sync-now frc'), 'a switched off sync is not asked');
  const by = target => answer.results.find(result => result.target === target);
  assert.deepEqual([by('frc').state, by('frc').words], ['skipped', 'Switched off.']);
  assert.deepEqual([by('news').state, by('news').words], ['skipped', 'Not installed on this computer.']);
  assert.equal(answer.skipped, 2);
  assert.equal(answer.failed, 0);
  assert.equal(isNotInstalled('Unit teletraan-x.service could not be found.'), true);
  assert.equal(isNotInstalled('The helper did not answer in time.'), false);
});

test('Sync all goes on after a failure and reports each line, with the reason of the one that failed', async () => {
  const fake = fakeHelper({ monday: 'The helper did not finish (failed 1). Monday refused the token.', match13: 'The helper did not answer in time.' });
  const logged = [];
  const answer = await runSyncAll(fake.helper, [], line => logged.push(line));
  assert.equal(fake.asked.length, 6, 'every sync was asked, in spite of the failures');
  assert.deepEqual(answer.results.map(result => result.state), ['ok', 'failed', 'ok', 'ok', 'failed', 'ok']);
  assert.equal(answer.results[1].words, 'The helper did not finish (failed 1). Monday refused the token.');
  assert.equal(answer.results[4].words, 'The helper did not answer in time.');
  assert.equal(summaryWords(answer), '4 ran, 2 failed.');
  assert.equal(logged.length, 2);
});

test('POST sync-all answers 200 with a line for each sync, refuses a skip it does not know, and never prints a key', async () => {
  const world = await makeWorld([syncAllRoute]);
  const asked = [];
  world.ctx.helper = async (word, args) => { asked.push(word + ' ' + args[0]); if (args[0] === 'frc') throw new Error('Competition data failed'); return ''; };
  const answer = await world.router.call('POST', '/sync-all', { body: { skip: ['photos-drive'] } });
  assert.equal(answer.status, 200);
  assert.deepEqual(answer.json.results.map(result => result.target + ':' + result.state), ['calendars:ok', 'monday:ok', 'frc:failed', 'news:ok', 'match13:ok', 'photos-drive:skipped']);
  assert.equal(answer.json.summary, '4 ran, 1 skipped, 1 failed.');
  assert.equal(asked.length, 5);
  assert.ok(!JSON.stringify(answer).includes('skFAKEtoken'));
  assert.equal((await world.router.call('POST', '/sync-all', { body: { skip: ['everything'] } })).status, 400);
  assert.equal((await world.router.call('POST', '/sync-all', { body: { skip: 'news' } })).status, 400);
  const empty = await world.router.call('POST', '/sync-all', { body: {} });
  assert.equal(empty.status, 200);
  assert.equal(empty.json.results.length, 6);
});

test('the lines of Sync all are escaped, and the choice of syncs to leave out is read safely', () => {
  const html = syncLinesHtml({ results: [{ target: 'news', label: 'FRC news', state: 'failed', words: '<script>x</script>' }] });
  assert.ok(html.includes('data-state="failed"') && html.includes('&lt;script&gt;') && !html.includes('<script>'));
  const store = value => ({ getItem: () => value });
  assert.deepEqual(readOff(store('["news","bogus"]')), ['news']);
  assert.deepEqual(readOff(store('not json')), []);
  assert.deepEqual(readOff(store(null)), []);
});

test('the real helper client accepts photos-drive as an argument, so Sync all and its button can reach it', async () => {
  const { createHelper } = await import('../control/lib/helper-client.js');
  const { EventEmitter } = await import('node:events');
  let sent = '';
  const connect = () => {
    const socket = new EventEmitter();
    socket.end = request => { sent = request; setImmediate(() => { socket.emit('data', 'ok\n'); socket.emit('close'); }); };
    socket.destroy = () => {};
    setImmediate(() => socket.emit('connect'));
    return socket;
  };
  await createHelper('x', 1000, connect)('sync-now', ['photos-drive']);
  assert.equal(sent, 'sync-now photos-drive\n');
  await assert.rejects(createHelper('x', 1000, connect)('sync-now', ['photos drive']), /not a word the helper knows/);
});

test('the phone has five navigation links in one fixed bar, each 48px high or more, and a sidebar from 900px', () => {
  const style = read('control/static/style.css');
  assert.ok(/#tabs \{[^}]*position: fixed[^}]*bottom: 0[^}]*grid-template-columns: repeat\(5/.test(style), 'on a phone the areas are a bar fixed to the bottom');
  assert.ok(/#tabs a \{[^}]*min-height: calc\(var\(--navbar\) - 4px\)/.test(style) && /--navbar: 60px/.test(style), 'the links are at least 48px high');
  assert.ok(/@media \(min-width: 900px\)[\s\S]*#tabs \{[^}]*position: sticky/.test(style), 'from 900px the bar is a sidebar');
  assert.ok(read('control/static/index.html').includes('<nav id="tabs" aria-label="Areas of the control page">'));
  assert.ok(read('control/static/tabs/tabs.css').includes('bottom: calc(var(--tabbar, 56px) + env(safe-area-inset-bottom))'), 'the Next, Pause and Reset bar sits above the bar');
  assert.ok(style.includes('--tabbar: var(--navbar)'));
});

await finish();
