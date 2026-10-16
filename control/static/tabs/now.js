// The Now showing tab: what is on the wall, and the buttons that change it. The card refreshes every
// 10 seconds, the length of the dashboard's own report.

import { registerTab } from '../tabs.js';
import { api, showResult, useStyles } from './api.js';
import { nowCardHtml, nowControlsHtml, outcome, previewCardHtml, previewScale } from './render.js';

// The sentence for a minutes field that holds no whole number inside its own limits, or '' when it is fine
function fieldProblem(field) {
  const text = field ? field.value.trim() : '';
  const number = Number(text);
  if (text === '' || !Number.isInteger(number) || number < Number(field.min) || number > Number(field.max)) {
    return 'Type a whole number of minutes from ' + field.min + ' to ' + field.max + '.';
  }
  return '';
}

function wire(root) {
  root.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;
    const body = { action: action };
    const value = name => { const field = root.querySelector('[name="' + name + '"]'); return field ? field.value : ''; };

    // A fixed button has its minutes in data-minutes; the other one reads the field named in data-minutes-from
    if (action === 'hold') body.panel = value('panel');
    if (action === 'view') body.key = value('view');
    if (button.dataset.minutes) body.minutes = Number(button.dataset.minutes);
    if (button.dataset.minutesFrom) {
      const field = root.querySelector('[name="' + button.dataset.minutesFrom + '"]');
      const bad = fieldProblem(field);
      if (bad) { showResult(button, 'bad', bad); return; }
      body.minutes = Number(field.value);
    }
    if (action === 'theme') body.theme = value('theme');
    if (action === 'post-announcement') body.text = value('text');

    button.disabled = true;
    showResult(button, 'working', 'Sending.');
    const result = await api('POST', '/request', body);
    button.disabled = false;
    const shown = outcome(result, action, body);
    showResult(button, shown.state, shown.words);
  });
}

// The copy of the dashboard is 1920 by 1080 and is shrunk to the width of its box
function fitPreview(root) {
  const box = root.querySelector('[data-preview-box]');
  const frame = root.querySelector('[data-preview-frame]');
  const fit = () => { frame.style.transform = 'scale(' + previewScale(box.clientWidth) + ')'; };
  fit();
  if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(box);
  else window.addEventListener('resize', fit);
}

registerTab({
  id: 'now',
  title: 'Now showing',
  order: 20,
  async render(container) {
    useStyles();
    container.innerHTML = '<div class="tab"><div data-card></div><div data-preview-card></div><div data-controls></div></div>';
    const cardBox = container.querySelector('[data-card]');
    const previewBox = container.querySelector('[data-preview-card]');
    previewBox.innerHTML = previewCardHtml();
    fitPreview(previewBox);
    const controls = container.querySelector('[data-controls]');

    const options = await api('GET', '/request');
    controls.innerHTML = nowControlsHtml(options.ok ? options.data : null);
    wire(controls);

    async function refresh() {
      const answer = await api('GET', '/now');
      cardBox.innerHTML = nowCardHtml(answer.ok ? answer.data : { message: answer.error });
    }
    await refresh();
    const timer = setInterval(() => { if (!container.isConnected) clearInterval(timer); else refresh(); }, 10000);
  },
});
