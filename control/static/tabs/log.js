// The Log section of Settings: the last 200 lines of the control service's own log.

import { api, showResult, useStyles } from './api.js';
import { logHtml, outcome } from './render.js';

export async function mountLog(container) {
  useStyles();
  container.innerHTML = '<div class="tab"><div class="buttons"><button type="button" class="act" data-refresh>Refresh</button></div><div data-body></div></div>';
  const body = container.querySelector('[data-body]');

  const refresh = container.querySelector('[data-refresh]');
  async function load(shown) {
    const answer = await api('GET', '/log');
    body.innerHTML = answer.ok ? logHtml(answer.data.lines) : '<section class="card"><h2>Log</h2><p></p></section>';
    if (!answer.ok) body.querySelector('p').textContent = answer.error;
    const log = body.querySelector('.log');
    if (log) log.scrollTop = log.scrollHeight;
    if (shown) {
      const result = outcome(answer, 'refresh');
      showResult(refresh, result.state, result.state === 'done' ? result.words + ' ' + (answer.data.lines || []).length + ' lines.' : result.words);
    }
  }
  refresh.addEventListener('click', () => load(true));
  await load(false);
}
