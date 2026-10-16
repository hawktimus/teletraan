// The Now showing tab: what is on the wall, and the buttons that change it. The card refreshes every
// 10 seconds, the length of the dashboard's own report.

import { registerTab } from '../tabs.js';
import { api, useStyles } from './api.js';
import { nowCardHtml, nowControlsHtml } from './render.js';

function wire(root, options, say) {
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const body = { action: action };
    const value = name => { const field = root.querySelector('[name="' + name + '"]'); return field ? field.value : ''; };

    if (action === 'hold') { body.panel = value('panel'); body.minutes = Number(button.dataset.minutes); }
    if (action === 'view') body.key = value('view');
    if (action === 'theme') body.theme = value('theme');
    if (action === 'post-announcement') body.text = value('text');

    button.disabled = true;
    const result = await api('POST', '/request', body);
    button.disabled = false;
    say(result.ok ? 'Sent. The screen answers within a few seconds.' : result.error, !result.ok);
  });
}

registerTab({
  id: 'now',
  title: 'Now showing',
  order: 20,
  async render(container) {
    useStyles();
    container.innerHTML = '<div class="tab"><div data-card></div><div data-controls></div></div>';
    const cardBox = container.querySelector('[data-card]');
    const controls = container.querySelector('[data-controls]');

    const options = await api('GET', '/request');
    controls.innerHTML = nowControlsHtml(options.ok ? options.data : null);
    const note = () => controls.querySelector('[data-note]');
    wire(controls, options.data, (words, bad) => { const line = note(); if (line) { line.textContent = words; line.dataset.bad = bad ? 'yes' : 'no'; } });

    async function refresh() {
      const answer = await api('GET', '/now');
      cardBox.innerHTML = nowCardHtml(answer.ok ? answer.data : { message: answer.error });
    }
    await refresh();
    const timer = setInterval(() => { if (!container.isConnected) clearInterval(timer); else refresh(); }, 10000);
  },
});
