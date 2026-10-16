// Talks to the host helper (mini/scripts/control-helper.sh) over its Unix socket. One request is one line,
// "word" or "word argument", followed by a body for write-env, then the end of the stream. The answer is the
// output of the word and a last line: ok, refused, or failed <exit code>.

import net from 'node:net';

export const words = ['restart-kiosk', 'restart-services', 'reboot', 'status', 'sync-now', 'write-env', 'monday-check'];

export function createHelper(socketPath, timeout = 30000) {
  return function helper(word, args = [], body = '') {
    return new Promise(resolve => {
      if (!words.includes(word) || !args.every(arg => /^[a-z]{1,20}$/.test(arg))) {
        resolve({ ok: false, status: 'refused', output: 'That is not a word the helper knows.' });
        return;
      }
      let answer = '';
      const socket = net.createConnection(socketPath);
      const timer = setTimeout(() => {
        socket.destroy();
        resolve({ ok: false, status: 'timeout', output: 'The helper did not answer in time.' });
      }, timeout);
      socket.on('connect', () => socket.end([word].concat(args).join(' ') + '\n' + body));
      socket.on('data', chunk => { answer += chunk; });
      socket.on('error', error => {
        clearTimeout(timer);
        resolve({ ok: false, status: 'unreachable', output: 'The helper socket cannot be reached (' + error.code + ').' });
      });
      socket.on('close', () => {
        clearTimeout(timer);
        const lines = answer.trimEnd().split('\n');
        const last = lines.pop() || '';
        resolve({ ok: last === 'ok', status: last || 'no answer', output: lines.join('\n') });
      });
    });
  };
}
