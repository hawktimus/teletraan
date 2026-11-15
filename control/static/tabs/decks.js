// The Presentations section of the Show area: the decks of the Google Drive folder, each with a button that
// plays it on the TV. The list is the one the Teletraan computer keeps (decks-sync.sh), read again every ten
// seconds, so a file put in the folder shows here without a reload. The service writes the words of each line.

import { api, useStyles } from './api.js';
import { el } from '../dom.js';

export const refreshSeconds = 10;

function row(deck, onPlay) {
  const line = el('div', 'row');
  const play = el('button', 'act', 'Play on the TV');
  play.type = 'button';
  play.disabled = !deck.canPlay;
  play.addEventListener('click', () => onPlay(deck, play));
  line.append(el('strong', '', deck.name), el('span', 'note', deck.note), play);
  return line;
}

export async function mountDecks(body) {
  useStyles();
  const warning = el('p', 'warn');
  const list = el('div', 'card');
  const said = el('p', 'action-status');
  said.setAttribute('role', 'status');
  const checked = el('p', 'note');
  body.append(warning, list, said, checked);

  async function play(deck, button) {
    button.disabled = true;
    said.className = 'action-status';
    said.textContent = 'Sending ' + deck.name + ' to the TV.';
    const answer = await api('POST', '/decks/play', { id: deck.id });
    said.className = 'action-status ' + (answer.ok ? 'good' : 'bad');
    said.textContent = answer.ok
      ? answer.data.name + ' was sent. Its title card is on the TV within ' + answer.data.withinSeconds + ' seconds. The clicker starts it.'
      : answer.error;
    button.disabled = false;
  }

  async function load() {
    const answer = await api('GET', '/decks');
    list.textContent = '';
    if (!answer.ok) {
      warning.textContent = answer.error;
      return;
    }

    const data = answer.data;
    const warnings = [data.note];
    if (data.enabled === false) warnings.push('Run presentations is switched off in Dashboard Settings, so a deck cannot be started.');
    if (!data.wallReporting) warnings.push('The screen is not reporting to this computer right now.');
    warning.textContent = warnings.filter(Boolean).join(' ');
    checked.textContent = data.checked;

    if (data.decks.length === 0) list.append(el('p', 'note', data.state === 'ok' ? 'The folder has no presentations yet. Put a Google Slides or PowerPoint file in it.' : 'No presentations to show.'));
    data.decks.forEach(deck => list.append(row(deck, play)));
  }

  await load();
  const timer = setInterval(load, refreshSeconds * 1000);
  return () => clearInterval(timer);
}
