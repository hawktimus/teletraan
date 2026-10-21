// The temporary pushes of the Display tab: a theme, a view, a panel, an announcement, a hidden transition and a pause.
// Each one writes a field the wall already reads (dashboard/core/screen-requests.js, hidden.js, announce.js) and holds for
// 1 to 60 minutes, then the wall returns to its schedule by itself. The functions here are plain: they check what the page
// sent and build the Sanity mutations. routes/push.js sends them.
//
// The announcement is the thin bar under the banner (docs/announcements.md). It is one published document with a fixed id,
// replaced by each new push, so there is never more than one and nothing piles up. Ending it moves its end time to now.

import { Refusal } from './http.js';
import { hiddenKinds, noticeLongest, settingsId, themeIds, viewKeys } from './requests.js';

export const pushMinutes = { least: 1, most: 60, usual: 15, choices: [1, 5, 15, 30, 60] };
export const noticeId = 'push-notice';
export const pushKinds = ['theme', 'view', 'panel', 'pause', 'hidden', 'announcement'];
export const noticeLevels = ['notice', 'important'];
// A hidden transition is one shot. The page offers Cancel for this long after it was sent, and no longer.
export const hiddenWindowSeconds = 120;

const empty = {
  theme: { previewTheme: { theme: '', until: '' } },
  view: { showView: { key: '', until: '' } },
  panel: { holdPanel: { panel: '', until: '' } },
  pause: { pauseRotation: { until: '' } },
};

function stamp(now) {
  return new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function later(now, minutes) {
  return stamp(new Date(now).getTime() + minutes * 60000);
}

export function minutesOf(input) {
  const wanted = input === undefined || input === null || input === '' ? pushMinutes.usual : typeof input === 'boolean' ? NaN : Number(input);
  if (!Number.isInteger(wanted) || wanted < pushMinutes.least || wanted > pushMinutes.most) {
    throw new Refusal(400, 'Hold for a whole number of minutes from ' + pushMinutes.least + ' to ' + pushMinutes.most + '.');
  }
  return wanted;
}

export function noticeTextOf(input) {
  const text = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (text === '') throw new Refusal(400, 'Type the announcement first.');
  if (text.length > noticeLongest) throw new Refusal(400, 'An announcement is ' + noticeLongest + ' characters or fewer. This one has ' + text.length + '.');
  return text;
}

// What a push changes: { set } for a patch of Dashboard Settings, or { notice } for the announcement document.
// teamId is the _id of the Team document for an announcement, found by the route from the code in the body.
export function buildPush(kind, input, now = new Date(), teamId = '') {
  const body = input && typeof input === 'object' ? input : {};

  switch (kind) {
    case 'theme':
      if (!themeIds.includes(body.theme)) throw new Refusal(400, 'Pick one of the themes: ' + themeIds.join(', ') + '.');
      return { set: { previewTheme: { theme: body.theme, until: later(now, minutesOf(body.minutes)) } } };

    case 'view':
      if (!viewKeys.includes(body.key)) throw new Refusal(400, 'Pick one of the views: ' + viewKeys.join(', ') + '.');
      return { set: { showView: { key: body.key, until: later(now, minutesOf(body.minutes)) } } };

    case 'panel':
      if (typeof body.panel !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/.test(body.panel)) throw new Refusal(400, 'Pick a panel from the list.');
      return { set: { holdPanel: { panel: body.panel, until: later(now, minutesOf(body.minutes)) } } };

    case 'pause':
      return { set: { pauseRotation: { until: later(now, minutesOf(body.minutes)) } } };

    case 'hidden':
      if (!hiddenKinds.includes(body.transition)) throw new Refusal(400, 'Pick one of the hidden transitions: ' + hiddenKinds.join(', ') + '.');
      return { set: { hiddenRequest: { kind: body.transition, requestedAt: new Date(now).toISOString() } } };

    case 'announcement': {
      const text = noticeTextOf(body.text);
      const level = body.level === undefined || body.level === '' ? 'notice' : body.level;
      if (!noticeLevels.includes(level)) throw new Refusal(400, 'Pick notice or important.');
      const notice = { _id: noticeId, _type: 'announcement', text: text, start: stamp(now), end: later(now, minutesOf(body.minutes)), level: level };
      if (teamId) notice.team = { _type: 'reference', _ref: teamId };
      return { notice: notice };
    }

    default:
      throw new Refusal(400, 'The Teletraan computer does not know that push.');
  }
}

// Ends one push. The announcement needs the document to exist, which the route checks first.
export function buildCancel(kind, now = new Date()) {
  if (kind === 'hidden') return { unset: ['hiddenRequest'] };
  if (kind === 'announcement') return { endNotice: stamp(now) };
  if (!empty[kind]) throw new Refusal(400, 'The Teletraan computer does not know that push.');
  return { set: empty[kind] };
}

// Every push at once
export function buildReset() {
  return { set: Object.assign({}, empty.theme, empty.view, empty.panel, empty.pause), unset: ['hiddenRequest'] };
}

export function settingsMutations(change) {
  const patch = { id: settingsId };
  if (change.set) patch.set = change.set;
  if (change.unset) patch.unset = change.unset;
  return [{ patch: patch }];
}

export function noticeMutation(notice) {
  return { createOrReplace: notice };
}

export function endNoticeMutation(endAt) {
  return { patch: { id: noticeId, set: { end: endAt } } };
}

// The weekday name in the time zone of the Look page, as themeByWeekday spells it
export function weekdayOf(zone, now = new Date()) {
  const format = timeZone => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timeZone }).format(now).toLowerCase();
  try {
    return format(zone || 'America/New_York');
  } catch (error) {
    return format('America/New_York');
  }
}

// ----- what is pushed now -----

function running(until, now) {
  const end = Date.parse(until);
  return !isNaN(end) && end > new Date(now).getTime();
}

// The pushes that are running at this moment, in a fixed order: [{ kind, id, until }]. id is the theme, the view key, the
// panel id, the hidden kind or the announcement text.
export function pushesOf(settings, notice, now = new Date()) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const found = [];
  const theme = source.previewTheme;
  if (theme && theme.theme && running(theme.until, now)) found.push({ kind: 'theme', id: theme.theme, until: theme.until });
  const view = source.showView;
  if (view && view.key && running(view.until, now)) found.push({ kind: 'view', id: view.key, until: view.until });
  const panel = source.holdPanel;
  if (panel && panel.panel && running(panel.until, now)) found.push({ kind: 'panel', id: panel.panel, until: panel.until });
  const pause = source.pauseRotation;
  if (pause && running(pause.until, now)) found.push({ kind: 'pause', id: '', until: pause.until });
  if (notice && typeof notice.text === 'string' && running(notice.end, now) && Date.parse(notice.start) <= new Date(now).getTime()) {
    found.push({ kind: 'announcement', id: notice.text, until: notice.end, level: notice.level || 'notice', team: notice.team || '' });
  }
  const hidden = source.hiddenRequest;
  if (hidden && hiddenKinds.includes(hidden.kind) && !isNaN(Date.parse(hidden.requestedAt)) && new Date(now).getTime() - Date.parse(hidden.requestedAt) < hiddenWindowSeconds * 1000) {
    found.push({ kind: 'hidden', id: hidden.kind, until: '', sentAt: hidden.requestedAt });
  }
  return found;
}
