// What the Now area says, worked out from the answer of GET overview: the banner, the five dots and the Attention list, and
// the line for each source of the Update area. It draws nothing, so Node can try it. Anything the computer did not tell
// is "unknown", never a guess, and a missing part (no sync-status.json yet, no network member) is left out quietly.

import { clockWords, nameOf, plainProblem, whenWords } from './words.js';

export const dotOrder = ['sanity', 'monday', 'band', 'network', 'screen'];
export const dotLabels = { sanity: 'Sanity', monday: 'Monday', band: 'Band', network: 'Network', screen: 'Screen' };

// The six syncs and where their last good time lives. The order is the order Sync all runs them in.
export const syncSources = [
  { target: 'calendars', miniKey: 'calendars', stateKey: 'calendars' },
  { target: 'monday', miniKey: 'monday', stateKey: 'monday' },
  { target: 'frc', miniKey: 'frc', stateKey: 'competition' },
  { target: 'news', miniKey: 'news', stateKey: '' },
  { target: 'match13', miniKey: 'match13', stateKey: '' },
  { target: 'photos-drive', miniKey: 'photos', stateKey: '' },
];

const colorToState = { green: 'ok', amber: 'warn', red: 'bad' };

function later(a, b) {
  return Boolean(a) && (!b || Date.parse(a) > Date.parse(b));
}

function sourceOf(overview, key) {
  const sync = overview && overview.syncStatus;
  return sync && sync.sources && sync.sources[key] ? sync.sources[key] : null;
}

// True when the computer has no internet: the watchdog counts 3 or more failed checks in a row, or the sync service
// says its network is down, or the status helper says so.
export function networkDown(overview) {
  if (!overview) return false;
  const watch = overview.netwatch;
  const sync = overview.syncStatus;
  const status = overview.status || {};
  if (watch && typeof watch.failures === 'number' && watch.failures >= 3) return true;
  if (sync && sync.network && sync.network.ok === false) return true;
  return Boolean(status.network && status.network.state === 'down');
}

// The last good read of a sync source and the failure that came after it, if any: { lastGoodAt, failure: { at, reason } or null }
export function sourceFacts(overview, source) {
  const status = (overview && overview.status) || {};
  const mini = status.mini || {};
  const found = syncSources.find(item => item.target === source) || { miniKey: source, stateKey: source };
  const own = found.stateKey ? sourceOf(overview, found.stateKey) : null;
  const lastGoodAt = (own && own.lastSuccessAt) || mini[found.miniKey] || '';
  let failure = null;
  if (own && later(own.lastFailureAt, own.lastSuccessAt)) failure = { at: own.lastFailureAt, reason: own.lastFailureReason || 'The read failed.' };
  if (!failure && source === 'monday' && status.mondayError) failure = { at: '', reason: status.mondayError };
  if (!failure && source === 'calendars' && status.calendarErrors > 0) failure = { at: '', reason: status.calendarErrors + ' calendar link(s) could not be downloaded.' };
  return { lastGoodAt: lastGoodAt, failure: failure };
}

// The state of one sync card: ok, failed or never (no good read yet)
export function sourceState(overview, source) {
  const facts = sourceFacts(overview, source);
  if (facts.failure) return 'failed';
  return facts.lastGoodAt ? 'ok' : 'never';
}

function dotFrom(status, key) {
  const dot = status.dots && status.dots[key];
  return dot ? { state: colorToState[dot.color] || 'unknown', reason: dot.reason || '' } : { state: 'unknown', reason: '' };
}

// The five dots: { id, label, state (ok, warn, bad, unknown), words, raw }
export function buildDots(overview, now = new Date()) {
  const status = (overview && overview.status) || {};
  const wall = (overview && overview.wall) || {};
  const down = networkDown(overview);
  const dots = {};

  dots.sanity = dotFrom(status, 'sanity');
  const sanityFacts = sourceOf(overview, 'sanity');
  if (sanityFacts && later(sanityFacts.lastFailureAt, sanityFacts.lastSuccessAt)) dots.sanity = { state: 'bad', reason: sanityFacts.lastFailureReason };
  dots.monday = dotFrom(status, 'monday');
  dots.band = dotFrom(status, 'band');
  const bandFacts = sourceFacts(overview, 'calendars');
  if (bandFacts.failure) dots.band = { state: 'bad', reason: bandFacts.failure.reason };

  if (!overview) dots.network = { state: 'unknown', reason: '' };
  else if (down) dots.network = { state: 'bad', reason: 'The network check has failed ' + ((overview.netwatch && overview.netwatch.failures) || 'several') + ' times in a row.' };
  else if (overview.netwatch && overview.netwatch.failures > 0) dots.network = { state: 'warn', reason: 'The last network check failed. It is being repaired.' };
  else if (overview.netwatch || (overview.syncStatus && overview.syncStatus.network) || (status.network && status.network.state === 'ok')) dots.network = { state: 'ok', reason: 'The last network check passed.' };
  else dots.network = { state: 'unknown', reason: 'The network check has not reported yet.' };

  if (!overview) dots.screen = { state: 'unknown', reason: '' };
  else if (!wall.reporting) dots.screen = { state: 'warn', reason: 'The screen has not reported since this service started.' };
  else if (wall.quiet) dots.screen = { state: 'bad', reason: 'The screen has not reported for ' + wall.ageSeconds + ' seconds.' };
  else if (status.kiosk && status.kiosk !== 'active' && !/running|active/.test(status.kiosk)) dots.screen = { state: 'warn', reason: 'The screen service says: ' + status.kiosk };
  else dots.screen = { state: 'ok', reason: 'The screen reported ' + wall.ageSeconds + ' seconds ago.' };

  const words = { ok: 'OK', warn: 'Late', bad: 'Problem', unknown: 'Not known' };
  return dotOrder.map(id => ({ id: id, label: dotLabels[id], state: dots[id].state, words: words[dots[id].state], raw: dots[id].reason }));
}

