// The moving picture of the TV for the Live preview (computer/scripts/mirror.py). POST /mirror/watch tells the
// Teletraan computer that someone is looking: the helper touches the watch file and starts the picture service if it is
// not running. The page calls it every 30 seconds while the tab is visible. GET /mirror/status only asks, and adds what the script says about its pictures (screencast or screenshots, or black). The control
// container reads the data folder read only, so the helper does the writing, as the login user.

import fs from 'node:fs';
import path from 'node:path';
import { Refusal, mount, send } from '../support/http.js';

// The helper prints "mirror: running", "mirror: stopped" or "mirror: no python3"
export function mirrorState(output) {
  const text = String(output || '');
  if (/mirror: no python3/.test(text)) return 'no-python3';
  if (/mirror: running/.test(text)) return 'running';
  if (/mirror: stopped/.test(text)) return 'stopped';
  return 'unknown';
}

// What mirror.py says about the pictures it writes (mirror/state.json): { state, mode, fps, bytes, width, height,
// sampled, tried }, where sampled means a PNG of the page was read for black, or null when there is no
// file, it is not a plain answer, or it is older than 15 seconds (the script rewrites it every 2 seconds).
export function pictureState(ctx, now = Date.now()) {
  const file = path.join(ctx.dataDir || '', 'mirror', 'state.json');
  try {
    if (now - fs.statSync(file).mtimeMs > 15000) return null;
    const found = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!['ok', 'black'].includes(found.state) || !['screencast', 'screenshots'].includes(found.mode)) return null;
    const number = value => (Number.isFinite(value) && value >= 0 ? value : 0);
    const tried = {};
    for (const way of ['screencast', 'screenshots']) {
      if (found.tried && ['ok', 'black'].includes(found.tried[way])) tried[way] = found.tried[way];
    }
    return {
      state: found.state, mode: found.mode, fps: number(found.fps), bytes: number(found.bytes),
      width: number(found.width), height: number(found.height), sampled: found.sampled === true, tried,
    };
  } catch (error) {
    return null;
  }
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
    send(res, 200, { ok: true, state: mirrorState(await ask(ctx, 'mirror-status')), picture: pictureState(ctx) });
  });
}
