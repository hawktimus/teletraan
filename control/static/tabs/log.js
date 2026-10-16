// The Log tab: the last 200 lines of the control service's own log.

import { registerTab } from '../tabs.js';
import { api, useStyles } from './api.js';
import { logHtml } from './render.js';

registerTab({
  id: 'log',
  title: 'Log',
  order: 50,
  async render(container) {
    useStyles();
    container.innerHTML = '<div class="tab"><div class="buttons"><button type="button" class="act" data-refresh>Refresh</button></div><div data-body></div></div>';
    const body = container.querySelector('[data-body]');

    async function load() {
      const answer = await api('GET', '/log');
      body.innerHTML = answer.ok ? logHtml(answer.data.lines) : '<section class="card"><h2>Log</h2><p>' + answer.error + '</p></section>';
      const log = body.querySelector('.log');
      if (log) log.scrollTop = log.scrollHeight;
    }
    container.querySelector('[data-refresh]').addEventListener('click', load);
    await load();
  },
});
