// The Keys section of Settings: the keys and calendar links of local.env, masked. A value is typed once and sent once.
// Saving goes through the helper, then the calendars run once. The Mac tool stays as the way in when this
// page cannot be reached.

import { api, useStyles } from './api.js';
import { esc, keysHtml } from './render.js';

function collect(root) {
  const body = { keys: {}, calendars: [] };

  root.querySelectorAll('[data-key]').forEach(box => {
    const name = box.dataset.key;
    const field = box.querySelector('input');
    if (box.dataset.clear === 'yes') body.keys[name] = { action: 'clear' };
    else if (field.value !== '') body.keys[name] = { action: 'set', value: field.value };
  });

  root.querySelectorAll('[data-calendar]').forEach(box => {
    const name = box.dataset.calendar;
    const field = box.querySelector('input');
    if (box.dataset.clear === 'yes') body.calendars.push({ name: name, action: 'clear' });
    else if (field.value !== '') body.calendars.push({ name: name, action: 'set', value: field.value });
  });

  const newName = root.querySelector('[name="new-name"]');
  const newLink = root.querySelector('[name="new-link"]');
  if (newName && newLink && newLink.value !== '') body.calendars.push({ name: newName.value, action: 'set', value: newLink.value });
  return body;
}

export async function mountKeys(container) {
  useStyles();
  container.innerHTML = '<div class="tab" data-root></div>';
  const root = container.querySelector('[data-root]');

  async function load() {
    const answer = await api('GET', '/env');
    root.innerHTML = answer.ok ? keysHtml(answer.data) : '<section class="card"><h2>Keys</h2><p>' + esc(answer.error) + '</p></section>';
  }
  await load();

  root.addEventListener('click', async event => {
    const note = root.querySelector('[data-note]');
    const clear = event.target.closest('[data-clear],[data-clear-calendar]');
    if (clear) {
      const box = clear.closest('.key');
      box.dataset.clear = box.dataset.clear === 'yes' ? 'no' : 'yes';
      clear.textContent = box.dataset.clear === 'yes' ? 'Will be cleared' : 'Clear';
      return;
    }
    if (!event.target.closest('[data-save]')) return;

    const body = collect(root);
    note.textContent = 'Saving.';
    const result = await api('POST', '/env', body);
    if (!result.ok) { note.textContent = result.error; note.dataset.bad = 'yes'; return; }
    note.dataset.bad = 'no';
    await load();
    root.querySelector('[data-note]').textContent = 'Saved. The calendars ' + (result.data.calendarsRun ? 'were read again.' : 'will be read at the next run.');
  });
}
