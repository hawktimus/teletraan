// The pieces of GET status that need no network or disk, so they can be tried alone. The routes
// (routes/status.js) gather the facts and hand them here.

import { dotStates } from '../../dashboard/core/dots.js';

// One question to Sanity for everything the Status tab needs from the dataset
export const statusQuery = '{ "mini": *[_id == "status-mini"][0], ' +
  '"monday": *[_id == "monday-status"][0] { lastSyncAt, lastError, callsToday, callsDate }, ' +
  '"settings": *[_id == "dashboardSettings"][0] { mondayEveryMinutes }, ' +
  '"calendarErrors": count(*[_id == "calendar-status"][0].calendars[defined(error)]) }';

function text(value, longest = 200) {
  return typeof value === 'string' ? value.trim().slice(0, longest) : '';
}

function number(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// The first line of text that starts with a label, such as "display: output HDMI-1, mode ..."
export function lineStarting(hostText, label) {
  const found = String(hostText || '').split('\n').find(line => line.startsWith(label + ':'));
  return found ? found.slice(label.length + 1).trim().slice(0, 300) : '';
}

// facts is what the route could find out. A part that could not be read is null and shows as
// not known, never as a guess.
//   releases      the kept releases, newest first: [{ number, ... }]
//   current       the number of the release that runs
//   host          what the helper's status word printed
//   sanity        { ok, error }  whether the dataset could be read just now
//   data          the answer of statusQuery, or null
//   cors          the result of the CORS check, or null
//   disk          { freeBytes, totalBytes }, or null
//   tailscale     the address, or ''
export function buildStatus(facts, now = new Date()) {
  const f = facts || {};
  const data = f.data || {};
  const mini = data.mini || {};
  const monday = data.monday || {};
  const sanity = f.sanity || { ok: false, error: 'not asked' };
  const releases = Array.isArray(f.releases) ? f.releases : [];
  const calendarErrors = number(data.calendarErrors) || 0;

  const dots = dotStates({
    monday: { lastSyncAt: monday.lastSyncAt, lastError: monday.lastError },
    everyMinutes: data.settings ? data.settings.mondayEveryMinutes : undefined,
    calendarAt: mini.lastCalendarSyncAt,
    calendarErrors: calendarErrors,
    sanityAt: sanity.ok ? now : null,
    sanityFailed: !sanity.ok,
  }, now);

  return {
    at: now.toISOString(),
    versions: {
      current: f.current === undefined ? null : f.current,
      previous: releases.map(release => release.number).filter(value => value !== f.current),
    },
    kiosk: lineStarting(f.host, 'kiosk'),
    display: lineStarting(f.host, 'display'),
    mini: {
      content: text(mini.lastContentSeenAt),
      calendars: text(mini.lastCalendarSyncAt),
      slides: text(mini.lastSlidesFetchAt),
      monday: text(mini.lastMondaySyncAt),
      frc: text(mini.lastFrcSyncAt),
      match13: text(mini.match13At),
      screenStarted: text(mini.kioskStartedAt),
    },
    mondayCallsToday: number(monday.callsToday),
    mondayCallsDate: text(monday.callsDate, 10),
    lastBackupAt: text(mini.lastBackupAt),
    kioskRestarts: number(mini.kioskRestarts),
    lastKioskRestartAt: text(mini.lastKioskRestartAt),
    sanity: { reachable: Boolean(sanity.ok), error: sanity.ok ? '' : text(sanity.error) },
    cors: f.cors || null,
    disk: f.disk || null,
    tailscale: text(f.tailscale, 60),
    dots: dots,
  };
}

// The tail of a log: the last n lines of the text, without a final empty line
export function lastLines(logText, n = 200) {
  const lines = String(logText || '').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-n);
}
