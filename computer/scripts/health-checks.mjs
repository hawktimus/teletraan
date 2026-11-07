// The health checks, as plain functions. health.sh (started by teletraan-health.timer every minute) reads the facts off
// this computer and hands them here; this file decides which checks pass and since when. The supervisor
// (supervisor-plan.mjs) reads nothing else, so what counts as a problem is written down once, here.
//
// Every check gives { ok, since, detail }. since is when it last changed, so the supervisor can tell a problem that
// started a minute ago from one that has been failing for half an hour. A check whose facts are missing is left out
// rather than failed: a computer that cannot be asked is not the same as a computer that is broken.
//
//   node health-checks.mjs <readings.json> <previous-health.json>   prints the health file, as JSON

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// The lines a check is drawn at. Changing one of these changes when the computer starts fixing itself.
export const thresholds = {
  frameSeconds: 60, // no painted frame for this long means the screen has stopped drawing
  pageSeconds: 180, // the page heartbeat, the same limit watchdog.sh uses
  stuckMinutes: 15, // the same picture for this long while the rotation is on
  flatShare: 0.9, // or this much of the picture one flat colour
  sourceTimes: 3, // a source is late after three times its own interval
  restartsIn10Minutes: 3, // more than this means a service is restart looping
  chromiumRssKb: 1536 * 1024, // 1.5 GB
  diskFreeShare: 0.1,
  tempC: 80,
};

