// A white flash on the TV: what the page does so that it never shows the white default of the browser, never
// reloads on a failed fetch, and writes down every page load with its reason (dashboard/core/page-loads.js).
//
//   node tests/flash.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { countedHours, keptMost, loadsKey, noteReload, reasonFor, reasonKey, recordPageLoad, pageLoadSummary, summarize } from '../dashboard/core/page-loads.js';
import { cleanReport } from '../dashboard/core/now-report-parts.js';
import { pageLoadsLine } from '../control/static/tabs/render.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(repo, name), 'utf8');

function listFiles(folder, found = []) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'vendor') continue;
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) listFiles(full, found);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.html')) found.push(full);
  }
  return found;
}

// A browser storage that holds strings, for the page-loads module
function fakeStorage() {
  const kept = new Map();
  return {
    getItem: key => (kept.has(key) ? kept.get(key) : null),
    setItem: (key, value) => { kept.set(key, String(value)); },
    removeItem: key => { kept.delete(key); },
  };
}

function fakeBrowser(type = 'navigate') {
  globalThis.window = { localStorage: fakeStorage(), sessionStorage: fakeStorage() };
  globalThis.performance = { getEntriesByType: () => [{ type: type }] };
  return globalThis.window;
}

test('index.html sets a dark canvas before any stylesheet, so a page with no style yet is never white', () => {
  const html = read('dashboard/index.html');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(/<meta name="color-scheme" content="dark">/.test(head), 'the browser canvas is dark');
  const inline = head.indexOf('<style>html, body { background: black; }</style>');
  assert.ok(inline > 0, 'an inline rule gives html and body a background');
  assert.ok(inline < head.indexOf('<link rel="stylesheet"'), 'before the first stylesheet');
  assert.ok(!/http-equiv=["']?refresh/i.test(html), 'no meta refresh');
});

test('the stylesheets of the build are added next to the old ones and the old ones go when the new ones have loaded', () => {
  const html = read('dashboard/index.html');
  assert.ok(!html.includes("links[i].setAttribute('href'"), 'a changed href takes the old style off at once');
  assert.ok(html.includes('copy.onload') && html.includes('sheet.remove()'));
});

test('the page reloads in four places only, each writes its reason first, and none reloads because a fetch failed', () => {
  const found = [];
  listFiles(path.join(repo, 'dashboard')).forEach(file => {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      if (/\.reload\(\)/.test(line)) found.push({ file: path.relative(repo, file), before: lines.slice(Math.max(0, index - 4), index + 1).join('\n') });
    });
  });
  assert.deepEqual(found.map(item => item.file).sort(), ['dashboard/core/layout-apply.js', 'dashboard/index.html', 'dashboard/shell-extras.js', 'dashboard/shell-extras.js']);
  found.forEach(item => assert.ok(/noteReload\(|teletraan-reload-reason/.test(item.before), item.file + ' says why before it reloads'));

  const extras = read('dashboard/shell-extras.js');
  const watcher = extras.slice(extras.indexOf('async function check()'), extras.indexOf('check(); // read it once now'));
  const failure = watcher.slice(watcher.indexOf('} catch'));
  assert.ok(!failure.includes('reload'), 'a failed version.txt fetch does nothing');
  assert.ok(watcher.includes("if (!response.ok) return;") && watcher.includes("if (version === '') return;"), 'an error answer and an empty file are ignored');
});

test('no service worker, no cache API and no navigation in the dashboard code', () => {
  listFiles(path.join(repo, 'dashboard')).forEach(file => {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/serviceWorker|caches\.open/.test(text), path.relative(repo, file));
    assert.ok(!/location\.(href|assign|replace)\s*[=(]/.test(text), path.relative(repo, file) + ' navigates');
  });
});

test('a load with a reason, a browser start and a reload from outside are told apart', () => {
  assert.equal(reasonFor('a new version was installed', true, 'reload'), 'a new version was installed');
  assert.match(reasonFor('', false, 'navigate'), /browser started/);
  assert.match(reasonFor('', true, 'reload'), /from outside the page/);
  assert.match(reasonFor('', true, 'back_forward'), /back_forward/);
});

test('recordPageLoad counts the loads of the last 24 hours and keeps the reason of the newest', () => {
  const window = fakeBrowser();
  const start = new Date('2026-10-20T10:00:00Z');
  recordPageLoad(start);
  noteReload('a new version was installed');
  assert.equal(window.sessionStorage.getItem(reasonKey), 'a new version was installed');
  const second = recordPageLoad(new Date(start.getTime() + 3600 * 1000));
  assert.equal(second.count, 2);
  assert.equal(second.reason, 'a new version was installed');
  assert.equal(window.sessionStorage.getItem(reasonKey), null, 'the reason is used once');
  const third = recordPageLoad(new Date(start.getTime() + 2 * 3600 * 1000));
  assert.match(third.reason, /reload|opened again/, 'no reason left, so it says so');
  const later = new Date(start.getTime() + (countedHours + 3) * 3600 * 1000);
  assert.equal(pageLoadSummary(later).count, 0, 'loads older than 24 hours are not counted');
  assert.equal(JSON.parse(window.localStorage.getItem(loadsKey)).length, 3);
});

test('the list is cut to the newest loads, and storage that throws does not stop the page', () => {
  const window = fakeBrowser();
  const now = new Date('2026-10-20T10:00:00Z');
  for (let i = 0; i < keptMost + 20; i++) recordPageLoad(new Date(now.getTime() + i * 1000));
  assert.equal(JSON.parse(window.localStorage.getItem(loadsKey)).length, keptMost);

  globalThis.window = { get localStorage() { throw new Error('blocked'); }, get sessionStorage() { throw new Error('blocked'); } };
  const kept = recordPageLoad(now);
  assert.equal(kept.count, 1, 'the load is still counted for this run');
  noteReload('x'); // does not throw
  assert.deepEqual(summarize(null, now), { count: 0, reason: '', at: '' });
});

test('the report carries the loads, cut to size, and the control page line says them in words', () => {
  const clean = cleanReport({ loads: 3, loadReason: 'a new version was installed', loadAt: '2026-10-20T10:00:00.000Z' });
  assert.deepEqual([clean.loads, clean.loadReason, clean.loadAt], [3, 'a new version was installed', '2026-10-20T10:00:00.000Z']);
  assert.equal(cleanReport({}).loads, null);
  assert.equal(cleanReport({ loads: 'many' }).loads, null);
  assert.equal(cleanReport({ loadReason: 'x'.repeat(500) }).loadReason.length, 100);

  assert.equal(pageLoadsLine({ report: clean }), 'Page loads in the last 24 hours: 3, last reason: a new version was installed at 10:00 UTC.');
  assert.match(pageLoadsLine({ report: null }), /not reported yet/);
  assert.match(pageLoadsLine({ report: { loads: 0, loadReason: '', loadAt: '' } }), /: 0\./);
});

test('the control service writes one log line for each new page load it hears of', () => {
  const text = read('control/routes/now.js');
  assert.ok(text.includes("report.loadAt !== '' && (!before || before.loadAt !== report.loadAt)"), 'only when the load time changed');
  assert.ok(text.includes("ctx.log('wall page load at '"));
});

test('the kiosk script logs browser errors and lets local.env choose the graphics', () => {
  const text = read('computer/scripts/kiosk.sh');
  assert.ok(text.includes('--enable-logging=stderr') && text.includes('--log-level=2'));
  assert.ok(text.includes('case $(setting KIOSK_GRAPHICS) in'));
  assert.ok(text.includes('graphics=(--enable-gpu-rasterization --ignore-gpu-blocklist)'), 'the default is what it was');
  assert.ok(text.includes('graphics=(--disable-gpu)') && text.includes('graphics=()'));
  assert.ok(text.includes('"${graphics[@]}"'));
});

test('the mirror takes no screenshot while the screencast works, and never more often than once a second after', () => {
  const text = read('computer/scripts/mirror.py');
  assert.ok(text.includes("next_probe = float('inf')"), 'no probe at the start');
  assert.ok(text.includes("if mode == 'screenshots' and now >= next_probe:"), 'a probe only in the fallback');
  assert.ok(/SHOT_SECONDS = 1\.0/.test(text));
  assert.equal(text.split("'Page.captureScreenshot'").length - 1, 2, 'the probe and the fallback are the only screenshots');
});

await finish();
