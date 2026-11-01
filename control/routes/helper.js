// POST /control/api/helper/<word>: asks the host helper (computer/scripts/control-helper.sh) to do one
// thing. The helper accepts exactly the words below and refuses anything else, and so does this
// route, before the helper is asked. write-env is left out on purpose: only the Keys route
// (routes/env.js) may send it, with a merged file.

import { Refusal, mount, paramOf, readJson, send } from '../support/http.js';

export const words = ['restart-kiosk', 'restart-services', 'reboot', 'status', 'sync-now', 'monday-check', 'monday-debug', 'mirror-start', 'mirror-watch', 'mirror-status', 'display-info', 'network-info', 'cleanup-preview', 'cleanup-delete', 'wifi-scan', 'wifi-status', 'wifi-connect', 'restart-network', 'dns-public', 'dns-default'];
const syncTargets = ['calendars', 'monday', 'frc', 'news', 'photos-drive', 'match13'];

// These stop or restart something people are watching, so the request must say it was confirmed
const needsConfirm = ['restart-kiosk', 'restart-services', 'reboot', 'cleanup-delete', 'wifi-connect', 'restart-network'];

function checkRequest(word, body) {
  if (!words.includes(word)) throw new Refusal(400, 'The Teletraan computer does not know that word.');
  if (needsConfirm.includes(word) && body.confirmed !== true) throw new Refusal(400, 'Confirm first, then press the button again.');

  if (word === 'sync-now') {
    if (!syncTargets.includes(body.target)) throw new Refusal(400, 'Sync one of: ' + syncTargets.join(', ') + '.');
    return [body.target];
  }
  if (word === 'monday-debug') {
    if (typeof body.board !== 'string' || !/^[0-9]{1,20}$/.test(body.board)) throw new Refusal(400, 'Type the board number, digits only.');
    return [body.board];
  }
  return [];
}

// The network name and the password travel as the body of the request, one line each, never as arguments. The password is
// checked here for its length only; the tool on the computer checks the rest. It is never logged or sent back.
function wifiBody(body) {
  const name = body.ssid;
  const password = body.password === undefined ? '' : body.password;
  if (typeof name !== 'string' || name.length < 1 || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) throw new Refusal(400, 'Type the network name, 1 to 32 characters.');
  if (typeof password !== 'string' || password.length > 64 || /[\u0000-\u001f\u007f]/.test(password)) throw new Refusal(400, 'That password cannot be sent. A Wi-Fi password is 8 to 63 characters.');
  return name + '\n' + password + '\n';
}

export function register(router, ctx) {
  mount(router, ctx, 'POST', '/helper/:word', async (req, res) => {
    const word = paramOf(req, '/helper/:word', 'word');
    const body = await readJson(req);
    const args = checkRequest(word, body);
    const input = word === 'wifi-connect' ? wifiBody(body) : '';

    let output;
    try {
      output = await ctx.helper(word, args, input);
    } catch (error) {
      // The helper's own sentences are plain, so the page shows them. The code goes to the log for the person at the computer.
      if (typeof ctx.log === 'function') ctx.log('helper ' + word + ' failed' + (error && error.code ? ' (' + error.code + ')' : '') + ': ' + String(error && error.message).slice(0, 200));
      throw new Refusal(502, String((error && error.message) || 'The helper did not answer.'));
    }
    send(res, 200, { ok: true, word: word, output: String(output === undefined ? '' : output).slice(0, word === 'monday-debug' ? 8000 : word === 'network-info' ? 6000 : word === 'wifi-scan' ? 4000 : word.startsWith('cleanup-') ? 20000 : 2000) });
  });
}
