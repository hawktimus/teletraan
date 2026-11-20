// What the Now area needs in one call, so the page can ask every 10 seconds without five requests:
//
//   GET /control/api/overview      { at, status, syncStatus, netwatch, remoteLast, wall }
//   GET /control/api/remote-last   the last action handled from the Studio (remote-last.json), or { present: false }
//
// Every part is read from a file or from a call that already exists, and a part that is missing is null, never an error:
// the sync service writes sync-status.json (its network member is optional), the network watchdog writes netwatch.json
// (the control container may not see it; the status helper then carries the same facts in status.network), and the
// remote poller writes remote-last.json. Nothing here changes anything.

import fs from 'node:fs';
import path from 'node:path';
import { mount, send } from '../support/http.js';
import { gather } from './status.js';
import { quietSeconds } from './now.js';
import { namesFor } from '../support/names.js';

const keepStatusSeconds = 8;

function readJsonFile(file) {
  try {
    const found = JSON.parse(fs.readFileSync(file, 'utf8'));
    return found && typeof found === 'object' && !Array.isArray(found) ? found : null;
  } catch (error) {
    return null;
  }
}

function text(value, longest = 300) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, longest) : '';
}

function count(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Only the fields the page uses are passed on, cut to size, so a file with other content can not put it on the page
export function cleanSyncStatus(raw) {
  if (!raw) return null;
  const sources = {};
  const found = raw.sources && typeof raw.sources === 'object' ? raw.sources : {};
  Object.keys(found).slice(0, 20).forEach(name => {
    const one = found[name] && typeof found[name] === 'object' ? found[name] : {};
    sources[text(name, 30)] = { lastSuccessAt: text(one.lastSuccessAt, 40) || null, lastFailureAt: text(one.lastFailureAt, 40) || null, lastFailureReason: text(one.lastFailureReason) };
  });
  const network = raw.network && typeof raw.network === 'object' ? { ok: raw.network.ok === true, since: text(raw.network.since, 40) || null } : null;
  return { generatedAt: text(raw.generatedAt, 40) || null, sources: sources, network: network };
}

// What netwatch.sh wrote about the name servers (dns.json): the servers that are configured, whether they are the ones in
// use or the network's own are in use for the time being, and why. Nothing else of the file is passed on.
export function cleanDns(raw) {
  if (!raw || typeof raw !== 'object') return { present: false };
  return {
    present: true,
    enforce: raw.enforce === 'no' ? 'no' : 'yes',
    configured: text(raw.configured, 40),
    mode: raw.mode === 'network' ? 'network' : 'configured',
    since: text(raw.since, 40) || null,
    reason: text(raw.reason, 160),
  };
}

// data-problems.json from the sync service (computer/scripts/ingest-validate.mjs): what was repaired or left as it is in the
// last read, by source. The page lists the first rows of each source; the count is the whole number.
export function cleanProblems(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.count !== 'number') return { present: false, count: 0, sources: {} };
  const sources = {};
  const found = raw.sources && typeof raw.sources === 'object' ? raw.sources : {};
  Object.keys(found).slice(0, 10).forEach(name => {
    const group = found[name] || {};
    const items = (Array.isArray(group.items) ? group.items : []).slice(0, 20).map(item => ({ where: text(item && item.where, 120), what: text(item && item.what, 160), action: text(item && item.action, 120) }));
    sources[text(name, 20)] = { count: count(group.count), items: items };
  });
  return { present: true, count: count(raw.count), generatedAt: text(raw.generatedAt, 40) || null, sources: sources };
}

export function cleanNetwatch(raw) {
  if (!raw) return null;
  return {
    failures: count(raw.failures),
    lastCheckAt: text(raw.lastCheckAt, 40) || null,
    lastOkAt: text(raw.lastOkAt, 40) || null,
    lastAction: text(raw.lastAction, 30) || null,
    lastActionAt: text(raw.lastActionAt, 40) || null,
    lastRebootAt: text(raw.lastRebootAt, 40) || null,
  };
}

