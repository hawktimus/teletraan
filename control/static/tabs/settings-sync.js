// The Sync and restart section of Settings: Sync all and the single syncs, when each source was last read, the three dots
// that the TV shows, and the restart buttons. These moved here from Status, which only shows.

import { api, confirmed, showResult, useStyles } from './api.js';
import { esc, outcome } from './render.js';
import { dotsHtml, readsHtml } from './render-health.js';
import { choiceHtml } from '../choice.js';

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

function saveOff(storage, off) {
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

function syncCardHtml(off) {
  const boxes = choiceHtml({ multiple: true, label: 'Syncs that Sync all runs', items: syncs.map(item => ({ value: item.target, label: item.name, checked: !off.includes(item.target), attrs: 'data-include="' + esc(item.target) + '"' })) });
  return '<section class="card"><h2>Sync</h2>' +
    '<p class="note">Sync all runs the syncs one after another: calendars, Monday, competition, news, Match13, Drive photos. One that fails does not stop the others.</p>' +
    '<div class="buttons"><button type="button" class="act" data-sync-all>Sync all</button></div>' +
    '<div data-sync-lines></div>' +
    '<details class="more"><summary>Which syncs Sync all runs</summary>' + boxes + '</details>' +
    '<h3>One at a time</h3><div class="buttons small" data-singles></div></section>';
}

export async function mountSync(container) {
  useStyles();
  let storage = null;
  try { storage = window.localStorage; } catch (error) { storage = null; }
  const off = storage ? readOff(storage) : [];

  container.innerHTML = '<div class="tab sync-section" data-root>' +
    syncCardHtml(off) +
    '<div class="grid"><div data-reads></div><div data-dots></div></div>' +
    '<section class="card"><h2>Network</h2><p class="note">Check the network now prints the connection, the signal, the address, the gateway, the last lines of the network log and what the network watchdog has done. It changes nothing.</p>' +
    '<div class="buttons"><button type="button" class="act" data-network>Check the network now</button></div><pre class="log" data-network-answer hidden></pre></section>' +
    '<section class="card"><h2>Restart</h2><p class="note">Each one waits 10 seconds first, so you can cancel.</p><div class="buttons" data-restarts></div></section>' +
    '</div>';
  const root = container.querySelector('[data-root]');

  const run = async (button, word, body, doing) => {
    showResult(button, 'working', doing + '.');
    const result = await api('POST', '/helper/' + word, body);
    const shown = outcome(result, word, body);
    showResult(button, shown.state, shown.words);
  };

  const singles = root.querySelector('[data-singles]');
  syncs.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'act quiet';
    button.textContent = item.label;
    button.addEventListener('click', () => run(button, 'sync-now', { target: item.target }, 'Syncing ' + item.name));
    singles.appendChild(button);
  });

  const networkButton = root.querySelector('[data-network]');
  const networkAnswer = root.querySelector('[data-network-answer]');
  networkButton.addEventListener('click', async () => {
    showResult(networkButton, 'working', 'Looking at the network.');
    networkAnswer.hidden = true;
    const result = await api('POST', '/helper/network-info', {});
    showResult(networkButton, result.ok ? 'done' : 'bad', result.ok ? 'Done. Copy the text below and send it to a coach if the screen keeps losing the network.' : result.error);
    if (result.ok) {
      networkAnswer.textContent = String((result.data && result.data.output) || '');
      networkAnswer.hidden = false;
    }
  });

  const big = root.querySelector('[data-restarts]');
  restarts.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'act';
    button.textContent = item.label;
    big.appendChild(button);
    confirmed(button, 10, item.doing, () => run(button, item.word, { confirmed: true }, item.doing));
  });

  root.addEventListener('change', event => {
    if (!event.target.closest('[data-include]') || !storage) return;
    saveOff(storage, Array.from(root.querySelectorAll('[data-include]')).filter(box => !box.checked).map(box => box.dataset.include));
  });

  const all = root.querySelector('[data-sync-all]');
  const lines = root.querySelector('[data-sync-lines]');
  all.addEventListener('click', async () => {
    const skip = Array.from(root.querySelectorAll('[data-include]')).filter(box => !box.checked).map(box => box.dataset.include);
    all.disabled = true;
    lines.innerHTML = '';
    showResult(all, 'working', 'Running the syncs one after another. This can take a few minutes. Keep this page open.');
    const result = await api('POST', '/sync-all', { skip: skip });
    all.disabled = false;
    if (!result.ok) { showResult(all, 'bad', result.error); return; }
    lines.innerHTML = syncLinesHtml(result.data);
    showResult(all, result.data.failed ? 'bad' : 'done', (result.data.failed ? 'Some syncs failed. ' : 'Done. ') + result.data.summary);
    refresh();
  });

  // Reads and dots are drawn again every 30 seconds, and only when their words changed, so the scroll position stays
  let left = false;
  let last = '';
  async function refresh() {
    const answer = await api('GET', '/status');
    if (left) return;
    const reads = root.querySelector('[data-reads]');
    const dots = root.querySelector('[data-dots]');
    const html = answer.ok ? readsHtml(answer.data) + dotsHtml(answer.data) : '<section class="card"><h2>Last reads</h2><p>' + esc(answer.error) + '</p></section>';
    if (html === last) return;
    last = html;
    reads.innerHTML = answer.ok ? readsHtml(answer.data) : html;
    dots.innerHTML = answer.ok ? dotsHtml(answer.data) : '';
  }
  await refresh();
  const timer = setInterval(refresh, 30000);
  return () => { left = true; clearInterval(timer); };
}
