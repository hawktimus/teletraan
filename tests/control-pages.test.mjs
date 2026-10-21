// Tests for the text of the two tabs (control/static/tabs/render.js) and that every tab file is
// well formed and registers itself. The tabs are phone first with 44px targets.
//
//   node tests/control-pages.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { doneWords, heldLine, todayLine, pauseToggleHtml, quickBarHtml, agoText, esc, keysHtml, logHtml, nowCardHtml, notChangedWords, previewLeft, previewLine, wallCheck } from '../control/static/tabs/render.js';
import { dotsHtml, healthHtml, networkWords, readsHtml, uptimeText } from '../control/static/tabs/render-health.js';

let passed = 0;
function check(name, test) {
  test();
  passed += 1;
  console.log('PASS  ' + name);
}

const folder = new URL('../control/static/tabs/', import.meta.url).pathname;
const now = new Date('2026-10-15T12:00:00Z');

check('every value from the Teletraan computer is escaped', () => {
  assert.equal(esc('<b>"x"&\'</b>'), '&lt;b&gt;&quot;x&quot;&amp;&#39;&lt;/b&gt;');
  assert.ok(!logHtml(['<script>alert(1)</script>']).includes('<script>'));
  assert.ok(!nowCardHtml({ report: { panel: '<img onerror=x>' }, quiet: false, rows: ['<i>'], receivedAt: now.toISOString() }, now).includes('<img'));
});

check('ages are in plain words', () => {
  assert.equal(agoText('2026-10-15T11:59:50Z', now), 'just now');
  assert.equal(agoText('2026-10-15T11:57:00Z', now), '3 minutes ago');
  assert.equal(agoText('2026-10-15T09:00:00Z', now), '3 hours ago');
  assert.equal(agoText('', now), 'not yet');
});

check('the card is grey with the number of seconds when the wall has gone quiet', () => {
  const quiet = nowCardHtml({ report: { panel: 'tasks', view: 'prime' }, quiet: true, message: 'No report for 52 s' }, now);
  assert.match(quiet, /card grey/);
  assert.match(quiet, /No report for 52 s/);
  const live = nowCardHtml({ report: { view: 'nova', theme: 'retro', panel: 'tasks', team: 'nova', page: '2', hold: 'tasks', build: 'v14 abc1234' }, quiet: false, rows: ['One', 'Two'], receivedAt: '2026-10-15T11:59:55Z' }, now);
  assert.ok(!live.includes('grey'));
  ['v14 abc1234', '<li>One</li>'].forEach(word => assert.ok(live.includes(word), word));
  // the ids the wall stores are shown as the words people use
  const named = nowCardHtml({ report: { view: 'family', theme: 'retro', panel: 'monday-department', team: 'both', layout: 'bar', page: '1', build: 'v1' }, quiet: false, rows: [], receivedAt: '2026-10-15T11:59:55Z',
    names: { panels: { 'monday-department': 'Monday: Department tasks' }, views: { family: 'Condensed' }, themes: { retro: 'Retro' }, layouts: { bar: 'Bar' }, teams: { both: 'Both teams' } } }, now);
  ['Condensed', 'Retro', 'Monday: Department tasks', 'Bar', 'Both teams'].forEach(word => assert.ok(named.includes(word), word));
  ['family', 'monday-department', '>both<'].forEach(word => assert.ok(!named.includes(word), word + ' is not shown'));
});

check('Pause and Resume are one button, and the bar at the foot of a phone has Next, Pause and Reset', () => {
  assert.ok(pauseToggleHtml(true).includes('data-action="resume"') && pauseToggleHtml(true).includes('Resume rotation'));
  assert.ok(pauseToggleHtml(false).includes('data-action="pause"'));
  const bar = quickBarHtml();
  ['next', 'pause', 'schedule'].forEach(action => assert.ok(bar.includes('data-action="' + action + '"'), 'bar ' + action));
  assert.ok(bar.includes('Reset to today&#39;s schedule'));
  assert.equal((bar.match(/data-toggle-pause/g) || []).length, 1);
});

