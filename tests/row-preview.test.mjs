// The row preview address of the dashboard (?rowpreview=, dashboard/core/row-preview.js) and the guard that makes such a page
// read only (dashboard/core/row-preview-guard.js). The control page's Display tab opens it in small frames, on the same address
// as the control page, so the tests also check that a preview never writes anything and never reaches the key routes.
//
//   node tests/row-preview.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readRowPreview, useRowPreview, unreadablePanel, longestRow } from '../dashboard/core/row-preview.js';
import { allowRequest, installGuard } from '../dashboard/core/row-preview-guard.js';
import { readStill, stillRow, useStillSwitches } from '../dashboard/core/still.js';
import { repo } from './helpers/control-world.mjs';

let passed = 0;
async function check(name, test) {
  await test();
  passed += 1;
  console.log('PASS  ' + name);
}

const address = row => '?rowpreview=' + encodeURIComponent(JSON.stringify(row));

await check('a row in the address is read, and a field that is not on the list is dropped', () => {
  const read = readRowPreview(address({ view: 'prime', panel: 'monday-department', department: 'build', list: 'done', team: 'nova', photoCount: 4, shown: false, secondsPerPhoto: 10, extra: 'x' }));
  assert.deepEqual(read.row, { panel: 'monday-department', view: 'prime', department: 'build', list: 'done', team: 'nova', photoCount: 4, secondsPerPhoto: 10 });
  assert.equal(readRowPreview('?sample=1'), null, 'an address without it is the dashboard as it was');
});

await check('a row that cannot be read gives a reason and never the live dashboard', () => {
  const bad = [
    '?rowpreview=', '?rowpreview=not-json', '?rowpreview=' + encodeURIComponent('[1]'), address({ view: 'prime' }), address({ panel: '' }),
    address({ panel: '../x' }), address({ panel: 'tasks', department: '<script>' }), address({ panel: 'tasks', part: -1 }), address({ panel: 'tasks', part: 1.5 }),
    address({ panel: 'tasks', list: 5 }), '?rowpreview=' + encodeURIComponent(JSON.stringify({ panel: 'tasks', side: 'x'.repeat(longestRow) })),
  ];
  bad.forEach(search => {
    const read = readRowPreview(search);
    assert.ok(read && typeof read.error === 'string' && !read.row, search);
    const params = useRowPreview(new URLSearchParams(search), read);
    assert.equal(params.get('panel'), unreadablePanel, 'it asks for a panel that does not exist, so the page writes an error line');
    assert.equal(readStill(params).panel, unreadablePanel);
  });
});

await check('the row becomes a held still address: its panel, team, view, small panel and settings, and nothing moves', () => {
  const params = useRowPreview(new URLSearchParams('sample=1'), readRowPreview(address({ view: 'nova', panel: 'events', side: 'forecast', part: 2 })));
  const ask = readStill(params);
  assert.equal(ask.panel, 'events');
  assert.equal(ask.team, 'nova', 'a team view gives its team to the row');
  assert.equal(ask.view, 'nova');
  assert.equal(ask.side, 'forecast');
  assert.equal(ask.part, 2);
  assert.equal(ask.small, true);
  assert.equal(ask.still, true);
  useStillSwitches(params, ask);
  assert.equal(params.get('show'), 'events', 'show holds the page: no rotation, no takeovers, no hidden effects, no night screen, no report');
  assert.equal(params.get('motion'), 'none');
  assert.deepEqual(stillRow(ask), { panel: 'events', team: 'nova', seconds: 60, side: 'forecast', part: 2 });

  const robotics = readStill(useRowPreview(new URLSearchParams(), readRowPreview(address({ view: 'robotics', panel: 'tasks' }))));
  assert.equal(robotics.view, 'general');
  assert.equal(robotics.team, '');
});

await check('a Monday row keeps the team of its tasks, and the Photos row its numbers', () => {
  const monday = readStill(useRowPreview(new URLSearchParams(), readRowPreview(address({ view: 'prime', panel: 'monday-department', department: 'build', list: 'done', team: 'nova' }))));
  assert.deepEqual([monday.team, monday.department, monday.list], ['nova', 'build', 'done']);
  const charts = readStill(useRowPreview(new URLSearchParams(), readRowPreview(address({ view: 'robotics', panel: 'monday-charts', chart: 'timeline' }))));
  assert.equal(charts.chart, 'timeline');
  const photo = readStill(useRowPreview(new URLSearchParams(), readRowPreview(address({ view: 'robotics', panel: 'photo', photoCount: 3, secondsPerPhoto: 8 }))));
  assert.deepEqual([photo.photoCount, photo.secondsPerPhoto], [3, 8]);
});

