// The health block at the bottom of the Status tab. It only shows: the buttons that restart or sync are in
// Settings, Sync and restart (settings-sync.js).

import { api, useStyles } from './api.js';
import { esc } from './render.js';
import { healthHtml } from './render-health.js';

// Fills the box. Returns the function that stops it.
export async function mountHealth(body) {
  useStyles();

  // Only redrawn when the words changed, so the scroll position stays
  let last = '';
  let left = false;
  async function refresh() {
    const [answer, wall] = await Promise.all([api('GET', '/status'), api('GET', '/now')]);
    if (left) return;
    const html = answer.ok ? healthHtml(answer.data, wall.ok ? wall.data : null) : '<section class="card"><h2>Health</h2><p>' + esc(answer.error) + '</p></section>';
    if (html === last) return;
    last = html;
    body.innerHTML = html;
  }
  await refresh();
  const timer = setInterval(refresh, 30000);
  return () => { left = true; clearInterval(timer); };
}