check('the three dots and the last reads (Settings, Sync and restart) show the reasons and say not known for what is missing', () => {
  const data = { versions: { current: 14, previous: [13, 12] }, dots: { monday: { color: 'red', reason: 'The last read failed: bad token' }, band: { color: 'green', reason: 'ok' }, sanity: { color: 'amber', reason: 'late' } }, mini: { photos: '2026-10-15T11:00:00Z' }, sanity: { reachable: true }, cors: null };
  const dots = dotsHtml(data);
  assert.ok(dots.includes('data-color="red"') && dots.includes('bad token'));
  const reads = readsHtml(data, now);
  ['Content', 'Calendars', 'Slides', 'Monday', 'Competition data', 'FRC news', 'Match13', 'Drive photos'].forEach(label => assert.ok(reads.includes('<dt>' + label + '</dt>'), label));
  assert.ok(reads.includes('Drive photos</dt><dd>1 hour ago'));
  assert.equal((reads.match(/Match13/g) || []).length, 1, 'the Match13 line is there once');
  assert.ok(dotsHtml(null).includes('did not answer') && readsHtml(null).includes('did not answer'));
});

check('the health block of Status has the release, uptime, disk, page loads, memory and temperature when present, and the last errors', () => {
  const data = { versions: { current: 14, previous: [13, 12] }, kiosk: 'active', mini: {}, sanity: { reachable: true }, cors: null, uptimeSeconds: 3 * 86400 + 4 * 3600 + 60,
    disk: { freeBytes: 5 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 }, memory: { totalKb: 4000000, availableKb: 1000000 }, temperatureC: 61, lastErrors: ['2026-10-15T11:00:00Z helper sync failed <b>x</b>'] };
  const html = healthHtml(data, { report: { loads: 3, loadReason: 'watchdog' } }, now);
  ['v14', 'v13, v12', 'active', '3 days 4 hours', '5.0 GB free of 100 GB', '75 percent used', '61 degrees C', '3, last reason: watchdog', 'Last errors', 'Not checked'].forEach(words => assert.ok(html.includes(words), words));
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;') && !html.includes('<b>x'), 'error lines are escaped');
  const bare = healthHtml({ versions: {}, mini: {}, sanity: {}, lastErrors: [] }, null, now);
  assert.ok(!bare.includes('Memory') && !bare.includes('Temperature'), 'left out when the computer does not tell');
  assert.ok(bare.includes('No failures in the control log') && bare.includes('not reported yet') && bare.includes('not known'));
  assert.equal(uptimeText(2400), '40 minutes');
  assert.equal(uptimeText(null), 'not known');
  assert.ok(healthHtml(null).includes('did not answer'));
});

check('the health block has a Network line: ok with the last problem and the recoveries, down with the step, or not known', () => {
  const at = new Date('2026-10-21T12:00:00Z');
  const ok = { state: 'ok', lastOkAt: '2026-10-21T11:58:00Z', downSince: '', lastProblemAt: '2026-10-18T12:00:00Z', lastStep: '3 service', recoveries: 2 };
  assert.equal(networkWords(ok, at), 'ok, last problem 3 days ago, 2 recoveries in 24 hours');
  assert.equal(networkWords(Object.assign({}, ok, { recoveries: 1 }), at), 'ok, last problem 3 days ago, 1 recovery in 24 hours');
  assert.equal(networkWords(Object.assign({}, ok, { lastProblemAt: '', recoveries: 0 }), at), 'ok, no problem seen, 0 recoveries in 24 hours');
  assert.equal(networkWords({ state: 'down', downSince: '2026-10-21T11:40:00Z', lastStep: '2 reconnect' }, at), 'down since 20 minutes ago, last repair step 2 reconnect');
  assert.equal(networkWords({ state: 'down', downSince: '2026-10-21T11:55:00Z', lastStep: '' }, at), 'down since 5 minutes ago, no repair step yet');
  assert.ok(networkWords({ state: 'not known' }, at).startsWith('not known yet'));
  assert.ok(networkWords(undefined, at).startsWith('not known yet'));
  const html = healthHtml({ versions: {}, mini: {}, sanity: {}, lastErrors: [], network: ok }, null, at);
  assert.ok(html.includes('Network</dt><dd>ok, last problem 3 days ago, 2 recoveries in 24 hours'), html);
});

check('Settings, Sync and restart has the Check the network now button, and it asks for the network-info word', async () => {
  const fs = await import('node:fs');
  const text = fs.readFileSync(new URL('../control/static/tabs/settings-sync.js', import.meta.url), 'utf8');
  assert.ok(text.includes('Check the network now') && text.includes("'/helper/network-info'"));
});

