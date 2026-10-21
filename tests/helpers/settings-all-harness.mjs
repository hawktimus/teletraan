// A small web server for looking at the All settings form in a real browser without the control service or the Mini: it serves
// control/static, and answers /control/api/* with the real settings routes (control/routes/settings-doc.js) over a fake Sanity that
// remembers (tests/helpers/fake-sanity.mjs). The page is /harness.html. Nothing leaves the process.
//
//   const harness = await startHarness();
//   harness.url + '/harness.html'
//   harness.sanity.touch('dashboardSettings', { pageSeconds: 33 });
//   await harness.close();

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRouter } from '../../control/lib/router.js';
import * as settingsRoutes from '../../control/routes/settings-doc.js';
import { makeFakeSanity } from './fake-sanity.mjs';
import { repo } from './control-world.mjs';

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.woff2': 'font/woff2', '.json': 'application/json' };

// Documents that look like the real ones, with the starting values of the schemas
export function seedDocuments() {
  const colors = { primary: '#6C18B6', plate: '#3B2A7A', accent: '#FACA2A', neon: '#FACA2A', pink: '#B23CFF', background: '#0B0714', text: '#FFFFFF', body: '#1A0F2E', label: '#FACA2A' };
  return [
    {
      _id: 'dashboardSettings', _type: 'dashboardSettings', pageSeconds: 20, doneDays: 7, speed: 'normal', frameMetal: 'gold', glint: true, look: 'polished', frameFinish: 'mostly-gold',
      pageChangeStyle: 'alternate', breakSeconds: 0.6, silverChance: 10, logoAnimations: true, logoSpin: true, logoSpinEvery: 72, logoSpinDuration: 1.6, nameTransform: true,
      crt: { on: true, everySeconds: 240, durationSeconds: 2.7 }, nightEnabled: true, nightStyle: 'bounce', nightLogoWidth: 300, nightSpeed: 'normal',
      countdown: { kickoffLabel: 'KICKOFF IN', kickoff: '2027-01-09T17:00:00.000Z', rolloutLabel: 'ROLLOUT IN' },
      calendars: [{ _key: 'c1', id: 'team', name: 'Team calendar', kind: 'meetings', show: true }, { _key: 'c2', id: 'build_season', name: 'Build season', show: true }],
      groupEventsByKind: false, mondayEveryMinutes: 30, competitionMode: 'auto', newsEnabled: true, newsCategories: ['FRC', 'Control System'],
      announcements: [{ _key: 'a1', time: '14:30', title: 'WHAT TIME IS IT?', followUp: 'PRIMETIME', titleSeconds: 12, followUpSeconds: 10, days: [1, 2, 3, 4, 5], show: true }],
      rotationRows: [{ _key: 'r1', view: 'prime', panel: 'tasks' }], rebootTime: '03:30', motion: 'full',
    },
    { _id: 'theme', _type: 'theme', timeZone: 'America/New_York', seasonOverPanels: true, defaultTheme: 'hawktimus', schedule: [{ _key: 's1', _type: 'rule', name: 'Winter', kind: 'overlay', overlay: 'christmas', startDate: '2026-12-01', endDate: '2026-12-31', repeatsEveryYear: true, tickerPrefix: 'HOLIDAYS' }] },
    { _id: 'view-general', _type: 'view', key: 'general', title: 'General', layout: 'standard', mirror: false, colors: 'general', countdownIn: 'side' },
    { _id: 'view-prime', _type: 'view', key: 'prime', title: 'Prime', layout: 'standard', mirror: false, colors: 'team', countdownIn: 'side' },
    { _id: 'view-nova', _type: 'view', key: 'nova', title: 'Nova', layout: 'standard', mirror: true, colors: 'team', countdownIn: 'banner' },
    { _id: 'view-family', _type: 'view', key: 'family', title: 'Family', layout: 'bar', mirror: false, colors: 'general', countdownIn: 'banner' },
    { _id: 'team-prime', _type: 'team', name: 'HAWKTIMUS PRIME', number: '3229', shortName: 'PRIME', code: 'prime', metal: 'gold', colors: colors, glow: false, mirror: false, active: true, order: 10, outlinedName: false },
    { _id: 'team-nova', _type: 'team', name: 'HAWKTIMUS NOVA', number: '3426', shortName: 'NOVA', code: 'nova', metal: 'steel', colors: Object.assign({}, colors, { primary: '#7FD4FF', accent: '#BFEFFF' }), glow: true, mirror: true, active: true, order: 20, outlinedName: true },
    { _id: 'panel-info', _type: 'customPanel', title: 'INFO', blocks: [{ _key: 'b1', _type: 'headingBlock', text: 'SAFETY FIRST' }, { _key: 'b2', _type: 'textBlock', text: 'Eyes on, glasses on.' }], show: true },
    { _id: 'subtheme-snow', _type: 'subtheme', name: 'Snow', enabled: true, start: '2026-12-01', end: '2026-12-31', priority: 10, preset: 'winter' },
  ];
}

export async function startHarness(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'teletraan-settings-all-'));
  const envFile = path.join(root, 'local.env');
  fs.writeFileSync(envFile, "SANITY_WRITE_TOKEN='skFAKEtoken0123456789'\n");

  const sanity = makeFakeSanity(options.documents || seedDocuments());
  const ctx = { root: repo.replace(/\/$/, ''), dataDir: root, envFile: envFile, state: {}, log: () => {}, fetch: sanity.fetch, pinCheck: () => true };
  const router = createRouter();
  settingsRoutes.register(router, ctx);

  const staticFolder = path.join(repo, 'control', 'static');
  const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Settings harness</title><link rel="stylesheet" href="/control/style.css"><link id="tabs-css" rel="stylesheet" href="/control/tabs/tabs.css"></head>' +
    '<body><main id="page" style="padding:16px"><div class="settings-page"><div id="settings-all"></div></div></main>' +
    '<script type="module">import { mountSettingsAll } from "/control/tabs/settings-all.js"; window.ready = mountSettingsAll(document.getElementById("settings-all"), { documentId: new URLSearchParams(location.search).get("doc") || "" });</script></body></html>';

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    if (url.pathname === '/harness.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page);
      return;
    }
    if (url.pathname.startsWith('/control/api/')) {
      const found = router.match(req.method, url.pathname.replace('/control/api', ''));
      if (!found) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"Not found."}'); return; }
      req.params = found.params;
      Promise.resolve(found.handler(req, res)).catch(error => { res.writeHead(500); res.end(String(error && error.stack)); });
      return;
    }
    const file = path.join(staticFolder, url.pathname.replace(/^\/control\//, ''));
    if (!file.startsWith(staticFolder) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

  return {
    url: 'http://127.0.0.1:' + server.address().port,
    sanity: sanity,
    ctx: ctx,
    close: async () => {
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(root, { recursive: true, force: true });
    },
  };
}
