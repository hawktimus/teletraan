// The four tabs of the control page (Status, Display, Content, Settings): the order, where every old address goes, that Status has no
// button that changes the wall, the sections of Settings, and Sync all (order, skipped syncs, a failure that does not stop
// the rest).
//
//   node tests/control-tabs.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { makeWorld } from './helpers/control-world.mjs';
import * as syncAllRoute from '../control/routes/sync-all.js';
import { isNotInstalled, runSyncAll, summaryWords, syncTargets } from '../control/support/sync-all.js';
import { resolveAddress, tabs, extendTab, extensionsFor } from '../control/static/tabs.js';
import { syncLinesHtml, syncs, readOff } from '../control/static/tabs/settings-sync.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');
const helperTargets = ['calendars', 'monday', 'frc', 'news', 'photos-drive', 'match13'];

test('the page has four tabs in this order: Status, Display, Content, Settings', async () => {
  await import('../control/static/tabs/status.js');
  await import('../control/static/tabs/display.js');
  await import('../control/static/tabs/content-blocks.js');
  await import('../control/static/tabs/settings.js');
  assert.deepEqual(tabs.map(tab => tab.title), ['Status', 'Display', 'Content', 'Settings']);
  assert.deepEqual(tabs.map(tab => tab.id), ['status', 'display', 'content', 'settings']);
});

test('Content has the five blocks in this order, and the Display tab no longer mounts any of them', async () => {
  const { blocks } = await import('../control/static/tabs/content-blocks.js');
  assert.deepEqual(blocks.map(block => block.id), ['ticker', 'calendar', 'roster', 'announcements', 'photos']);
  assert.deepEqual(blocks.map(block => block.title), ['Ticker and news', 'Calendar', 'Roster', 'Announcements', 'Photos']);
  assert.equal(extensionsFor('display', 'after').length, 0, 'nothing is added under the Display tab');
  assert.ok(!read('control/static/tabs/content-blocks.js').includes('extendTab('), 'Content is a tab of its own');
  assert.ok(!/content-blocks|drawContent|ct-block/.test(read('control/static/tabs/display.js')), 'display.js knows nothing of the Content blocks');
});

test('every old address goes to the right tab and section', () => {
  const goes = {
    '': { id: '', section: '' },
    status: { id: 'status', section: '' },
    now: { id: 'status', section: '' },
    health: { id: 'status', section: '' },
    display: { id: 'display', section: '' },
    playlist: { id: 'display', section: '' },
    hold: { id: 'display', section: '' },
    messages: { id: 'display', section: '' },
    theme: { id: 'display', section: '' },
    update: { id: 'settings', section: 'update' },
    keys: { id: 'settings', section: 'keys' },
    monday: { id: 'settings', section: 'monday' },
    sync: { id: 'settings', section: 'sync' },
    restart: { id: 'settings', section: 'sync' },
    reboot: { id: 'settings', section: 'reboot' },
    competition: { id: 'settings', section: 'competition' },
    'settings/competition': { id: 'settings', section: 'competition' },
    log: { id: 'settings', section: 'log' },
    settings: { id: 'settings', section: '' },
    content: { id: 'content', section: '' },
    'content/ticker': { id: 'content', section: 'ticker' },
    'content/calendar': { id: 'content', section: 'calendar' },
    'content/roster': { id: 'content', section: 'roster' },
    'content/announcements': { id: 'content', section: 'announcements' },
    'content/photos': { id: 'content', section: 'photos' },
    'content/nothing': { id: 'content', section: '' },
    'display/content': { id: 'content', section: '' },
    'display/content/photos': { id: 'content', section: 'photos' },
    'display/ticker': { id: 'content', section: 'ticker' },
    'display/news': { id: 'content', section: 'ticker' },
    'display/calendar': { id: 'content', section: 'calendar' },
    'display/roster': { id: 'content', section: 'roster' },
    'display/announcements': { id: 'content', section: 'announcements' },
    'display/photos': { id: 'content', section: 'photos' },
    ticker: { id: 'content', section: 'ticker' },
    roster: { id: 'content', section: 'roster' },
    photos: { id: 'content', section: 'photos' },
    'display/other': { id: 'display', section: 'other' },
    'settings/monday': { id: 'settings', section: 'monday' },
    'settings/reboot': { id: 'settings', section: 'reboot' },
    'settings/sync': { id: 'settings', section: 'sync' },
    'settings/all': { id: 'settings', section: 'all' },
  };
  Object.keys(goes).forEach(address => assert.deepEqual(resolveAddress(address), goes[address], '#' + address));
});