check('the card of the wall names the build, view, theme, layout, team, panel, page and the age of the report', () => {
  const html = nowCardHtml({ report: { build: 'v14 abc1234', view: 'nova', theme: 'retro', layout: 'bar', team: 'nova', panel: 'tasks', page: '2' }, quiet: false, rows: [], receivedAt: '2026-10-15T11:59:00Z' }, now);
  ['Build</dt>', 'View</dt>', 'Theme</dt>', 'Layout</dt><dd>Bar', 'Team</dt>', 'Panel</dt>', 'Page</dt><dd>2', 'Age of this report</dt><dd>1 minute ago'].forEach(words => assert.ok(html.includes(words), words));
});

check('the Keys section of Settings never holds a value, only the mask, and has a field and a clear for each', () => {
  const html = keysHtml({ keys: [{ name: 'TBA_AUTH_KEY', label: 'The Blue Alliance key', masked: 'abcd........' }], calendars: [{ name: 'CALENDAR_TEAM_URL', code: 'team', masked: 'not set' }] });
  assert.ok(html.includes('abcd........'));
  assert.ok(html.includes('type="password"') && html.includes('data-clear="TBA_AUTH_KEY"') && html.includes('data-clear-calendar="CALENDAR_TEAM_URL"'));
  assert.ok(html.includes('name="new-link"') && html.includes('data-save'));
  assert.ok(html.includes('PIN: fixed') && !html.includes('name="CONTROL_PIN"'), 'the PIN shows as text and has no field');
});