// What the health timer and the supervisor wrote, cut down to what the page shows: the one sentence, whether it is
// allowed to act, and the checks that are failing with the plain detail of each. The page never shows the whole file.
export function cleanHealth(health, supervisor) {
  const checks = health && typeof health.checks === 'object' && health.checks ? health.checks : null;
  if (!checks) return { present: false, words: '', mode: '', failing: [], frames: null };

  const failing = Object.keys(checks)
    .filter(name => checks[name] && checks[name].ok === false)
    .slice(0, 12)
    .map(name => ({ id: text(name, 30), detail: text(checks[name].detail, 120), since: text(checks[name].since, 40) || null }));
  const frames = checks.frames && typeof checks.frames.ok === 'boolean' ? checks.frames.ok : null;
  const said = supervisor && typeof supervisor === 'object' ? supervisor : {};

  return {
    present: true,
    at: text(health.generatedAt, 40) || null,
    words: text(said.words, 140),
    mode: said.mode === 'fix' ? 'fix' : 'watch',
    firstDay: said.firstDay === 'yes',
    failing: failing,
    // Whether the screen is painting, which is the one fact that decides the Screen dot
    frames: frames,
  };
}

export function cleanRemoteLast(raw) {
  if (!raw) return { present: false };
  return { present: true, action: text(raw.action, 60), requestedBy: text(raw.requestedBy, 40), handledAt: text(raw.handledAt, 40) || null, result: text(raw.result, 200), via: text(raw.via, 20) || 'sanity' };
}

function wallFacts(ctx, now) {
  const seen = ctx.state && ctx.state.wallSeen;
  if (!seen || !seen.received) return { reporting: false, ageSeconds: null, quiet: true, loadReason: '', showing: null };
  const age = Math.max(0, Math.round((now.getTime() - seen.received.getTime()) / 1000));
  const report = seen.report || {};
  const names = namesFor(report);
  // What the TV shows, in words, for the line on Now: the view, the theme, the panel and whether the rotation is paused
  const showing = {
    view: names.views[report.view] || '', theme: names.themes[report.theme] || '', panel: names.panels[report.panel] || report.panel || '',
    paused: report.pause === true, hold: text(report.hold, 60), build: text(report.build, 40),
  };
  return { reporting: true, ageSeconds: age, quiet: age > quietSeconds, loadReason: text(report.loadReason, 80), loads: count(report.loads), showing: showing };
}

export function register(router, ctx) {
  const netwatchFile = () => ctx.netwatchFile || path.join(path.dirname(ctx.dataDir || '.'), 'netwatch.json');
  // The health file and the supervisor's own answer sit beside netwatch.json, in the state folder the container reads
  // only (computer/docker-compose.yml). A missing file means the health timer is not installed, and the page says so.
  const stateFile = name => (ctx.stateDir ? path.join(ctx.stateDir, name) : path.join(path.dirname(netwatchFile()), name));

  // The status call asks the helper and Sanity, so one answer is kept for a few seconds and shared by every open page
  async function statusNow(now) {
    const kept = ctx.state && ctx.state.overviewStatus;
    if (kept && now.getTime() - kept.at < keepStatusSeconds * 1000) return kept.value;
    const value = await gather(ctx);
    if (ctx.state) ctx.state.overviewStatus = { at: now.getTime(), value: value };
    return value;
  }

  mount(router, ctx, 'GET', '/overview', async (req, res) => {
    const now = new Date();
    send(res, 200, {
      at: now.toISOString(),
      status: await statusNow(now),
      syncStatus: cleanSyncStatus(readJsonFile(path.join(ctx.dataDir, 'sync-status.json'))),
      netwatch: cleanNetwatch(readJsonFile(netwatchFile())),
      dns: cleanDns(readJsonFile(stateFile('dns.json'))),
      dataProblems: cleanProblems(readJsonFile(path.join(ctx.dataDir, 'data-problems.json'))),
      health: cleanHealth(readJsonFile(stateFile('health.json')), readJsonFile(stateFile('supervisor.json'))),
      buildVersion: typeof ctx.buildVersion === 'string' ? ctx.buildVersion : '',
      remoteLast: cleanRemoteLast(readJsonFile(path.join(ctx.dataDir, 'remote-last.json'))),
      wall: wallFacts(ctx, now),
      // So that the Screen dot can say not known, not late, in the first seconds after this service starts
      serviceUptimeSeconds: Math.round(process.uptime()),
    });
  });

  mount(router, ctx, 'GET', '/remote-last', async (req, res) => {
    send(res, 200, cleanRemoteLast(readJsonFile(path.join(ctx.dataDir, 'remote-last.json'))));
  });
}
