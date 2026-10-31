// The plain words of the control page: times, the names of the sources and the one short sentence for each known
// failure (docs/control-page-inventory.md, "Plain-language messages"). The raw reason is never put in a sentence here.
// It is kept in the problem as `raw` and shown only in a Show details drawer and in the Details area.
// No page is needed, so Node can try every function.

export const sourceNames = {
  sanity: 'Sanity',
  monday: 'Monday',
  band: 'Band',
  calendars: 'Calendars',
  frc: 'Competition data',
  competition: 'Competition data',
  news: 'FRC news',
  match13: 'Match13',
  'photos-drive': 'Drive photos',
  network: 'The network',
  screen: 'The screen',
  weather: 'Weather',
  images: 'Pictures',
};

export function nameOf(source) {
  return sourceNames[source] || String(source || 'This source');
}

function asDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "3:12 PM"
export function clockWords(value) {
  const date = asDate(value);
  return date ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
}

// "just now", "20 min ago", "3 hours ago", "2 days ago"
export function agoWords(value, now = new Date()) {
  const date = asDate(value);
  if (!date) return '';
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + ' min ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hours / 24);
  return days + (days === 1 ? ' day ago' : ' days ago');
}

// "3:12 PM, 20 min ago". A time that is not today starts with the day: "Oct 30, 3:12 PM, 1 day ago". Empty when there is none.
export function whenWords(value, now = new Date()) {
  const date = asDate(value);
  if (!date) return '';
  const sameDay = date.toDateString() === now.toDateString();
  const day = sameDay ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ';
  return day + clockWords(date) + ', ' + agoWords(date, now);
}

// ----- failures -----

const patterns = {
  notInstalled: /not found|not loaded|no such file|is masked|does not exist|could not be found|not installed/i,
  expired: /\b(401|403|404|410)\b|expired|forbidden|unauthori[sz]ed|not authori[sz]ed|denied|server said no|gone|no longer/i,
  unreachable: /secure connection|ssl|tls|certificate|handshake|unreachable|resolve|enotfound|econn|etimedout|refused|reset by|network is down|could not connect|connection/i,
  timeout: /timed out|timeout|took too long|signal 15|exit(ed)? (code )?124/i,
};

// What kind of failure a raw reason is: notInstalled, expired, unreachable, timeout or other
export function classify(reason) {
  const text = String(reason || '');
  // An address that answers "404 not found" is a dead link, not a service that was never installed
  if (/\b(401|403|404|410)\b/.test(text)) return 'expired';
  if (patterns.notInstalled.test(text)) return 'notInstalled';
  if (patterns.unreachable.test(text)) return 'unreachable';
  if (patterns.expired.test(text)) return 'expired';
  if (patterns.timeout.test(text)) return 'timeout';
  return 'other';
}

// One problem as the page shows it. input:
//   source      a key of sourceNames
//   reason      the raw reason, kept for the drawer
//   lastGoodAt  when the source last worked, or empty
//   networkDown true when the computer has no internet (then a connection failure is the network's)
// Gives { source, kind, message, still, fixes, where, raw }. A fix is { id, label } and the page decides how to run it:
//   sync        sync this source again
//   network     run the network check
//   exclude     take this source out of Sync all
//   keys        open Update, Keys
//   details     open the Details area
export function plainProblem(input, now = new Date()) {
  const source = input.source;
  const name = nameOf(source);
  const calendar = source === 'calendars' || source === 'band';
  const kind = input.networkDown ? 'network' : classify(input.reason);
  const good = clockWords(input.lastGoodAt);
  const still = good ? 'The TV is still showing the copy from ' + good + '.' : 'The TV is showing what it saved earlier.';
  const base = { source: source, kind: kind, still: still, raw: String(input.reason || ''), where: '' };

  if (kind === 'network') {
    return Object.assign(base, {
      message: "The computer can't reach the internet. The screen shows saved data.",
      still: 'The TV is showing saved data. The computer checks the network every 2 minutes and repairs it by itself.',
      fixes: [{ id: 'network', label: 'Run network check' }, { id: 'details', label: 'Show details' }],
    });
  }
  if (kind === 'notInstalled') {
    return Object.assign(base, {
      message: name + " isn't set up on this computer, so it was skipped.",
      still: 'Nothing on the TV changed.',
      fixes: [{ id: 'exclude', label: 'Remove from Sync all' }],
    });
  }
  if (kind === 'expired') {
    return Object.assign(base, {
      message: calendar ? 'A calendar link may have expired. Replace it in the settings file.' : name + ' refused the request. Its key may have expired. Replace it in the settings file.',
      where: 'Update, Keys',
      fixes: [{ id: 'keys', label: 'Open Keys' }],
    });
  }
  if (kind === 'unreachable') {
    return Object.assign(base, {
      message: calendar ? "Calendars didn't update. The last good copy" + (good ? ' from ' + good : '') + ' is still showing.' : name + " didn't update. The last good copy is still showing.",
      fixes: [{ id: 'sync', label: calendar ? 'Sync calendars now' : 'Sync ' + name + ' now' }, { id: 'network', label: 'Run network check' }],
    });
  }
  if (kind === 'timeout') {
    return Object.assign(base, { message: name + ' took too long and was stopped.', fixes: [{ id: 'sync', label: 'Try again' }] });
  }
  return Object.assign(base, { message: name + " didn't finish.", fixes: [{ id: 'sync', label: 'Try again' }, { id: 'details', label: 'Show details' }] });
}

// "Try again in 59 minutes" or "Try again in 40 seconds", for the sign-in screen after repeated wrong PINs
export function waitWords(seconds) {
  if (seconds >= 90) return 'Try again in ' + Math.ceil(seconds / 60) + ' minutes.';
  return 'Try again in ' + seconds + ' seconds.';
}

// A result line after an action: "Done at 3:12 PM" or "Didn't finish: <reason>"
export function doneWords(at) {
  return 'Done at ' + clockWords(at);
}

// Command text never goes on a primary screen: a reason that has some is replaced by a sentence, and the text stays in Details
export function plainReason(reason) {
  const text = String(reason || '').replace(/\s+/g, ' ').trim();
  if (/systemctl|journalctl|exit (status|code)|\bsudo\b|\bunit\b.*\.service|\.service\b|stderr|traceback|\bat \S+\.m?js:\d+/i.test(text)) return 'the computer could not do that. The technical text is in Details.';
  return text.slice(0, 160);
}

export function failedWords(reason) {
  const text = String(reason || '').replace(/\s+/g, ' ').trim();
  return "Didn't finish" + (text ? ': ' + text : '.');
}
