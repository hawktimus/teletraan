// The Monday section of Settings: two buttons that ask the Teletraan computer to look at Monday. Check the token says
// who the token belongs to. Monday debug shows how Monday answers for one board, so a coach can see why a board
// reads empty. Neither prints the token, and the debug answer holds item names but no names of people.

import { api, showResult, useStyles } from './api.js';
import { outcome } from './render.js';

// The task board of the rebuilt workspace (docs/monday.md), as a starting value in the box
export const startingBoard = '18435126893';

export const boardWords = 'Type the board number, digits only.';

export function mountMonday(container) {
  useStyles();
  container.innerHTML = '<p class="note">Check the token asks Monday who the token belongs to.</p>' +
    '<div class="buttons"><button type="button" class="act" data-check>Check the token</button></div>' +
    '<p class="note">Monday debug shows how Monday answers for the first two items of one board. Press it when the Monday page of Studio lists no tasks, and send the answer to a coach. It holds item names and column ids, and no token and no names of people.</p>' +
    '<div class="buttons"><label class="inline-field">Board number <input type="text" inputmode="numeric" data-board autocomplete="off"></label>' +
    '<button type="button" class="act" data-debug>Monday debug</button></div>' +
    '<pre class="log" data-answer hidden></pre>';
  const check = container.querySelector('[data-check]');
  const debug = container.querySelector('[data-debug]');
  const board = container.querySelector('[data-board]');
  const answer = container.querySelector('[data-answer]');
  board.value = startingBoard;

  check.addEventListener('click', async () => {
    showResult(check, 'working', 'Asking Monday.');
    const result = await api('POST', '/helper/monday-check', {});
    const shown = outcome(result, 'monday-check');
    showResult(check, shown.state, shown.state === 'done' ? String((result.data && result.data.output) || 'Monday accepts the token.').split('\n')[0] : shown.words);
  });

  debug.addEventListener('click', async () => {
    const number = board.value.trim();
    if (!/^[0-9]{1,20}$/.test(number)) {
      showResult(debug, 'bad', boardWords);
      return;
    }
    showResult(debug, 'working', 'Asking Monday.');
    answer.hidden = true;
    const result = await api('POST', '/helper/monday-debug', { board: number });
    const shown = outcome(result, 'monday-debug');
    showResult(debug, shown.state, shown.state === 'done' ? 'Done. Copy the text below and send it to a coach.' : shown.words);
    if (result.ok) {
      answer.textContent = String((result.data && result.data.output) || '');
      answer.hidden = false;
    }
  });
}
