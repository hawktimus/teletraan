// The Live preview card on the Now showing tab: a copy of the dashboard in a frame on port 3229. The copy must
// never report to the control service as if it were the wall, and must write nothing anywhere.
//
//   node tests/control-preview.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { previewCardHtml, previewScale, previewWidth, previewHeight } from '../control/static/tabs/render.js';
import { startNowReport } from '../dashboard/core/now-report.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');

test('the card names /dashboard/ with no added parameter, holds no frame yet, and says what it is', () => {
  const html = previewCardHtml();
  assert.ok(html.includes('<h2>Live preview</h2>'));
  assert.ok(html.includes('data-src="/dashboard/"') && !/ src=/.test(html), 'no src until the person asks, and no parameter on the address');
  assert.ok(!html.includes('<iframe'), 'the page makes the frame when the person asks (tabs/now.js)');
  assert.ok(/<button[^>]*data-preview-toggle[^>]*>Show live preview<\/button>/.test(html));
  assert.ok(read('control/static/tabs/preview.js').includes('frame.width = previewWidth') && read('control/static/tabs/preview.js').includes('frame.height = previewHeight'));
  assert.ok(html.includes('A copy that follows the screen. It shows the same panel, team and theme as the TV, and changes when the TV changes, within about ten seconds. Animations and the exact moment can differ.'));
  assert.ok(!html.includes('The TV has not reported yet'), 'the sentence is written by the page, only in the copy mode');
  assert.ok(!html.includes('!'));
  assert.equal(previewWidth / previewHeight, 16 / 9);
});

test('the scale is the width of the box over 1920, and a box with no width still gives a number', () => {
  assert.equal(previewScale(960), 0.5);
  assert.equal(previewScale(360), 0.1875);
  assert.equal(previewScale(1920), 1);
  [0, -5, NaN, undefined, 'x'].forEach(width => assert.equal(previewScale(width), 0.1));
});

test('the tab puts the card between the card of the wall and the buttons, and fits it to its box', () => {
  const text = read('control/static/tabs/now.js');
  assert.ok(text.indexOf('data-card') < text.indexOf('data-preview-card') && text.indexOf('data-preview-card') < text.indexOf('data-controls'));
  const preview = read('control/static/tabs/preview.js');
  assert.ok(preview.includes('previewScale(box.clientWidth)') && preview.includes('ResizeObserver'));
  const css = read('control/static/tabs/tabs.css');
  assert.ok(/aspect-ratio: 16 \/ 9/.test(css) && /\.preview iframe \{[^}]*width: 1920px; height: 1080px/.test(css));
});

test('port 3229 serves the dashboard like the local server: same root, same manifest rule, and the Studio and control still there', () => {
  const nginx = read('computer/nginx/nginx.conf');
  const start = nginx.indexOf('listen 3229;');
  const block = nginx.slice(nginx.lastIndexOf('server {', start), nginx.indexOf('\n  server {', start));
  assert.ok(/root \/srv\/web;\s+index index\.html;/.test(block));
  assert.ok(block.includes('slides/[^/]+/manifest') && block.includes('max-age=10'));
  assert.ok(!nginx.includes('The dashboard is not served here'), 'the old comment is gone');
  assert.ok(!/local\.env|secret/i.test(block), 'nothing secret is mapped');
  const compose = read('computer/docker-compose.yml');
  assert.ok(compose.includes('/current/dashboard:/srv/web/dashboard:ro') && compose.includes('target: /srv/web/dashboard/data/live'), 'one mount serves both ports');
});

test('a page that is not on this computer sends no report and starts no timer', () => {
  const sent = [];
  const timers = [];
  const realFetch = globalThis.fetch;
  const realInterval = globalThis.setInterval;
  globalThis.fetch = (...args) => { sent.push(args); return Promise.resolve({}); };
  globalThis.setInterval = (...args) => { timers.push(args); return 0; };
  try {
    ['teletraan.local', '192.168.1.40', '100.64.0.7', 'my-tailscale-name', ''].forEach(host => startNowReport(() => ({}), () => '', host));
  } finally {
    globalThis.fetch = realFetch;
    globalThis.setInterval = realInterval;
  }
  assert.deepEqual(sent, []);
  assert.deepEqual(timers, []);
});

test('the kiosk on this computer does report, to the address nginx lets through from here', () => {
  const sent = [];
  const timers = [];
  const realFetch = globalThis.fetch;
  const realInterval = globalThis.setInterval;
  const realDocument = globalThis.document;
  globalThis.document = { documentElement: { dataset: {} }, querySelector: () => null };
  globalThis.fetch = (...args) => { sent.push(args); return Promise.resolve({}); };
  globalThis.setInterval = (...args) => { timers.push(args); return 0; };
  try {
    startNowReport(() => ({}), () => '', '127.0.0.1');
  } finally {
    globalThis.fetch = realFetch;
    globalThis.setInterval = realInterval;
    globalThis.document = realDocument;
  }
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], '/control/api/now');
  assert.equal(timers.length, 1);
});

test('the only place the dashboard sends data out is the report, and the route refuses it from the WiFi port', () => {
  const found = [];
  (function walk(folder) {
    fs.readdirSync(path.join(repo, folder), { withFileTypes: true }).forEach(entry => {
      const relative = path.join(folder, entry.name);
      if (entry.isDirectory()) return walk(relative);
      if (/\.(js|mjs)$/.test(entry.name) && /method:\s*['"](POST|PUT|PATCH|DELETE)['"]|sendBeacon/.test(read(relative))) found.push(relative);
    });
  })('dashboard');
  assert.deepEqual(found, ['dashboard/core/now-report.js']);
  const nginx = read('computer/nginx/nginx.conf');
  assert.ok(/location = \/control\/api\/now \{\s*limit_except GET \{\s*deny all;/.test(nginx));
});

test('the heartbeat only sets the title of its own page and its own storage, so a frame cannot change the control page title', () => {
  const text = read('dashboard/core/heartbeat.js');
  assert.ok(text.includes('document.title =') && text.includes('localStorage.setItem'));
  assert.ok(!/fetch\(|window\.parent|window\.top|postMessage/.test(text));
});

await finish();
