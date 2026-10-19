// Tests for the text of the two tabs (control/static/tabs/render.js) and that every tab file is
// well formed and registers itself. The tabs are phone first with 44px targets.
//
//   node tests/control-pages.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { agoText, esc, keysHtml, logHtml, nowCardHtml, nowControlsHtml, notChangedWords, previewLeft, previewLine, statusHtml, wallCheck } from '../control/static/tabs/render.js';

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
  ['nova', 'retro', 'tasks', 'v14 abc1234', '<li>One</li>'].forEach(word => assert.ok(live.includes(word), word));
});

check('the Now showing buttons are all there', () => {
  const html = nowControlsHtml({ views: [{ key: 'general', name: 'General' }], themes: ['original'], panels: ['tasks'], talks: [], liveAnnouncements: 1, canWrite: true });
  ['next', 'pause', 'resume', 'hold', 'view', 'theme', 'announce', 'post-announcement', 'presentation-test', 'schedule'].forEach(action => assert.ok(html.includes('data-action="' + action + '"'), action));
  assert.ok(html.includes('Hold 1 minute') && html.includes('data-minutes="1"'));
  assert.ok(!html.includes('data-minutes="10"') && !html.includes('data-minutes="30"'), 'the two fixed hold buttons are gone');
  assert.match(html, /name="hold-minutes" type="number" inputmode="numeric" min="1" max="60" step="1" value="10"/);
  assert.match(html, /data-minutes-from="hold-minutes">Hold for that many minutes</);
  assert.match(html, /name="view-minutes" type="number" inputmode="numeric" min="10" max="120" step="1" value="30"/);
  assert.match(html, /data-minutes-from="view-minutes">Show for that many minutes</);
  assert.equal((html.match(/type="number"/g) || []).length, 2, 'no other control has a minutes field');
  assert.ok(html.includes('maxlength="90"'));
  assert.ok(nowControlsHtml({ canWrite: false }).includes('SANITY_WRITE_TOKEN'));
});

check('the Status tab shows the three dots with their reasons and says not known for what is missing', () => {
  const html = statusHtml({ versions: { current: 14, previous: [13, 12] }, dots: { monday: { color: 'red', reason: 'The last read failed: bad token' }, band: { color: 'green', reason: 'ok' }, sanity: { color: 'amber', reason: 'late' } }, mini: {}, sanity: { reachable: true }, cors: null, disk: { freeBytes: 5 * 1024 ** 3, totalBytes: 100 * 1024 ** 3 } }, now);
  assert.ok(html.includes('v14') && html.includes('v13, v12'));
  assert.ok(html.includes('data-color="red"') && html.includes('bad token'));
  assert.ok(html.includes('Not checked'));
  assert.ok(html.includes('5.0 GB free of 100 GB'));
  assert.ok(statusHtml(null).includes('did not answer'));
});

check('the Keys tab never holds a value, only the mask, and has a field and a clear for each', () => {
  const html = keysHtml({ keys: [{ name: 'TBA_AUTH_KEY', label: 'The Blue Alliance key', masked: 'abcd........' }], calendars: [{ name: 'CALENDAR_TEAM_URL', code: 'team', masked: 'not set' }] });
  assert.ok(html.includes('abcd........'));
  assert.ok(html.includes('type="password"') && html.includes('data-clear="TBA_AUTH_KEY"') && html.includes('data-clear-calendar="CALENDAR_TEAM_URL"'));
  assert.ok(html.includes('name="new-link"') && html.includes('data-save'));
  assert.ok(html.includes('PIN: fixed') && !html.includes('name="CONTROL_PIN"'), 'the PIN shows as text and has no field');
});

check('each tab file registers itself with an id and a title, and parses', () => {
  const expected = { 'status.js': 'Status', 'settings.js': 'Settings' };
  const sections = ['now.js', 'health.js', 'keys.js', 'log.js'];
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

check('the theme card says what a press does, and the lists come from the service in one table', () => {
  const html = nowControlsHtml({ views: [{ key: 'general', name: 'Robotics' }, { key: 'family', name: 'Condensed' }], themes: ['original', 'cybertron', 'retro', 'foundry'], themeNames: { cybertron: 'Cybertron' }, panels: [], talks: [], canWrite: true });
  assert.ok(html.includes('Preview this theme for 10 minutes'));
  assert.ok(html.includes('<option value="cybertron">Cybertron</option>') && html.includes('<option value="foundry">Foundry</option>'));
  assert.ok(html.includes('<option value="general">Robotics</option>') && html.includes('<option value="family">Condensed</option>'));
  assert.ok(html.includes('data-left="theme"') && html.includes('data-wall="theme"') && html.includes('data-wall="view"'));
  const themeCard = html.slice(html.indexOf('Preview a theme'));
  assert.ok(themeCard.includes('Back to schedule') && themeCard.includes('data-action="schedule"'), 'the theme card has Back to schedule');
  const viewCard = html.slice(html.indexOf('Show a view'), html.indexOf('Preview a theme'));
  assert.ok(viewCard.includes('Back to schedule'), 'the view card has Back to schedule');
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

check('the old addresses land on Status or on a section of Settings', async () => {
  const { resolveAddress } = await import('../control/static/tabs.js');
  assert.deepEqual(resolveAddress('now'), { id: 'status', section: '' });
  assert.deepEqual(resolveAddress('status'), { id: 'status', section: '' });
  ['update', 'keys', 'log'].forEach(name => assert.deepEqual(resolveAddress(name), { id: 'settings', section: name }));
  assert.deepEqual(resolveAddress('settings/log'), { id: 'settings', section: 'log' });
  assert.deepEqual(resolveAddress(''), { id: '', section: '' });
});

console.log(passed + ' of ' + passed + ' checks passed.');