// The Attention list: one plain problem for each thing that is not fine, worst first. See words.js for the sentences.
export function buildProblems(overview, now = new Date()) {
  if (!overview) return [];
  const dots = buildDots(overview, now);
  const state = id => dots.find(dot => dot.id === id).state;
  const down = networkDown(overview);
  const problems = [];

  if (down) {
    const watch = overview.netwatch || {};
    problems.push(Object.assign({ id: 'network' }, plainProblem({ source: 'network', reason: 'The network check has failed ' + (watch.failures || 'several') + ' times in a row.', lastGoodAt: watch.lastOkAt, networkDown: true }, now), { severity: 'bad' }));
  }

  // While the internet is down every failed read is the same problem, so only the network is listed
  if (!down) {
    ['calendars', 'monday'].forEach(source => {
      const facts = sourceFacts(overview, source);
      const dotId = source === 'calendars' ? 'band' : 'monday';
      if (facts.failure) {
        problems.push(Object.assign({ id: source }, plainProblem({ source: source, reason: facts.failure.reason, lastGoodAt: facts.lastGoodAt }, now), { severity: 'bad' }));
      } else if (state(dotId) === 'warn') {
        problems.push({
          id: source, source: source, kind: 'late', severity: 'warn',
          message: nameOf(source) + " hasn't updated since " + (clockWords(facts.lastGoodAt) || 'it last worked') + '.',
          still: facts.lastGoodAt ? 'The TV is still showing the copy from ' + clockWords(facts.lastGoodAt) + '.' : 'The TV is showing what it saved earlier.',
          fixes: [{ id: 'sync', label: 'Sync ' + nameOf(source) + ' now' }], where: '', raw: dots.find(dot => dot.id === dotId).raw,
        });
      }
    });
    if (state('sanity') === 'bad' || state('sanity') === 'warn') {
      const raw = dots.find(dot => dot.id === 'sanity').raw;
      problems.push({
        id: 'sanity', source: 'sanity', kind: 'sanity', severity: state('sanity'), message: "Sanity didn't answer. The screen shows the last saved content.",
        still: 'The TV is showing the content it saved earlier.', fixes: [{ id: 'network', label: 'Run network check' }, { id: 'details', label: 'Show details' }], where: '', raw: raw,
      });
    }
  }

  const sync = overview.syncStatus && overview.syncStatus.sources ? overview.syncStatus.sources : {};
  ['weather', 'images'].forEach(key => {
    const one = sync[key];
    if (!down && one && later(one.lastFailureAt, one.lastSuccessAt)) {
      problems.push(Object.assign({ id: key }, plainProblem({ source: key, reason: one.lastFailureReason, lastGoodAt: one.lastSuccessAt }, now), { severity: 'warn' }));
    }
  });

  if (state('screen') === 'bad' || state('screen') === 'warn') {
    const dot = dots.find(item => item.id === 'screen');
    problems.push({
      id: 'screen', source: 'screen', kind: 'screen', severity: dot.state,
      message: dot.state === 'bad' ? "The screen isn't reporting. It may be restarting or stuck." : "The screen hasn't reported yet.",
      still: 'The TV may still be showing its last picture.', fixes: [{ id: 'restart-screen', label: 'Restart the dashboard' }], where: '', raw: dot.raw,
    });
  }
  return problems.sort((a, b) => (a.severity === 'bad' ? 0 : 1) - (b.severity === 'bad' ? 0 : 1));
}

// The banner at the top of Now: { state: 'good' | 'attention' | 'unknown', count, words, checked }
export function buildBanner(overview, now = new Date()) {
  if (!overview) return { state: 'unknown', count: 0, words: 'Waiting for the first check', checked: '' };
  const problems = buildProblems(overview, now);
  const checked = clockWords(overview.at);
  if (problems.length === 0) return { state: 'good', count: 0, words: 'All good', checked: checked };
  return { state: 'attention', severity: problems.some(item => item.severity === 'bad') ? 'bad' : 'warn', count: problems.length, words: 'Needs attention: ' + problems.length + (problems.length === 1 ? ' problem' : ' problems'), checked: checked };
}

// "Last remote action": "Restart the dashboard, asked by Jason, 3:12 PM, 20 min ago. Done." or '' when there is none
const remoteNames = {
  'sync-all': 'Sync everything', sync: 'Sync now', 'restart-kiosk': 'Restart the dashboard', 'restart-dashboard': 'Restart the dashboard',
  'restart-services': 'Restart services', reboot: 'Reboot the computer',
};

const networkActionNames = {
  restart_network: 'Restarted the network service', renew_dhcp: 'Renewed the network address', bounce_interface: 'Reset the network connection', reboot: 'Rebooted the computer',
};

// What the network check last did to repair the connection, in words. Empty when the file is missing or it never acted.
export function networkActionWords(watch, now = new Date()) {
  if (!watch || !watch.lastAction || watch.lastAction === 'none') return '';
  const what = networkActionNames[watch.lastAction] || 'Network repair (' + watch.lastAction.replace(/_/g, ' ') + ')';
  const when = whenWords(watch.lastActionAt, now);
  return what + (when ? ', ' + when : '');
}

export function remoteWords(remote, now = new Date()) {
  if (!remote || !remote.present) return '';
  const what = remoteNames[remote.action] || remote.action || 'An action';
  const who = remote.requestedBy ? ', asked by ' + remote.requestedBy : '';
  const when = whenWords(remote.handledAt, now);
  return what + who + (when ? ', ' + when : '') + (remote.result ? '. ' + remote.result : '');
}
