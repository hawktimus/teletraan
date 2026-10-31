// The list of syncs and of restarts, and the choice of which syncs Sync all runs. The buttons that use them are in
// areas/update-sync.js (the sync cards) and areas/computer-restart.js (the restart buttons).

import { esc } from './render.js';

export const restarts = [
  { word: 'restart-kiosk', label: 'Restart screen', doing: 'Restarting the screen' },
  { word: 'restart-services', label: 'Restart services', doing: 'Restarting the services' },
  { word: 'reboot', label: 'Reboot the computer', doing: 'Rebooting the Teletraan computer' },
];

// The order here is the order Sync all runs them in (control/support/sync-all.js)
export const syncs = [
  { target: 'calendars', label: 'Sync calendars now', name: 'Calendars' },
  { target: 'monday', label: 'Sync Monday now', name: 'Monday' },
  { target: 'frc', label: 'Sync competition now', name: 'Competition' },
  { target: 'news', label: 'Sync news now', name: 'FRC news' },
  { target: 'match13', label: 'Sync Match13 now', name: 'Match13' },
  { target: 'photos-drive', label: 'Copy Drive photos now', name: 'Drive photos' },
];

const storeName = 'teletraan-sync-all-off';

// The syncs the person switched off for Sync all, kept in this browser only
export function readOff(storage) {
  try {
    const found = JSON.parse(storage.getItem(storeName) || '[]');
    return Array.isArray(found) ? found.filter(target => syncs.some(item => item.target === target)) : [];
  } catch (error) {
    return [];
  }
}

export function saveOff(storage, off) {
  try { storage.setItem(storeName, JSON.stringify(off)); } catch (error) { /* the choice is then lost on reload, which is harmless */ }
}

const stateWords = { ok: 'Ran', skipped: 'Skipped', failed: 'Failed' };

// One line for each sync, from the answer of POST sync-all
export function syncLinesHtml(answer) {
  const results = (answer && answer.results) || [];
  const lines = results.map(result => '<li data-state="' + esc(result.state) + '"><strong>' + esc(result.label) + '</strong> ' +
    '<span class="state">' + esc(stateWords[result.state] || result.state) + '</span> ' + esc(result.words) + '</li>').join('');
  return '<ul class="sync-lines">' + lines + '</ul>';
}