await check('a preview may read, and may not write or reach the control service', () => {
  const base = 'http://teletraan.local:3229/dashboard/';
  assert.equal(allowRequest('/dashboard/data/live/match13.json', 'GET', base), true);
  assert.equal(allowRequest('https://ybfqe345.api.sanity.io/v2025-02-19/data/query/production?query=x', 'GET', base), true);
  assert.equal(allowRequest('/dashboard/data/live/mirror/frame.n', 'HEAD', base), true);
  ['POST', 'PUT', 'PATCH', 'DELETE'].forEach(method => assert.equal(allowRequest('/dashboard/x', method, base), false, method));
  assert.equal(allowRequest('/control/api/now', 'GET', base), false);
  assert.equal(allowRequest('/control/api/display/save', 'GET', base), false);
  assert.equal(allowRequest('http://teletraan.local:3229/control/api/keys', 'GET', base), false);
  assert.equal(allowRequest('http://[bad', 'GET', base), false);
});

await check('the guard stops writes in a preview and leaves a page without ?rowpreview= alone', async () => {
  const made = search => {
    const calls = { fetched: [], stored: [] };
    class Storage {}
    ['setItem', 'removeItem', 'clear'].forEach(name => { Storage.prototype[name] = function real() { calls.stored.push(name); }; });
    const win = {
      location: { search: search, href: 'http://teletraan.local:3229/dashboard/' + search },
      fetch: async (url, init) => { calls.fetched.push([String(url), (init && init.method) || 'GET']); return { ok: true }; },
      Storage: Storage,
    };
    return { win, calls, storage: new Storage() };
  };

  const plain = made('?sample=1');
  assert.equal(installGuard(plain.win), false);
  await plain.win.fetch('/control/api/now', { method: 'POST' });
  plain.storage.setItem('a', 'b');
  assert.deepEqual([plain.calls.fetched.length, plain.calls.stored.length], [1, 1], 'the wall page is not changed');

  const preview = made('?rowpreview=%7B%7D');
  assert.equal(installGuard(preview.win), true);
  await preview.win.fetch('/dashboard/data/live/match13.json');
  await assert.rejects(preview.win.fetch('/control/api/now', { method: 'POST' }));
  await assert.rejects(preview.win.fetch('/control/api/display'));
  await assert.rejects(preview.win.fetch('/dashboard/x', { method: 'PUT' }));
  await assert.rejects(preview.win.fetch({ url: '/control/api/keys', method: 'GET' }));
  ['setItem', 'removeItem', 'clear'].forEach(name => preview.storage[name]('a', 'b'));
  assert.deepEqual(preview.calls.fetched, [['/dashboard/data/live/match13.json', 'GET']], 'only the one read went out');
  assert.equal(preview.calls.stored.length, 0);
});

// The files of a preview are scanned: they never name the control service, a key or a write
const dashboard = path.join(repo, 'dashboard');
const source = file => fs.readFileSync(path.join(dashboard, file), 'utf8');

await check('the preview code never names the control routes, a key or a write', () => {
  ['core/row-preview.js', 'core/row-preview-guard.js'].forEach(file => {
    const code = source(file).split('\n').filter(line => !/^\s*\/\//.test(line)).join('\n');
    assert.ok(!/SANITY_WRITE_TOKEN|MONDAY_API_TOKEN|TBA_AUTH_KEY|local\.env|CONTROL_PIN/.test(code), file);
    assert.ok(!/XMLHttpRequest|WebSocket|indexedDB/.test(code), file);
  });
  const still = source('core/still-run.js');
  assert.ok(!/fetch\(|setItem/.test(still), 'drawing a held panel writes nothing');
});

await check('shell.js installs the guard first and leaves the rotation, the takeovers and the reports out of a held page', () => {
  const shell = source('shell.js');
  const imports = shell.split('\n').filter(line => line.startsWith('import'));
  assert.equal(imports[0], "import './core/row-preview-guard.js'; // first, so a row preview is read only before anything else runs");

  // Everything that writes or takes over starts only when no panel is held (?show= is set by every still address)
  const held = shell.slice(shell.indexOf("if (!params.get('show') && !stress) {"));
  ['startTakeovers', 'startHidden', 'startPresentations', 'startNowReport', 'startDots', 'startViews', 'startTeams', 'startAnnounceRunner', 'startNoticeRunner(getContent)'].forEach(word => {
    assert.ok(held.includes(word), word + ' is inside the block that a held page skips');
  });
  assert.ok(shell.includes("if (params.has('night') || (!params.get('show') && !stress))"), 'the night screen is left out of a held page');

  const extras = source('shell-extras.js');
  assert.ok(extras.includes('if (!rowPreview) startHeartbeat();'), 'the watchdog heartbeat is the wall page only');
  const state = source('shell-state.js');
  assert.ok(state.indexOf('useRowPreview(params, rowPreview)') < state.indexOf('readStill(params)'), 'the row is turned into the still address before it is read');
});

await check('the row preview address is explained in docs/layouts.md or docs/control-page.md', () => {
  const docs = ['docs/control-page.md', 'docs/layouts.md', 'docs/rotation-board.md'].map(file => fs.readFileSync(path.join(repo, file), 'utf8')).join('\n');
  assert.ok(docs.includes('rowpreview'));
});

console.log('\n' + passed + ' checks passed');