test('Settings has these sections, in this order, and the last one has a fixed id for the settings editor', () => {
  const text = read('control/static/tabs/settings.js');
  const ids = Array.from(text.matchAll(/\{ id: '([a-z]+)', title: '([^']+)'/g)).map(found => found[1] + ':' + found[2]);
  assert.deepEqual(ids, ['update:Updates', 'keys:Keys', 'monday:Monitor Monday', 'sync:Sync and restart', 'competition:Competition data', 'screen:Screen', 'reboot:Scheduled reboot', 'cleanup:Clean up expired items', 'log:Logs', 'all:All settings']);
  assert.ok(text.includes("bodyId: 'settings-all'") && text.includes('body.id = item.bodyId'));
  assert.ok(text.includes("widthWord(window.innerWidth) !== 'wide'"), 'one section at a time unless the screen is wide');
  assert.ok(/export function mountAll\(body\)[\s\S]*mountSettingsAll\(body/.test(read('control/static/tabs/settings-all.js')), 'the section mounts the settings editor');
});

test('a file can add a block to a tab or to the settings-all section without editing them', async () => {
  await import('../control/static/tabs/wall-controls.js');
  const mount = () => {};
  extendTab('settings-all', { mount: mount });
  extendTab('display', { place: 'before', mount: mount });
  assert.equal(extensionsFor('settings-all').length, 1);
  assert.equal(extensionsFor('display', 'before').length >= 2, true, 'the wall controls and this one');
  assert.equal(extensionsFor('display', 'after').length, 0);
});

test('Status only shows: no write call and no button that changes the wall', () => {
  const status = read('control/static/tabs/status.js');
  const health = read('control/static/tabs/health.js');
  const now = read('control/static/tabs/now.js');
  const card = now.slice(now.indexOf('export async function mountCard'), now.indexOf('export async function mountControls'));
  const preview = read('control/static/tabs/preview.js');
  [['status.js', status], ['health.js', health], ['the card in now.js', card]].forEach(([name, text]) => {
    assert.ok(!/api\('(POST|PUT|PATCH|DELETE)'/.test(text), name + ' makes no write call');
    assert.ok(!text.includes('data-action') && !text.includes('confirmed('), name + ' has no action button');
  });
  assert.ok(!preview.includes('/helper/') && !preview.includes('restart-kiosk'), 'the live view has no restart button');
  assert.ok(preview.includes("'/mirror/watch'"), 'the one POST of the live view only starts the picture of the TV');
  const markup = read('control/static/tabs/render.js');
  const previewHtml = markup.slice(markup.indexOf('export function previewCardHtml'), markup.indexOf('// The mirror: a moving picture'));
  assert.deepEqual(previewHtml.match(/<button[^>]*>[^<]*/g).map(found => found.replace(/<[^>]*>/, '')), ['Show live preview']);
  assert.ok(status.includes("address: '#content', label: 'Change what it says: Content'"), 'Status links to Content');
  assert.ok(status.includes("address: '#display', label: 'Change what is shown: Display'") && status.includes("address: '#settings/sync', label: 'Sync and restart: Settings'"));
  assert.ok(!markup.slice(markup.indexOf('export function nowCardHtml'), markup.indexOf('// A copy of the screen')).includes('<button'));
});

test('the buttons that moved are where the owner asked: wall controls on Display, sync and restart in Settings', () => {
  const wall = read('control/static/tabs/wall-controls.js');
  assert.ok(wall.includes("extendTab('display'") && wall.includes('mountControls') && wall.includes('quickBarHtml'));
  const sync = read('control/static/tabs/settings-sync.js');
  ['restart-kiosk', 'restart-services', 'reboot', 'Sync all', "'/sync-all'", 'dotsHtml', 'readsHtml'].forEach(word => assert.ok(sync.includes(word), word));
  assert.deepEqual(syncs.map(item => item.target), ['calendars', 'monday', 'frc', 'news', 'match13', 'photos-drive'], 'the order Sync all runs them in');
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

test('the phone has four tab buttons in one row, each 44px high or more', () => {
  const style = read('control/static/style.css');
  assert.ok(/nav button \{[^}]*min-height: 44px/.test(style));
  const phone = style.slice(style.indexOf('@media (max-width: 600px)'));
  assert.ok(/nav \{[^}]*position: fixed[^}]*bottom: 0[^}]*flex-wrap: nowrap/.test(phone), 'on a phone the tabs are a bar fixed to the bottom');
  assert.ok(phone.includes('nav button { flex: 1 1 0;') && /nav button \{[^}]*min-height: calc\(var\(--tabbar\) - 4px\)/.test(phone) && style.includes('--tabbar: 56px'), 'the buttons are at least 44px high');
  assert.ok(/main \{ padding-bottom: calc\(16px \+ var\(--tabbar\)/.test(phone), 'the page keeps clear of the bar');
  assert.ok(read('control/static/tabs/tabs.css').includes('bottom: calc(var(--tabbar, 56px) + env(safe-area-inset-bottom))'), 'the Next, Pause and Reset bar sits above the tab bar');
  assert.ok(read('control/static/index.html').includes('<nav id="tabs" role="tablist"'));
});

await finish();