check('each tab file registers itself with an id and a title, and parses', () => {
  const expected = { 'status.js': 'Status', 'settings.js': 'Settings' };
  const sections = ['now.js', 'health.js', 'arrange.js', 'render-health.js', 'settings-update.js', 'settings-keys.js', 'settings-monday.js', 'settings-sync.js', 'settings-reboot.js', 'settings-cleanup.js', 'settings-log.js', 'settings-all.js'];
  sections.forEach(file => assert.ok(!fs.readFileSync(path.join(folder, file), 'utf8').includes('registerTab('), file + ' is a part of a tab, not a tab'));
  [...Object.keys(expected), ...sections].forEach(file => {
    const text = fs.readFileSync(path.join(folder, file), 'utf8');
    if (expected[file]) {
      assert.match(text, /registerTab\(\{/);
      assert.ok(text.includes("title: '" + expected[file] + "'"), file);
    }
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-tab-')), file.replace('.js', '.mjs'));
    fs.writeFileSync(copy, text);
    const checked = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
    assert.equal(checked.status, 0, file + ': ' + checked.stderr);
  });
});

check('buttons and fields are 44px high or more, and the tabs are one column until 900px', () => {
  const css = fs.readFileSync(path.join(folder, 'tabs.css'), 'utf8');
  assert.match(css, /\.tab \.act \{ min-height: 44px; min-width: 44px/);
  assert.match(css, /select, \.tab input \{[^}]*min-height: 44px/);
  assert.match(css, /\.tab \.grid \{ display: grid; grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\)/);
});

check('the held line says who decides what the wall shows', () => {
  const at = new Date('2026-10-18T10:00:00Z');
  const plus = minutes => new Date(at.getTime() + minutes * 60000).toISOString();
  const names = { theme: { retro: 'Retro' }, view: { nova: 'Nova' } };
  assert.equal(heldLine(null, names, at), 'Following the schedule.');
  assert.equal(heldLine({ previewTheme: { theme: '', until: '' }, showView: { key: '', until: '' } }, names, at), 'Following the schedule.');
  assert.equal(heldLine({ previewTheme: { theme: 'retro', until: plus(24 * 60) } }, names, at), 'Held by you: theme Retro until reset.');
  assert.match(heldLine({ showView: { key: 'nova', until: plus(30) } }, names, at), /^Held by you: view Nova until \d\d:\d\d\.$/);
  assert.match(heldLine({ previewTheme: { theme: 'retro', until: plus(24 * 60) }, holdPanel: { panel: 'tasks', until: plus(10) }, pauseRotation: { until: plus(60) } }, names, at), /^Held by you: theme Retro until reset, panel Tasks until \d\d:\d\d, rotation paused until \d\d:\d\d\.$/);
  assert.equal(heldLine({ previewTheme: { theme: 'retro', until: plus(-1) } }, names, at), 'Following the schedule.', 'a request that ended is not held');
  assert.equal(todayLine({}), '');
});

check('a request of a day says it stays until a reset, not minutes and seconds', () => {
  const at = new Date('2026-10-18T10:00:00Z');
  const until = new Date(at.getTime() + 24 * 3600 * 1000).toISOString();
  assert.equal(previewLine('theme', { theme: 'retro', until: until }, { retro: 'Retro' }, at), 'Retro stays until you reset it.');
  assert.ok(doneWords('theme', { hours: 24 }).startsWith('The theme stays until you reset it, or 24 hours.'));
  assert.ok(doneWords('schedule').includes('follows today'));
});

check('a preview shows its end time and what is left, and says nothing when it has run out', () => {
  const at = new Date('2026-10-18T10:00:00Z');
  const until = new Date(at.getTime() + 10 * 60000).toISOString();
  const left = previewLeft(until, new Date(at.getTime() + 20 * 1000));
  assert.equal(left.running, true);
  assert.equal(left.text, '9:40');
  assert.match(left.endsAt, /^\d\d:\d\d$/);
  const line = previewLine('theme', { theme: 'cybertron', until: until }, { cybertron: 'Cybertron' }, at);
  assert.ok(line.startsWith('Previewing Cybertron until ' + left.endsAt) && line.endsWith('(10:00 left).'), line);
  assert.equal(previewLine('theme', { theme: 'cybertron', until: until }, {}, new Date(at.getTime() + 11 * 60000)), '');
  assert.equal(previewLine('view', { key: '', until: until }, {}, at), '');
  assert.ok(previewLine('view', { key: 'family', until: until }, { family: 'Condensed' }, at).includes('Condensed'));
});

check('after a press the page says what the wall reports, and after 20 seconds without a change it says so', () => {
  const names = { cybertron: 'Cybertron', original: 'Original' };
  assert.deepEqual(wallCheck('theme', 'cybertron', { theme: 'cybertron' }, 6, names), { state: 'done', words: 'The wall shows Cybertron now.' });
  const waiting = wallCheck('theme', 'cybertron', { theme: 'original' }, 8, names);
  assert.equal(waiting.state, 'wait');
  assert.ok(waiting.words.includes('now shows Original'));
  assert.equal(wallCheck('theme', 'cybertron', null, 3, names).words, 'Waiting for the wall. It reports every 10 seconds.');
  assert.equal(wallCheck('theme', 'cybertron', { theme: 'original' }, 20, names).words, 'The wall has not changed yet. It checks every 10 seconds.');
  assert.equal(notChangedWords, 'The wall has not changed yet. It checks every 10 seconds.');
  assert.equal(wallCheck('theme', 'cybertron', { theme: 'cybertron' }, 40, names).state, 'done', 'a late change is still reported');
  assert.equal(wallCheck('view', 'nova', { view: 'nova' }, 4, {}).words, 'The wall shows Nova now.');
});

check('the Monday section of Settings has Check the token and Monday debug, sends a board number of digits only, and holds no key', () => {
  const text = fs.readFileSync(path.join(folder, 'settings-monday.js'), 'utf8');
  const settings = fs.readFileSync(path.join(folder, 'settings.js'), 'utf8');
  assert.ok(settings.includes("id: 'monday', title: 'Monitor Monday'") && settings.includes('mountMonday'));
  assert.ok(text.includes('>Check the token<') && text.includes('>Monday debug<'));
  assert.ok(text.includes("'/helper/monday-check'") && text.includes("'/helper/monday-debug', { board: number }"));
  assert.ok(text.includes('[0-9]{1,20}'), 'the board number is checked before it is sent');
  assert.ok(!/MONDAY_API_TOKEN|local\.env|Authorization/.test(text), 'the page names no key');
});

check('the old addresses land on Status or on a section of Settings', async () => {
  const { resolveAddress } = await import('../control/static/tabs.js');
  assert.deepEqual(resolveAddress('now'), { id: 'status', section: '' });
  assert.deepEqual(resolveAddress('status'), { id: 'status', section: '' });
  ['update', 'keys', 'log'].forEach(name => assert.deepEqual(resolveAddress(name), { id: 'settings', section: name }));
  assert.deepEqual(resolveAddress('settings/log'), { id: 'settings', section: 'log' });
  assert.deepEqual(resolveAddress('settings/monday'), { id: 'settings', section: 'monday' });
  assert.deepEqual(resolveAddress(''), { id: '', section: '' });
});

console.log(passed + ' of ' + passed + ' checks passed.');
