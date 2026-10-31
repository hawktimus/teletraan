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
      remoteLast: cleanRemoteLast(readJsonFile(path.join(ctx.dataDir, 'remote-last.json'))),
      wall: wallFacts(ctx, now),
    });
  });

  mount(router, ctx, 'GET', '/remote-last', async (req, res) => {
    send(res, 200, cleanRemoteLast(readJsonFile(path.join(ctx.dataDir, 'remote-last.json'))));
  });
}
