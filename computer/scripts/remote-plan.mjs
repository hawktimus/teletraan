// The decisions of the remote action poller (remote-poller.mjs), with no network and no system calls, so a test can
// run every case. What the poller does with a decision is in the poller.
//
// The only way an action from Sanity becomes a command is the table below: the stored value must be exactly one of
// its three names, and what runs is the fixed word next to it. No text from Sanity is ever passed on.

export const wordOf = Object.freeze({
  restart_dashboard: 'restart-kiosk',
  restart_services: 'restart-services',
  reboot_computer: 'reboot',
});

// A request older than this is not run, so a computer that reconnects late never obeys an old click
export const freshMinutes = 10;
// A browser clock a little ahead of this computer is normal. More than this ahead is not believed.
export const clockSlackMinutes = 2;
// One reboot in this many minutes, however many requests come
export const rebootGapMinutes = 10;
// The delay between writing "handled" and asking for the reboot
export const rebootDelaySeconds = 5;

const minute = 60 * 1000;

// The time of an ISO text in milliseconds, or null when it is not a time
export function timeOf(text) {
  if (typeof text !== 'string' || text.length < 10 || text.length > 40) return null;
  const value = Date.parse(text);
  return Number.isNaN(value) ? null : value;
}

// What to do with the remoteControl document. now is a number of milliseconds, lastRebootAt an ISO text or null.
//   { kind: 'nothing' }                                 no request, or one that was handled already
//   { kind: 'skip', result, handledAt }                 mark it handled with this result and run nothing
//   { kind: 'run', action, word, handledAt }            mark it handled, then send word to the helper
export function decide(doc, now, lastRebootAt) {
  const requested = timeOf(doc && doc.requestedAt);
  if (requested === null || typeof doc.action !== 'string' || doc.action === '') return { kind: 'nothing' };

  // A request is new when it is later than the last one handled. With no last time, every request is new.
  const handled = timeOf(doc.lastHandledAt);
  if (handled !== null && requested <= handled) return { kind: 'nothing' };

  // The time written is never earlier than the request. A browser clock ahead of this one would otherwise make
  // the same request look new again at the next poll.
  const handledAt = new Date(Math.max(now, requested)).toISOString();

  if (requested > now + clockSlackMinutes * minute) return { kind: 'skip', result: 'ignored: time is in the future', handledAt: handledAt };
  if (now - requested > freshMinutes * minute) return { kind: 'skip', result: 'ignored: too old', handledAt: handledAt };

  const word = Object.hasOwn(wordOf, doc.action) ? wordOf[doc.action] : null;
  if (word === null) return { kind: 'skip', result: 'refused: unknown action', handledAt: handledAt };

  if (word === 'reboot') {
    const lastReboot = timeOf(lastRebootAt);
    if (lastReboot !== null && now - lastReboot < rebootGapMinutes * minute) {
      return { kind: 'skip', result: 'ignored: a reboot already ran in the last ' + rebootGapMinutes + ' minutes', handledAt: handledAt };
    }
  }
  return { kind: 'run', action: doc.action, word: word, handledAt: handledAt };
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

// The read only status document. The poller adds updatedAt when it writes.
export function statusOf(syncFile, netwatchFile, lastRequest) {
  const status = { _id: 'remote-status', _type: 'remoteStatus', sources: sourcesOf(syncFile) };
  const netwatch = netwatchOf(netwatchFile);
  if (netwatch) status.netwatch = netwatch;
  if (lastRequest) status.lastRequest = lastRequest;
  return status;
}

// The status document is written when it changed or when this many minutes passed since the last write
export const statusEveryMinutes = 5;

// written is { at, text } for the last write, or null. status is compared without its updatedAt.
export function statusDue(status, written, now) {
  if (!written) return true;
  if (now - written.at >= statusEveryMinutes * minute) return true;
  return JSON.stringify(status) !== written.text;
}
