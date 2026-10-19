// The health blocks of the Status tab: the three dots with their reasons, what runs, and the restart and sync buttons.

import { api, confirmed, showResult, useStyles } from './api.js';
import { esc, outcome, statusHtml } from './render.js';

const restarts = [
  { word: 'restart-kiosk', label: 'Restart screen', doing: 'Restarting the screen' },
  { word: 'restart-services', label: 'Restart services', doing: 'Restarting the services' },
  { word: 'reboot', label: 'Reboot the computer', doing: 'Rebooting the Teletraan computer' },
];
const syncs = [
  { target: 'calendars', label: 'Sync calendars now' },
  { target: 'monday', label: 'Sync Monday now' },
  { target: 'frc', label: 'Sync competition now' },
  { target: 'photos-drive', label: 'Copy Drive photos now' },
];

function buttons(box) {
  const run = async (button, word, body, doing) => {
    showResult(button, 'working', doing + '.');
    const result = await api('POST', '/helper/' + word, body);
    const shown = outcome(result, word, body);
    showResult(button, shown.state, shown.words);
  };

  const big = document.createElement('div');
  big.className = 'buttons';
  restarts.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'act';
    button.textContent = item.label;
    big.appendChild(button);
    confirmed(button, 10, item.doing, () => run(button, item.word, { confirmed: true }, item.doing));
  });

  const small = document.createElement('div');
  small.className = 'buttons small';
  syncs.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'act quiet';
    button.textContent = item.label;
    button.addEventListener('click', () => run(button, 'sync-now', { target: item.target }, 'Syncing ' + item.target));
    small.appendChild(button);
  });
  box.append(big, small);
}

// Fills the two boxes: body gets the health cards, buttonsBox the restart and sync buttons. Returns the function that stops it.
export async function mountHealth(body, buttonsBox) {
  useStyles();
  buttons(buttonsBox);

  // Only redrawn when the words changed, so the scroll position stays
  let last = '';
  let left = false;
  async function refresh() {
    const answer = await api('GET', '/status');
    if (left) return;
    const html = answer.ok ? statusHtml(answer.data) : '<section class="card"><h2>Health</h2><p>' + esc(answer.error) + '</p></section>';
    if (html === last) return;
    last = html;
    body.innerHTML = html;
  }
  await refresh();
  const timer = setInterval(refresh, 30000);
  return () => { left = true; clearInterval(timer); };
}
