// The ways into the Studio: port 3426 goes straight to it, the landing page on 3229 has two big buttons, the
// header of the control page has a Studio button, and the CORS hint names the 3426 address.
//
//   node tests/control-studio-links.test.mjs

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, finish } from './helpers/runner.mjs';
import { studioOrigin, createCorsCheck } from '../control/lib/cors.js';
import { healthHtml } from '../control/static/tabs/render-health.js';
import { controlAddress, controlSections } from '../studio/inputs/control-address.js';

const repo = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(repo + name, 'utf8');

// The text of the server block that listens on a port
function serverBlock(nginx, port) {
  const start = nginx.indexOf('listen ' + port + ';');
  assert.ok(start > 0, 'no server listens on ' + port);
  const open = nginx.lastIndexOf('server {', start);
  const next = nginx.indexOf('\n  server {', start);
  return nginx.slice(open, next < 0 ? nginx.length : next);
}

test('the web container publishes 3229 and 3426, and mounts the landing page read only', () => {
  const compose = read('computer/docker-compose.yml');
  // The address in front is TELETRAAN_LISTEN, or every address when it is not set (docs/security-review.md)
  assert.ok(compose.includes(':-0.0.0.0}:3229:3229"') && compose.includes(':-0.0.0.0}:3426:3426"'));
  assert.ok(/landing\.html:\/srv\/landing\/index\.html:ro/.test(compose));
});

test('port 3426 sends / to /studio/ and serves the Studio like 3229, and nothing else', () => {
  const block = serverBlock(read('computer/nginx/nginx.conf'), 3426);
  assert.ok(/location = \/ \{\s*return 302 \/studio\/;/.test(block));
  assert.ok(/location \/studio\/ \{\s*try_files \$uri \$uri\/ \/studio\/index\.html;/.test(block));
  assert.ok(!block.includes('/control/') && !block.includes('/dashboard/'));
});

test('port 3229 shows the landing page at / and still proxies the control page and serves the Studio', () => {
  const block = serverBlock(read('computer/nginx/nginx.conf'), 3229);
  assert.ok(/location = \/ \{\s*root \/srv\/landing;\s*try_files \/index\.html =404;/.test(block));
  assert.ok(!block.includes('return 302 /control/'), 'it no longer redirects to the control page');
  assert.ok(block.includes('location /control/ {') && block.includes('location /studio/ {'));
});

test('the landing page has the two buttons, 44px or more high, in the colors of the control page', () => {
  const html = read('computer/nginx/landing.html');
  assert.ok(/<a class="first" href="\/control\/">Control page<\/a>/.test(html));
  assert.ok(/<a href="\/studio\/">Studio<\/a>/.test(html));
  assert.ok(/min-height: (9\d|[1-9]\d\d)px/.test(html));
  assert.ok(html.includes('width=device-width'));
  assert.ok(html.includes('#faca2a') && html.includes('#1a1228'), 'the yellow and the dark card of tabs.css');
  assert.ok(!/<script|https?:\/\/[a-z]/.test(html), 'no script and no outside address');
});

test('the header of the control page has a Studio button that opens /studio/ in a new tab', () => {
  const html = read('control/static/index.html');
  assert.ok(/<a class="studio" href="\/studio\/" target="_blank" rel="noopener">Studio<\/a>/.test(html));
  assert.ok(/\.studio \{[^}]*min-height: 44px/.test(read('control/static/style.css')));
});

test('the CORS hint names the same address on port 3426, for the WiFi name, a Tailscale address and a name with no port', () => {
  assert.equal(studioOrigin('http://teletraan.local:3229'), 'http://teletraan.local:3426');
  assert.equal(studioOrigin('http://100.64.0.7:3229'), 'http://100.64.0.7:3426');
  assert.equal(studioOrigin('http://teletraan.local'), 'http://teletraan.local:3426');
});

test('a missing origin says to add the 3426 address too, and an allowed one says nothing of it', async () => {
  const headers = value => ({ get: name => (name === 'access-control-allow-origin' ? value : null) });
  const options = { projectId: 'abc123', dataset: 'production', apiVersion: '2025-02-19' };
  const missing = await createCorsCheck(Object.assign({ fetch: async () => ({ headers: headers(null) }) }, options)).check('http://teletraan.local:3229');
  assert.equal(missing.message, 'CORS origin missing');
  assert.equal(missing.also, 'http://teletraan.local:3426');
  const html = healthHtml({ cors: missing, mini: {} }, null, new Date());
  assert.ok(html.includes('http://teletraan.local:3229') && html.includes('port 3426') && html.includes('http://teletraan.local:3426'));
  const allowed = await createCorsCheck(Object.assign({ fetch: async () => ({ headers: headers('http://teletraan.local:3229') }) }, options)).check('http://teletraan.local:3229');
  assert.equal(allowed.also, undefined);
});

test('the control page doc names the landing page, port 3426 and the extra CORS origin', () => {
  const text = read('docs/control-page.md');
  ['http://teletraan.local:3426', 'Control page and Studio', 'Studio button'].forEach(words => assert.ok(text.includes(words), words));
});

test('the Studio links name tabs and sections the control page has, and the older addresses still reach them', async () => {
  const { resolveAddress } = await import('../control/static/tabs.js');
  const settings = fs.readFileSync(repo + 'control/static/tabs/settings.js', 'utf8');
  const known = { status: ['status'], display: ['display'], settings: ['settings'] };
  Object.values(controlSections).forEach(address => {
    assert.ok(address.startsWith(controlAddress + '#'), address);
    const found = resolveAddress(address.slice(controlAddress.length + 1));
    assert.ok(known[found.id], 'the control page has a tab ' + found.id);
  });
  assert.deepEqual(resolveAddress('settings/monday'), { id: 'settings', section: 'monday' });
  assert.deepEqual(resolveAddress('settings/sync'), { id: 'settings', section: 'sync' });
  ['keys', 'monday', 'sync'].forEach(id => assert.ok(settings.includes("{ id: '" + id + "'"), 'Settings has a section ' + id));
  const monday = fs.readFileSync(repo + 'studio/tools/monday-check.js', 'utf8');
  assert.ok(monday.includes("controlAddress + '#settings/monday'"));
});

await finish();
