// A control service for a browser test of the Display tab: the real service (control/server.js) on a free port, with a fake
// Sanity that answers Dashboard Settings and the sample content, no PIN, and the dashboard folder served at /dashboard/ the way
// nginx serves it on port 3229. Every address in the page is on this one port, so the frames are on the page's own origin.
// Nothing leaves the machine.

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createService, readConfig } from '../../control/server.js';
import { defaultRotationRows } from '../../dashboard/config-rotation.js';
import { normalizeSample } from '../../dashboard/core/sanity.js';
import { repo } from './control-world.mjs';

const types = { html: 'text/html', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', jpg: 'image/jpeg', webp: 'image/webp', ics: 'text/calendar', txt: 'text/plain' };

// sample: true sends a page address without ?sample=1 to the same address with it, so the frames read the sample content
// and not the network
function serveDashboard(req, res, sample, content) {
  if (sample && /^\/dashboard\/(index\.html)?\?/.test(req.url) && !/[?&]sample=1/.test(req.url)) {
    res.writeHead(302, { Location: req.url + '&sample=1' });
    res.end();
    return;
  }

  // The sample content comes from memory, so a test can change it the way an editor changes the content in Sanity
  if (req.url.split('?')[0] === '/dashboard/data/sample/content.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(content));
    return;
  }
  const folder = path.join(repo, 'dashboard');
  let name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/dashboard\//, '');
  if (name === '' || name.endsWith('/')) name += 'index.html';
  const file = path.join(folder, name);
  if (path.relative(folder, file).startsWith('..')) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  fs.readFile(file, (error, bytes) => {
    if (error) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).slice(1)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(bytes);
  });
}

// options.sample: false leaves the frames on the network (they read the sample content otherwise).
// options.rows: the rotation rows (the standard order when left out). options.onRequest(req) sees every request, so a test can
// count them. Returns { url, requests, rows, editSample, close, ctx }.
export async function startDisplayWorld(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-display-world-'));
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(root, 'local.env'), "SANITY_WRITE_TOKEN='skFAKEtoken0123456789'\nCONTROL_PIN='123456'\n");

  const rows = (options.rows || defaultRotationRows()).map((row, at) => Object.assign({ _key: 'row' + String(at).padStart(3, '0') }, row));
  const settings = { _id: 'dashboardSettings', _type: 'dashboardSettings', _rev: 'rev-1', _updatedAt: new Date().toISOString(), pageSeconds: 20, rotationRows: rows };
  const sample = JSON.parse(fs.readFileSync(path.join(repo, 'dashboard/data/sample/content.json'), 'utf8'));

  const config = Object.assign(readConfig({ CONTROL_ROOT: root, CONTROL_DATA: dataDir, CONTROL_ENV_FILE: path.join(root, 'local.env') }), { port: 0 });
  const { server, ctx } = await createService(config, {
    pinCheck: () => true,
    fetch: async url => {
      const text = decodeURIComponent(String(url));
      const body = text.includes('"drafts.dashboardSettings"]') ? { result: [settings] } : { result: null };
      return { ok: true, status: 200, json: async () => body };
    },
  });
  ctx.state.displayWorld = { at: Date.now() + 3600 * 1000, world: { content: normalizeSample(sample), now: new Date(), match13: null, problem: '' } };

  const requests = [];
  const outer = http.createServer((req, res) => {
    requests.push({ method: req.method, url: req.url });
    if (options.onRequest) options.onRequest(req);
    if (req.url.startsWith('/dashboard/')) return serveDashboard(req, res, options.sample !== false, sample);
    return server.emit('request', req, res);
  });
  await new Promise(resolve => outer.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + outer.address().port;

  return {
    url, requests, ctx, rows,
    // Changes the sample content that the frames read; they see it at their next read (30 seconds)
    editSample: change => change(sample),
    close: () => new Promise(resolve => { outer.closeAllConnections(); outer.close(resolve); fs.rmSync(root, { recursive: true, force: true }); }),
  };
}
