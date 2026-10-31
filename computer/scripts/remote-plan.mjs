// The decisions of the remote action poller (remote-poller.mjs), with no network and no system calls, so a test can
// run every case. What the poller does with a decision is in the poller.
//
// The only way an action from Sanity becomes a command is the tables below: the stored value must be exactly one of
// their names, and what runs is the fixed line next to it. The show actions take one value from a fixed list, and
// the poller writes that value and nothing else into the request fields of Dashboard Settings. No text from Sanity
// is ever passed on.

// The sources the helper word sync-now accepts (control-helper.sh), and only these are ever sent
export const helperSyncSources = Object.freeze(['calendars', 'monday', 'frc', 'news', 'photos-drive', 'match13']);

// The stored action for each source, in the order that sync_all runs them
const sourceOfAction = Object.freeze({
  sync_calendars: 'calendars',
  sync_monday: 'monday',
  sync_competition: 'frc',
  sync_news: 'news',
  sync_match13: 'match13',
  sync_photos: 'photos-drive',
});

// The fixed lines sent to the helper for each action that runs a command
export const linesOf = Object.freeze(Object.assign(
  {
    restart_dashboard: Object.freeze(['restart-kiosk']),
    restart_services: Object.freeze(['restart-services']),
    reboot_computer: Object.freeze(['reboot']),
    sync_all: Object.freeze(Object.values(sourceOfAction).map(source => 'sync-now ' + source)),
  },
  Object.fromEntries(Object.entries(sourceOfAction).map(([action, source]) => [action, Object.freeze(['sync-now ' + source])])),
));

// The helper word of each action that runs a command
export const wordOf = Object.freeze(Object.fromEntries(Object.entries(linesOf).map(([action, lines]) => [action, lines[0].split(' ')[0]])));

// The words a show action may carry, the same as dashboard/core/screen-requests.js and settingsRequests.js. auto
// clears the request, so the wall goes back to its schedule.
export const viewValues = Object.freeze(['general', 'prime', 'nova', 'family', 'auto']);
export const themeValues = Object.freeze(['original', 'cybertron', 'retro', 'foundry', 'auto']);

// The show actions and the field of the request that holds the word they need
export const showActions = Object.freeze({ show_view: 'view', show_theme: 'theme', pause_rotation: '', resume_rotation: '' });

// Every action that is allowed, for the schema and the tests
export const allowedActions = Object.freeze(Object.keys(wordOf).concat(Object.keys(showActions)));

// How long a view, a theme or a pause lasts if nobody ends it. The screen ends it by itself at that time.
export const showMinutes = 60;

// A request older than this is not run, so a computer that reconnects late never obeys an old click
export const freshMinutes = 10;
// A browser clock a little ahead of this computer is normal. More than this ahead is not believed.
export const clockSlackMinutes = 2;
// One reboot in this many minutes, however many requests come
export const rebootGapMinutes = 10;
// One sync of any kind in this many minutes
export const syncGapMinutes = 1;
// The delay between writing "handled" and asking for the reboot
export const rebootDelaySeconds = 5;

const minute = 60 * 1000;

// The time of an ISO text in milliseconds, or null when it is not a time
export function timeOf(text) {
  if (typeof text !== 'string' || text.length < 10 || text.length > 40) return null;
  const value = Date.parse(text);
  return Number.isNaN(value) ? null : value;
}

