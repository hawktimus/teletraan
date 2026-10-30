// The status pill at the foot of the screen (#sync-pill, dashboard/sync-pill.css): hidden while everything is fresh,
// amber "Offline since 3:12 PM" when a source is late, red when every source is down. The rules are in
// core/sync-status.js and the limits in core/constants.js. The pill says no error and no host, only the word and a time.
// The sample content has no sync service, so there is no pill on ?sample=1.

import { formatTimeOfDay } from './time.js';
import { mondayEvery } from './dots.js';
import { pillState, watchSyncStatus } from './sync-status.js';

// The words of the pill for a state, or '' when it is not drawn
export function pillText(state) {
  if (state.state === 'ok') return '';
  return state.since ? 'Offline since ' + formatTimeOfDay(state.since) : 'Offline';
}

export function startSyncPill(getContent, isSample) {
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
