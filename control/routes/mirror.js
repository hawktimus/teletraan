// The moving picture of the TV for the Live preview (computer/scripts/mirror.py). POST /mirror/watch tells the
// Teletraan computer that someone is looking: the helper touches the watch file and starts the picture service if it is
// not running. The page calls it every 30 seconds while the tab is visible. GET /mirror/status only asks. The control
// container reads the data folder read only, so the helper does the writing, as the login user.

import { Refusal, mount, send } from '../support/http.js';

// The helper prints "mirror: running", "mirror: stopped" or "mirror: no python3"
export function mirrorState(output) {
  const text = String(output || '');
  if (/mirror: no python3/.test(text)) return 'no-python3';
  if (/mirror: running/.test(text)) return 'running';
  if (/mirror: stopped/.test(text)) return 'stopped';
  return 'unknown';
}

async function ask(ctx, word) {
  try {
    return await ctx.helper(word, []);
  } catch (error) {
    if (typeof ctx.log === 'function') ctx.log('helper ' + word + ' failed: ' + String(error && error.message).slice(0, 200));
    throw new Refusal(502, String((error && error.message) || 'The helper did not answer.'));
  }
}

export function register(router, ctx) {
  mount(router, ctx, 'POST', '/mirror/watch', async (req, res) => {
    send(res, 200, { ok: true, state: mirrorState(await ask(ctx, 'mirror-watch')) });
  });

  mount(router, ctx, 'GET', '/mirror/status', async (req, res) => {
    send(res, 200, { ok: true, state: mirrorState(await ask(ctx, 'mirror-status')) });
  });
}
