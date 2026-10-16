// POST /control/api/helper/<word>: asks the host helper (mini/scripts/control-helper.sh) to do one
// thing. The helper accepts exactly the words below and refuses anything else, and so does this
// route, before the helper is asked. write-env is left out on purpose: only the Keys route
// (routes/env.js) may send it, with a merged file.

import { Refusal, mount, paramOf, readJson, send } from '../support/http.js';

export const words = ['restart-kiosk', 'restart-services', 'reboot', 'status', 'sync-now', 'monday-check'];
export const syncTargets = ['calendars', 'monday', 'frc'];

// These stop or restart something people are watching, so the request must say it was confirmed
const needsConfirm = ['restart-kiosk', 'restart-services', 'reboot'];

export function checkRequest(word, body) {
  if (!words.includes(word)) throw new Refusal(400, 'The Mini does not know that word.');
  if (needsConfirm.includes(word) && body.confirmed !== true) throw new Refusal(400, 'Confirm first.');

  if (word === 'sync-now') {
    if (!syncTargets.includes(body.target)) throw new Refusal(400, 'Sync one of: ' + syncTargets.join(', ') + '.');
    return [body.target];
  }
  return [];
}

export function register(router, ctx) {
  mount(router, ctx, 'POST', '/helper/:word', async (req, res) => {
    const word = paramOf(req, '/helper/:word', 'word');
    const body = await readJson(req);
    const args = checkRequest(word, body);

    const output = await ctx.helper(word, args);
    send(res, 200, { ok: true, word: word, output: String(output === undefined ? '' : output).slice(0, 2000) });
  });
}
