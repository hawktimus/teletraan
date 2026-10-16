// Tests for the text of the four tabs (control/static/tabs/render.js) and that every tab file is
// well formed and registers itself. The tabs are phone first with 44px targets.
//
//   node tests/control-pages.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { agoText, esc, keysHtml, logHtml, nowCardHtml, nowControlsHtml, statusHtml } from '../control/static/tabs/render.js';

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
  assert.ok(html.includes('data-minutes="10"') && html.includes('data-minutes="30"'));
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
});

check('each tab file registers itself with an id and a title, and parses', () => {
  const expected = { 'now.js': 'Now showing', 'status.js': 'Status', 'keys.js': 'Keys', 'log.js': 'Log' };
  Object.keys(expected).forEach(file => {
    const text = fs.readFileSync(path.join(folder, file), 'utf8');
    assert.match(text, /registerTab\(\{/);
    assert.ok(text.includes("title: '" + expected[file] + "'"), file);
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
  assert.match(css, /\.tab \.grid \{ display: grid; grid-template-columns: 1fr;/);
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*grid-template-columns: 1fr 1fr/);
});

console.log(passed + ' of ' + passed + ' checks passed.');
