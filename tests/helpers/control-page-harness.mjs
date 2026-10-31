// The real control service with a fake computer around it, for the tests and the screenshots that open the page in a browser
// (Playwright). The helper (the host side), Sanity and the files the other services write are all stand-ins, so nothing leaves the
// process and no key is read. A scenario sets what the computer says:
//
//   good               every source fresh, the network fine, the screen reporting
//   calendar-failed    the calendar feed failed with a secure connection error; everything else fine
//   empty              the computer knows nothing yet: no status, no sync file, no releases
//
//   const world = await startControl({ scenario: 'good' });
//   const { page, context } = await world.open(390, 844, 'now', { dark: true });
//   world.set({ scenario: 'calendar-failed' });   changes what the next answer says
//   await world.close();

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createService, readConfig } from '../../control/server.js';
import { defaultRotationRows } from '../../dashboard/config-rotation.js';
import { loadPlaywright } from '../../tools/screenshots.mjs';
import { makeFakeSanity } from './fake-sanity.mjs';
import { seedDocuments } from './settings-all-harness.mjs';

const minutesAgo = minutes => new Date(Date.now() - minutes * 60000).toISOString();

const networkText = 'interface: wlp2s0\ntype: Wi-Fi\nlink: up, carrier 1\nsignal: 78 percent\nip: 10.20.30.40/24\ngateway: 10.20.30.1\ndns: 10.20.30.1\n';

// What each scenario writes into the files of the data folder and what the host helper prints
function filesFor(scenario) {
  if (scenario === 'empty') return { sync: null, netwatch: null, remote: null, mini: null };
  const failed = scenario === 'calendar-failed';
  return {
    sync: {
      generatedAt: minutesAgo(0),
      sources: {
        sanity: { lastSuccessAt: minutesAgo(1), lastFailureAt: null, lastFailureReason: '' },
        weather: { lastSuccessAt: minutesAgo(8), lastFailureAt: null, lastFailureReason: '' },
        images: { lastSuccessAt: minutesAgo(30), lastFailureAt: null, lastFailureReason: '' },
        monday: { lastSuccessAt: minutesAgo(12), lastFailureAt: null, lastFailureReason: '' },
        competition: { lastSuccessAt: minutesAgo(40), lastFailureAt: null, lastFailureReason: '' },
        calendars: failed
          ? { lastSuccessAt: minutesAgo(95), lastFailureAt: minutesAgo(5), lastFailureReason: 'TLS handshake failed: secure connection failed (ssl error)' }
          : { lastSuccessAt: minutesAgo(14), lastFailureAt: null, lastFailureReason: '' },
      },
      network: { ok: true, since: null },
    },
    netwatch: { failures: 0, lastCheckAt: minutesAgo(1), lastOkAt: minutesAgo(1), lastAction: null, lastActionAt: null, lastRebootAt: null },
    remote: { action: 'restart-kiosk', requestedBy: 'Jason', handledAt: minutesAgo(50), result: 'Done.', via: 'sanity' },
    mini: { lastContentSeenAt: minutesAgo(1), lastCalendarSyncAt: failed ? minutesAgo(95) : minutesAgo(14), lastMondaySyncAt: minutesAgo(12), lastFrcSyncAt: minutesAgo(40), lastBackupAt: minutesAgo(600) },
  };
}

const onePixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export async function startControl(options = {}) {
  const playwright = await loadPlaywright();
  if (!playwright) return null;
  const state = { scenario: options.scenario || 'good', helperDelay: 0, helperFails: {}, helped: [], unreachable: false };

  const documents = seedDocuments().map(doc => (doc._id === 'dashboardSettings'
    ? Object.assign({}, doc, { rotationRows: defaultRotationRows().map((row, at) => Object.assign({ _key: 'row' + String(at).padStart(3, '0') }, row)), rebootEnabled: false, rebootDays: [1, 2, 3], rebootTime: '03:30', rebootSkipBusy: true, rebootWaitMinutes: 30 })
    : doc));
  const sanity = makeFakeSanity(documents);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-page-'));
  const dataDir = path.join(root, 'data');
  fs.mkdirSync(dataDir);
  fs.writeFileSync(path.join(root, 'local.env'), "SANITY_WRITE_TOKEN='skFAKEtoken0123456789'\nCONTROL_PIN='123456'\n");
  const netwatchFile = path.join(root, 'netwatch.json');
  const config = Object.assign(readConfig({ CONTROL_ROOT: root, CONTROL_DATA: dataDir, CONTROL_ENV_FILE: path.join(root, 'local.env'), CONTROL_NETWATCH: netwatchFile }), { port: 0 });

  function write(file, value) {
    if (value === null) fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, JSON.stringify(value));
  }
  function apply() {
    const files = filesFor(state.scenario);
    write(path.join(dataDir, 'sync-status.json'), files.sync);
    write(netwatchFile, files.netwatch);
    write(path.join(dataDir, 'remote-last.json'), files.remote);
    state.mini = files.mini;
    state.calendarErrors = state.scenario === 'calendar-failed' ? 1 : 0;
  }
  apply();

  const helper = async (word, args) => {
    state.helped.push([word].concat(args || []));
    if (state.helperDelay) await new Promise(resolve => setTimeout(resolve, state.helperDelay));
    if (state.helperFails[word]) throw new Error(state.helperFails[word]);
    if (word === 'status') return state.scenario === 'empty' ? '' : 'user: teletraan\nhost: teletraan\nkiosk: active\nuptime: 183500\ndisplay: output HDMI-1, mode 1920x1080\nnetworkState: ok\nnetworkLastOkAt: ' + minutesAgo(1) + '\n';
    if (word === 'network-info') return networkText;
    return 'done';
  };

  // The status question of the Now area goes to Sanity; the rest is the fake that remembers
  const fetchLike = async (url, init) => {
    const text = decodeURIComponent(String(url)) + (init && init.body ? ' ' + String(init.body) : '');
    if (text.includes('status-mini')) {
      const result = state.mini ? { mini: state.mini, monday: { lastSyncAt: state.mini.lastMondaySyncAt, lastError: '' }, settings: { mondayEveryMinutes: 30 }, calendarErrors: state.calendarErrors } : null;
      return { ok: true, status: 200, json: async () => ({ result: result }) };
    }
    return sanity.fetch(url, init);
  };

  const { server, ctx } = await createService(config, { pinCheck: () => true, fetch: fetchLike, helper: helper });
  ctx.state.displayWorld = { at: Date.now() + 24 * 3600 * 1000, world: { content: { tasks: [] }, now: new Date(), match13: null, problem: '' } };
  const touchWall = () => {
    ctx.state.wallSeen = state.scenario === 'empty' ? null : { report: { view: 'general', theme: 'original', panel: 'agenda', build: 'v14 abc1234', pause: false, hold: '' }, received: new Date() };
  };
  touchWall();
  const keepWall = setInterval(touchWall, 4000);

  // The preview frames ask for the dashboard, which this harness answers with an empty page
  const outer = http.createServer((req, res) => {
    // nginx serves the pictures of the live preview; a one pixel picture stands in
    if (req.url.startsWith('/mirror/')) { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(onePixel); return; }
    if (req.url.startsWith('/dashboard/')) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>dashboard</title><p>The dashboard is not served by this test.</p>'); return; }
    server.emit('request', req, res);
  });
  await new Promise(resolve => outer.listen(0, '127.0.0.1', resolve));
  const base = 'http://teletraan.test:' + outer.address().port;
  const browser = await playwright.chromium.launch({ args: ['--host-resolver-rules=MAP teletraan.test 127.0.0.1'] });

  const world = {
    base, browser, playwright, sanity, ctx, state, root, dataDir,
    // scenario, helperDelay and helperFails can change while the page is open
    set(changes) {
      Object.assign(state, changes);
      if (changes.scenario) { apply(); touchWall(); }
      ctx.state.overviewStatus = null;
    },
    // A page in a new browser context at a width, signed in, on the address of an area. options: { dark, light, reduceMotion, requests }
    async open(width, height, address, opts = {}) {
      const context = await browser.newContext({ viewport: { width: width, height: height }, colorScheme: opts.dark ? 'dark' : 'light', reducedMotion: opts.reduceMotion ? 'reduce' : 'no-preference' });
      const page = await context.newPage();
      if (opts.requests) page.on('request', request => opts.requests.push(request.url()));
      if (opts.errors) {
        page.on('console', message => { if (message.type() === 'error') opts.errors.push(message.text()); });
        page.on('pageerror', error => opts.errors.push(String(error)));
      }
      await page.goto(base + '/control/login.html');
      await page.evaluate(() => fetch('api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '123456' }) }));
      await page.goto(base + '/control/#' + address);
      await page.waitForSelector('#tabs a');
      return { context, page };
    },
    async close() {
      clearInterval(keepWall);
      await browser.close();
      outer.closeAllConnections();
      outer.close();
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
  return world;
}