// How often each source is expected to be read, in minutes. Monday's is a setting, so it is passed in.
export const sourceMinutes = { sanity: 5, calendars: 15, monday: 30, competition: 5 };

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function number(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// A check keeps the time it last changed. previous is the health file of the run before.
function keep(previous, name, ok, detail, nowMs) {
  const before = record(record(previous).checks)[name];
  const sameAsBefore = before && before.ok === ok;
  const since = sameAsBefore ? (Date.parse(before.since) || nowMs) : nowMs;
  return { ok: ok, since: new Date(since).toISOString(), detail: detail };
}

// readings is what health.sh gathered. Every member is optional; a check whose facts are not there is left out.
export function buildHealth(readings, previous, nowMs = Date.now()) {
  const r = record(readings);
  const checks = {};
  const add = (name, ok, detail) => { checks[name] = keep(previous, name, ok, detail, nowMs); };

  // ----- the screen -----

  // The page says when it last painted (page-command.py frames). A page that cannot be asked at all is the worst case
  // of the same thing: the browser is there but its JavaScript is not running, so no frame is being painted either.
  const frameAge = number(r.frameAgeSeconds);
  if (frameAge !== null) {
    add('frames', frameAge <= thresholds.frameSeconds,
      frameAge <= thresholds.frameSeconds ? 'the last frame was ' + frameAge + ' seconds ago' : 'no frame has been painted for ' + frameAge + ' seconds');
  } else if (r.framesFresh === false) {
    add('frames', false, typeof r.framesDetail === 'string' && r.framesDetail !== '' ? r.framesDetail : 'the page did not say when it last painted');
  }

  const pageAge = number(r.pageAgeSeconds);
  if (r.pageAnswers === false) {
    add('page', false, 'the page did not answer on this computer');
  } else if (pageAge !== null) {
    add('page', pageAge <= thresholds.pageSeconds,
      pageAge <= thresholds.pageSeconds ? 'the page last wrote ' + pageAge + ' seconds ago' : 'the page has not written for ' + pageAge + ' seconds');
  }

  if (typeof r.displayMode === 'string' && typeof r.displayWanted === 'string' && r.displayWanted !== '') {
    const connected = r.displayConnected !== false;
    const atMode = connected && r.displayMode === r.displayWanted;
    add('display', atMode,
      !connected ? 'no screen is connected' : atMode ? 'the screen is at ' + r.displayMode : 'the screen is at ' + (r.displayMode || 'an unknown mode') + ' and should be at ' + r.displayWanted);
  }

  const sameMinutes = number(r.pictureSameMinutes);
  const flat = number(r.pictureFlatShare);
  if ((sameMinutes !== null || flat !== null) && r.rotationOn !== false) {
    const stuck = (sameMinutes !== null && sameMinutes >= thresholds.stuckMinutes) || (flat !== null && flat >= thresholds.flatShare);
    const detail = sameMinutes !== null && sameMinutes >= thresholds.stuckMinutes
      ? 'the picture has not changed for ' + sameMinutes + ' minutes'
      : flat !== null && flat >= thresholds.flatShare
        ? Math.round(flat * 100) + ' per cent of the picture is one colour'
        : 'the picture is changing';
    add('screenStuck', !stuck, detail);
  }

  // ----- the network and the sources -----

  if (typeof r.networkOk === 'boolean') add('network', r.networkOk, r.networkOk ? 'the network works' : 'the network is down');
  if (typeof r.dnsOk === 'boolean') add('dns', r.dnsOk, r.dnsOk ? 'names are looked up' : 'names cannot be looked up');

  const ages = record(r.sourceAgeSeconds);
  Object.keys(sourceMinutes).forEach(name => {
    const age = number(ages[name]);
    if (age === null) return;
    const every = name === 'monday' && number(r.mondayEveryMinutes) !== null ? number(r.mondayEveryMinutes) : sourceMinutes[name];
    const limit = every * thresholds.sourceTimes * 60;
    add(name, age <= limit, age <= limit ? 'read ' + Math.round(age / 60) + ' minutes ago' : 'not read for ' + Math.round(age / 60) + ' minutes');
  });

  // ----- the services -----

  const services = Array.isArray(r.services) ? r.services.map(record) : [];
  if (services.length > 0) {
    const stopped = services.filter(item => item.active === false).map(item => String(item.name || ''));
    const looping = services.filter(item => number(item.restarts) !== null && number(item.restarts) > thresholds.restartsIn10Minutes).map(item => String(item.name || ''));
    const bad = stopped.concat(looping);
    add('services', bad.length === 0,
      bad.length === 0 ? 'every service is running' : looping.length > 0 ? looping[0] + ' has restarted ' + services.find(item => item.name === looping[0]).restarts + ' times in ten minutes' : stopped[0] + ' is not running');
  }

  // ----- what the computer has left -----

  const rss = number(r.chromiumRssKb);
  if (rss !== null) {
    add('memory', rss <= thresholds.chromiumRssKb, 'the browser is using ' + Math.round(rss / 1024) + ' MB');
  }

  const freeShare = number(r.diskFreeShare);
  if (freeShare !== null) {
    add('disk', freeShare >= thresholds.diskFreeShare, Math.round(freeShare * 100) + ' per cent of the disk is free');
  }

  if (typeof r.clockSynced === 'boolean') {
    add('clock', r.clockSynced, r.clockSynced ? 'the clock is set from the network' : 'the clock is not set from the network');
  }

  // Facts that are worth reporting but are never a problem the supervisor acts on
  const extra = {};
  if (number(r.tempC) !== null) extra.temperatureC = number(r.tempC);
  if (typeof r.throttled === 'string' && r.throttled !== '') extra.throttled = r.throttled;
  if (number(r.memAvailableKb) !== null) extra.memAvailableKb = number(r.memAvailableKb);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    bootId: typeof r.bootId === 'string' ? r.bootId : '',
    uptimeSeconds: number(r.uptimeSeconds) === null ? 0 : Math.round(number(r.uptimeSeconds)),
    checks: checks,
    facts: extra,
  };
}

// Which checks are failing, worst first: the screen before the sources, because a dark wall is what people see.
export const order = ['frames', 'page', 'display', 'screenStuck', 'network', 'dns', 'services', 'memory', 'disk', 'sanity', 'calendars', 'monday', 'competition', 'clock'];

export function failing(health) {
  const checks = record(record(health).checks);
  return order.filter(name => checks[name] && checks[name].ok === false);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const readings = readJson(process.argv[2]);
  if (!readings) {
    console.error('health-checks: the readings file could not be read.');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(buildHealth(readings, readJson(process.argv[3]), Number(readings.nowMs) || Date.now()), null, 2) + '\n');
}