function endsAt(now, minutes) {
  return new Date(now + minutes * minute).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// The fields to set on Dashboard Settings for a show action, from the checked word. Nothing else is ever written.
export function settingsFieldsOf(action, value, now) {
  if (action === 'show_view') return { showView: value === 'auto' ? { key: '', until: '' } : { key: value, until: endsAt(now, showMinutes) } };
  if (action === 'show_theme') return { previewTheme: value === 'auto' ? { theme: '', until: '' } : { theme: value, until: endsAt(now, showMinutes) } };
  if (action === 'pause_rotation') return { pauseRotation: { until: endsAt(now, showMinutes) } };
  return { pauseRotation: { until: '' } };
}

// What to do with the remoteControl document. now is a number of milliseconds, lastRebootAt and lastSyncAt are ISO
// texts or null.
//   { kind: 'nothing' }                                 no request, or one that was handled already
//   { kind: 'skip', result, handledAt }                 mark it handled with this result and run nothing
//   { kind: 'run', action, word, lines, settingsFields, handledAt }
//       mark it handled, then send each line to the helper (lines), or write settingsFields to Dashboard Settings
export function decide(doc, now, lastRebootAt, lastSyncAt = null) {
  const requested = timeOf(doc && doc.requestedAt);
  if (requested === null || typeof doc.action !== 'string' || doc.action === '') return { kind: 'nothing' };

  // A request is new when it is later than the last one handled. With no last time, every request is new.
  const handled = timeOf(doc.lastHandledAt);
  if (handled !== null && requested <= handled) return { kind: 'nothing' };

  // The time written is never earlier than the request. A browser clock ahead of this one would otherwise make
  // the same request look new again at the next poll.
  const handledAt = new Date(Math.max(now, requested)).toISOString();
  const skip = result => ({ kind: 'skip', result: result, handledAt: handledAt });

  if (requested > now + clockSlackMinutes * minute) return skip('ignored: time is in the future');
  if (now - requested > freshMinutes * minute) return skip('ignored: too old');

  const action = doc.action;
  const isCommand = Object.hasOwn(linesOf, action);
  const isShow = Object.hasOwn(showActions, action);
  if (!isCommand && !isShow) return skip('refused: unknown action');

  if (isShow) {
    const field = showActions[action];
    let value = '';
    if (field !== '') {
      value = doc[field];
      const allowed = field === 'view' ? viewValues : themeValues;
      if (typeof value !== 'string' || !allowed.includes(value)) return skip('refused: unknown ' + field);
    }
    return { kind: 'run', action: action, word: null, lines: [], settingsFields: settingsFieldsOf(action, value, now), handledAt: handledAt };
  }

  const word = wordOf[action];
  if (word === 'reboot') {
    const lastReboot = timeOf(lastRebootAt);
    if (lastReboot !== null && now - lastReboot < rebootGapMinutes * minute) {
      return skip('ignored: a reboot already ran in the last ' + rebootGapMinutes + ' minutes');
    }
  }
  if (word === 'sync-now') {
    const lastSync = timeOf(lastSyncAt);
    if (lastSync !== null && now - lastSync < syncGapMinutes * minute) {
      return skip('ignored: a sync already ran in the last minute');
    }
  }
  return { kind: 'run', action: action, word: word, lines: linesOf[action].slice(), settingsFields: null, handledAt: handledAt };
}

// The first name of whoever asked, as plain letters. The field is typed text in a public dataset, so it is cut down.
export function firstNameOf(text) {
  if (typeof text !== 'string') return '';
  const word = text.trim().split(/\s+/)[0] || '';
  return word.replace(/[^\p{L}'-]/gu, '').slice(0, 30);
}

// A failure reason from the sync service, made safe for a public dataset: addresses, host names and long
// token-like strings are replaced, then the text is cut short.
export function safeReason(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/https?:\/\/\S+/gi, '[address]')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, '[address]')
    .replace(/\b[a-z0-9-]+(\.[a-z0-9-]+)+\b/gi, '[host]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[removed]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function timeOrNull(text) {
  const value = timeOf(text);
  return value === null ? null : new Date(value).toISOString();
}

// The sources of sync-status.json as a list for the status document. Names are plain words only.
export function sourcesOf(file) {
  const sources = file && typeof file === 'object' && file.sources && typeof file.sources === 'object' ? file.sources : {};
  return Object.keys(sources)
    .filter(name => /^[a-z0-9_-]{1,40}$/i.test(name) && sources[name] && typeof sources[name] === 'object')
    .sort()
    .map(name => ({
      _key: name,
      name: name,
      lastSuccessAt: timeOrNull(sources[name].lastSuccessAt),
      lastFailureAt: timeOrNull(sources[name].lastFailureAt),
      lastFailureReason: safeReason(sources[name].lastFailureReason),
    }));
}

const netwatchActions = ['none', 'restart_network', 'bounce_interface', 'reboot'];

// netwatch.json as the fields of the status document, or null when the file is missing or not an object
export function netwatchOf(file) {
  if (!file || typeof file !== 'object' || Array.isArray(file)) return null;
  return {
    failures: Number.isInteger(file.failures) && file.failures >= 0 ? file.failures : 0,
    lastCheckAt: timeOrNull(file.lastCheckAt),
    lastOkAt: timeOrNull(file.lastOkAt),
    lastAction: netwatchActions.includes(file.lastAction) ? file.lastAction : 'none',
    lastActionAt: timeOrNull(file.lastActionAt),
    lastRebootAt: timeOrNull(file.lastRebootAt),
  };
}

// The network state of sync-status.json ({ ok, since }) for the status document, or null when it is not there
export function networkOf(syncFile) {
  const network = syncFile && typeof syncFile === 'object' ? syncFile.network : null;
  if (!network || typeof network !== 'object' || typeof network.ok !== 'boolean') return null;
  return { ok: network.ok, since: timeOrNull(network.since) };
}

// The read only status document. The poller adds updatedAt and checkedAt when it writes.
export function statusOf(syncFile, netwatchFile, lastRequest) {
  const status = { _id: 'remote-status', _type: 'remoteStatus', sources: sourcesOf(syncFile) };
  const network = networkOf(syncFile);
  if (network) status.network = network;
  const netwatch = netwatchOf(netwatchFile);
  if (netwatch) status.netwatch = netwatch;
  if (lastRequest) status.lastRequest = lastRequest;
  return status;
}

// The line the Control page shows as the last result, from the request the poller just answered
export function lastRecordOf(doc, handledAt, result) {
  const known = doc && typeof doc.action === 'string' && (Object.hasOwn(linesOf, doc.action) || Object.hasOwn(showActions, doc.action));
  return { action: known ? doc.action : 'unknown', requestedBy: firstNameOf(doc && doc.requestedBy), handledAt: handledAt, result: String(result || '').slice(0, 120), via: 'sanity' };
}

// The status document is written when it changed or when this many minutes passed since the last write
export const statusEveryMinutes = 5;

// written is { at, text } for the last write, or null. status is compared without its updatedAt.
export function statusDue(status, written, now) {
  if (!written) return true;
  if (now - written.at >= statusEveryMinutes * minute) return true;
  return JSON.stringify(status) !== written.text;
}
