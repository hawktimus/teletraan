// The status pill at the foot of the screen (#sync-pill, dashboard/sync-pill.css): hidden while everything is fresh,
// amber "Updates late since 3:12 PM" when a source is late, red "No updates since 3:12 PM" when every source is down. The word
// Offline is not used: the screen works from its saved copy and is not an error. The rules are in
// core/sync-status.js and the limits in core/constants.js. The pill says no error and no host, only the word and a time.
// The sample content has no sync service, so there is no pill on ?sample=1.

import { formatShortDate, formatTimeOfDay, localDay } from './time.js';
import { mondayEvery } from './dots.js';
import { pillState, watchSyncStatus } from './sync-status.js';

// The words of the pill for a state, or '' when it is not drawn. A time from an earlier day carries its date
// ("Updates late since Oct 31, 7:40 PM"), so an old failure does not read as one from tonight.
export function pillText(state, now = new Date()) {
  if (state.state === 'ok') return '';
  const words = state.state === 'down' ? 'No updates' : 'Updates late';
  if (!state.since) return words;
  const clock = formatTimeOfDay(state.since);
  return words + ' since ' + (localDay(state.since) === localDay(now) ? clock : formatShortDate(state.since) + ', ' + clock);
}

// The pill is no longer drawn. The wall shows no error message of any kind: a late or a down source is on the Control page
// (Overview, control/static/overview.js) and in the dots. The words above stay for the Control page and the tests.
export function startSyncPill(getContent, isSample) {
  const host = document.getElementById('sync-pill');
  if (host) {
    host.textContent = '';
    host.dataset.state = 'ok';
    host.setAttribute('aria-hidden', 'true');
  }
}

// What the pill was: kept so a later decision can bring it back. Nothing calls it.
function drawnSyncPill(getContent, isSample) {
  const host = document.getElementById('sync-pill');
  if (!host || isSample) return;

  host.textContent = '';
  const label = document.createElement('span');
  host.appendChild(label);

  function draw(status) {
    const content = getContent() || {};
    const state = pillState(status, new Date(), mondayEvery(content.settings));
    const text = pillText(state);

    // The words stay while the pill fades out, so it does not go blank before it is gone
    if (text !== '' && label.textContent !== text) label.textContent = text;
    if (host.dataset.state !== state.state) host.dataset.state = state.state;
    host.setAttribute('aria-hidden', state.state === 'ok' ? 'true' : 'false');
  }

  watchSyncStatus(draw);
}
